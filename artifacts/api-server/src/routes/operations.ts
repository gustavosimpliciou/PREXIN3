import { isDeepStrictEqual } from 'node:util';
import { Router } from 'express';
import { z } from 'zod';
import Decimal from 'decimal.js';
import PDFDocument from 'pdfkit';
import { and,desc,eq,sql } from 'drizzle-orm';
import { db, materialsTable,printersTable,productsTable,productVersionsTable,quotesTable,pricingSettingsTable,preferencesTable,stockMovementsTable,operationsTable,auditTable } from '@workspace/db';
import { ENGINE_VERSION,calculatePricing,materialConsumption,type PricingInput } from '@workspace/pricing-engine';
import { HttpError,num,pricingSchema,requireId } from '../lib/validation';
import { calculationFor,assertOwnership } from '../lib/calculation';
import importsRouter from './imports';
const router=Router();
router.use(importsRouter);
const own=(res:any)=>res.locals.userId as string;
const id=(req:any)=>requireId(req.params.id);
const rate=num.lt(1);
const channelSchema=z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1).max(80),percentFees:rate,taxPercent:rate,fixedFeePerOrder:num,fixedFeePerUnit:num,desiredMargin:rate,minimumMargin:rate.optional()}).refine(c=>c.percentFees+c.taxPercent+c.desiredMargin<1,'Taxas, tributos e margem devem somar menos de 100%.');
const preferencesSchema=z.object({
  logoUrl:z.string().max(500000).refine(s=>!s||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s),'Use imagem PNG, JPEG ou WebP.').default(''),
  companyDetails:z.string().max(2000).default(''),quoteValidityDays:z.number().int().min(1).max(365).default(15),
  channels:z.array(channelSchema).max(30).default([]),
  wholesaleTiers:z.array(z.object({quantity:z.number().int().positive().max(1000000),margin:rate})).max(20).default([]),
});
router.get('/preferences',async(_req,res)=>{const [row]=await db.select().from(preferencesTable).where(eq(preferencesTable.userId,own(res)));res.json(row?.data??preferencesSchema.parse({}));});
router.put('/preferences',async(req,res)=>{const data=preferencesSchema.parse(req.body);await db.insert(preferencesTable).values({userId:own(res),data}).onConflictDoUpdate({target:preferencesTable.userId,set:{data,updatedAt:new Date()}});res.json(data);});
router.get('/products/:id/versions',async(req,res)=>{res.json(await db.select().from(productVersionsTable).where(and(eq(productVersionsTable.userId,own(res)),eq(productVersionsTable.productId,id(req)))).orderBy(desc(productVersionsTable.createdAt)));});
router.get('/products/:id/current-input',async(req,res)=>{
  const userId=own(res);const [product]=await db.select().from(productsTable).where(and(eq(productsTable.id,id(req)),eq(productsTable.userId,userId)));if(!product)throw new HttpError(404,'Produto não encontrado.');
  const input=pricingSchema.parse(product.input);
  const [settings]=await db.select().from(pricingSettingsTable).where(eq(pricingSettingsTable.userId,userId));
  const refresh=async(lines:PricingInput['materials'])=>Promise.all(lines.map(async line=>{if(!line.materialId)return line;const [m]=await db.select().from(materialsTable).where(and(eq(materialsTable.id,line.materialId),eq(materialsTable.userId,userId)));return m&&!m.archived?{...line,name:m.name,costPerGram:new Decimal(m.purchaseValue).plus(m.allocatedFreight).div(m.netWeightGrams).toNumber()}:{...line,costPerGram:null};}));
  input.materials=await refresh(input.materials);if(input.partialRun)input.partialRun.materials=await refresh(input.partialRun.materials);
  if(input.printerId){const [p]=await db.select().from(printersTable).where(and(eq(printersTable.id,input.printerId),eq(printersTable.userId,userId)));if(p&&p.active){Object.assign(input,{machinePurchaseValue:p.purchaseValue,machineResidualValue:p.residualValue,machineUsefulLifeHours:p.usefulLifeHours,machineMaintenancePerHour:p.maintenancePerHour});if(input.measuredKwh===null)input.averagePowerWatts=p.averagePowerWatts;}else input.machineUsefulLifeHours=null;}
  if(settings)Object.assign(input,{energyRate:settings.energyRate,hourlyLaborRate:settings.hourlyLaborRate,monthlyFixedExpenses:settings.monthlyFixedExpenses,productiveHoursMonthly:settings.productiveHoursMonthly});
  res.json({...product,input});
});
router.get('/stale-products',async(_req,res)=>{
  const userId=own(res);const [products,materials,printers,settings]=await Promise.all([db.select().from(productsTable).where(eq(productsTable.userId,userId)),db.select().from(materialsTable).where(eq(materialsTable.userId,userId)),db.select().from(printersTable).where(eq(printersTable.userId,userId)),db.select().from(pricingSettingsTable).where(eq(pricingSettingsTable.userId,userId))]);
  res.json(products.filter(p=>{const input=p.input as unknown as PricingInput;return (settings[0]?.updatedAt?.getTime()??0)>p.updatedAt.getTime()||materials.some(m=>input.materials?.some(l=>l.materialId===m.id)&&m.updatedAt>p.updatedAt)||printers.some(m=>input.printerId===m.id&&m.updatedAt>p.updatedAt);}).map(p=>({id:p.id,name:p.name})));
});
router.post('/wholesale',async(req,res)=>{
  const body=z.object({input:pricingSchema,tiers:z.array(z.object({quantity:z.number().int().positive().max(1000000),margin:rate})).max(20),channel:channelSchema.optional()}).parse(req.body);
  await assertOwnership(body.input,own(res));
  const [settings]=await db.select().from(pricingSettingsTable).where(eq(pricingSettingsTable.userId,own(res)));
  const retail=calculatePricing(body.input).channels[0]?.recommendedPerUnit;
  res.json(body.tiers.map(t=>{const c=body.channel;const input={...body.input,quantity:t.quantity,desiredMargin:t.margin,pricingMode:'margin' as const,partialRun:null,practicedUnitPrice:null,percentFees:c?c.percentFees+c.taxPercent:settings?.wholesaleFeePercent??body.input.percentFees,fixedFeePerOrder:c?.fixedFeePerOrder??settings?.wholesaleFeePerOrder??body.input.fixedFeePerOrder,fixedFeePerUnit:c?.fixedFeePerUnit??settings?.wholesaleFeePerUnit??body.input.fixedFeePerUnit};const result=calculatePricing(input);return {quantity:t.quantity,input,result,saving:retail&&result.complete?1-result.channels[0]!.recommendedPerUnit!/retail:null};}));
});
const quoteLine=z.object({productId:z.number().int().positive().nullable().optional(),productName:z.string().trim().min(1).max(200),quantity:z.number().int().positive().max(1000000),unitPrice:num.max(1e9),input:pricingSchema.optional()});
const quoteSchema=z.object({customerName:z.string().max(200).nullable(),productName:z.string().max(200).optional(),quantity:z.number().int().positive().max(1000000).optional(),unitPrice:num.optional(),items:z.array(quoteLine).min(1).max(100).optional(),status:z.enum(['draft','sent','approved','rejected','expired']).default('draft'),validUntil:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),notes:z.string().max(5000),discountPercent:rate.default(0),input:pricingSchema.optional()});
router.post('/quotes',async(req,res)=>{
  const body=quoteSchema.parse(req.body),userId=own(res);
  if(body.validUntil&&Number.isNaN(Date.parse(body.validUntil)))throw new HttpError(400,'Validade inválida.');
  const lines=body.items??[quoteLine.parse({productName:body.productName,quantity:body.quantity,unitPrice:body.unitPrice,input:body.input})];
  const snapshots=[];
  for(const line of lines){let input=line.input;
    if(line.productId){const [p]=await db.select().from(productsTable).where(and(eq(productsTable.id,line.productId),eq(productsTable.userId,userId)));if(!p)throw new HttpError(404,'Produto não encontrado nesta conta.');input??=pricingSchema.parse(p.input);}
    if(input){input={...input,quantity:line.quantity,practicedUnitPrice:new Decimal(line.unitPrice).mul(new Decimal(1).minus(body.discountPercent)).toNumber()};await assertOwnership(input,userId);}
    const calculation=input?calculatePricing(input):null;
    if(calculation&&!calculation.complete)throw new HttpError(400,'Complete a precificação antes de gerar o orçamento.');
    snapshots.push({...line,input,calculation,lineTotal:new Decimal(line.unitPrice).mul(line.quantity).mul(new Decimal(1).minus(body.discountPercent)).toDecimalPlaces(2).toNumber()});
  }
  const [settings]=await db.select().from(pricingSettingsTable).where(eq(pricingSettingsTable.userId,userId));const [prefs]=await db.select().from(preferencesTable).where(eq(preferencesTable.userId,userId));
  const total=snapshots.reduce((s,l)=>s.plus(l.lineTotal),new Decimal(0)).toNumber();
  const [row]=await db.insert(quotesTable).values({userId,customerName:body.customerName,productName:lines.map(l=>l.productName).join(', '),quantity:lines.reduce((s,l)=>s+l.quantity,0),unitPrice:lines.length===1?lines[0]!.unitPrice:0,total,status:'draft',validUntil:body.validUntil,notes:body.notes,snapshot:{engineVersion:ENGINE_VERSION,items:snapshots,discountPercent:body.discountPercent,companyName:settings?.companyName??'Nativos 3D',companyDetails:prefs?.data.companyDetails??'',logoUrl:prefs?.data.logoUrl??'',settings:settings??null}}).returning();res.status(201).json(row);
});
router.get('/quotes',async(_req,res)=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await db.update(quotesTable).set({status:'expired'}).where(and(eq(quotesTable.userId,own(res)),sql`${quotesTable.validUntil} < ${today}::date`,sql`${quotesTable.status} IN ('draft','sent')`));
  res.json(await db.select().from(quotesTable).where(eq(quotesTable.userId,own(res))).orderBy(desc(quotesTable.createdAt)));
});
router.get('/quotes/:id',async(req,res)=>{const [row]=await db.select().from(quotesTable).where(and(eq(quotesTable.id,id(req)),eq(quotesTable.userId,own(res))));if(!row)throw new HttpError(404,'Orçamento não encontrado.');res.json(row);});
router.patch('/quotes/:id',async(req,res)=>{const body=z.object({status:z.enum(['draft','sent','approved','rejected','expired'])}).parse(req.body);const [row]=await db.update(quotesTable).set(body).where(and(eq(quotesTable.id,id(req)),eq(quotesTable.userId,own(res)))).returning();if(!row)throw new HttpError(404,'Orçamento não encontrado.');res.json(row);});
router.get('/quotes/:id/pdf',async(req,res)=>{
  const [quote]=await db.select().from(quotesTable).where(and(eq(quotesTable.id,id(req)),eq(quotesTable.userId,own(res))));if(!quote)throw new HttpError(404,'Orçamento não encontrado.');
  const internal=req.query.internal==='1',snap=quote.snapshot as any;
  const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
  const doc=new PDFDocument({size:'A4',margin:48});const chunks:Buffer[]=[];doc.on('data',c=>chunks.push(c));
  const completed=new Promise<Buffer>((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  doc.fontSize(23).fillColor('#090B10').text(snap?.companyName??'Nativos 3D');doc.fontSize(10).fillColor('#64748B').text(String(snap?.companyDetails??''));
  if(snap?.logoUrl){try{doc.image(Buffer.from(String(snap.logoUrl).split(',')[1]!, 'base64'),450,48,{fit:[90,50]});}catch{/* Invalid historical logo must not prevent exporting a quote. */}}
  doc.moveDown().fontSize(18).fillColor('#FF6B00').text(`${internal?'RELATÓRIO INTERNO':'ORÇAMENTO'} #${quote.id}`);
  doc.moveDown().fontSize(11).fillColor('#090B10').text(`Cliente: ${quote.customerName||'Não informado'}`).text(`Validade: ${quote.validUntil?.split('-').reverse().join('/')??'Não informada'}`);doc.moveDown();
  const lines=snap?.items??[{productName:quote.productName,quantity:quote.quantity,unitPrice:quote.unitPrice,lineTotal:quote.total}];
  for(const line of lines){doc.fontSize(12).text(line.productName);doc.fontSize(10).text(`${line.quantity} un. x ${money(line.unitPrice)} — Subtotal: ${money(line.lineTotal)}`);if(internal&&line.calculation){doc.text(`Custo completo: ${money(line.calculation.completeCost)}; versão ${snap.engineVersion}`);for(const cost of line.calculation.costs)doc.text(`${cost.label}: ${money(cost.amount)}`);const actual=line.calculation.channels.find((c:any)=>c.channel==='Preço praticado');if(actual)doc.text(`Resultado estimado: ${money(actual.estimatedResult)}; margem: ${actual.estimatedMargin===null?'—':(actual.estimatedMargin*100).toFixed(2)+'%'}`);}doc.moveDown();}
  if(snap?.discountPercent)doc.text(`Desconto: ${(snap.discountPercent*100).toFixed(2)}% (incluído nos subtotais)`);
  doc.fontSize(19).text(`Total: ${money(quote.total)}`);doc.moveDown().fontSize(10).text(quote.notes||'');doc.end();
  const data=await completed;res.type('application/pdf').setHeader('Content-Disposition',`attachment; filename="${internal?'interno':'orcamento'}-${quote.id}.pdf"`);res.send(data);
});
router.get('/stock',async(_req,res)=>{
  const userId=own(res);const [materials,products,movements]=await Promise.all([db.select().from(materialsTable).where(eq(materialsTable.userId,userId)),db.select().from(productsTable).where(eq(productsTable.userId,userId)),db.select().from(stockMovementsTable).where(eq(stockMovementsTable.userId,userId)).orderBy(desc(stockMovementsTable.createdAt))]);
  res.json({materials,products:products.map(p=>({...p,stock:movements.filter(m=>m.productId===p.id).reduce((s,m)=>s+m.amount,0)})),movements});
});
const movementSchema=z.object({key:z.string().uuid(),materialId:z.number().int().positive().optional(),productId:z.number().int().positive().optional(),amount:z.number().finite().min(-1e12).max(1e12).refine(n=>n!==0),reason:z.string().trim().min(3).max(500)}).refine(x=>!!x.materialId!==!!x.productId,'Selecione material OU produto.');
router.post('/stock/movements',async(req,res)=>{
  const data=movementSchema.parse(req.body),userId=own(res);
  const result=await db.transaction(async tx=>{
    const [operation]=await tx.insert(operationsTable).values({userId,key:data.key,kind:'stock',payload:data}).onConflictDoNothing().returning();
    if(!operation){const [old]=await tx.select().from(operationsTable).where(and(eq(operationsTable.userId,userId),eq(operationsTable.key,data.key)));if(!isDeepStrictEqual(old?.payload,data))throw new HttpError(409,'Chave já usada em outra operação.');return {replayed:true};}
    if(data.materialId){const [m]=await tx.update(materialsTable).set({stockGrams:sql`${materialsTable.stockGrams}+${data.amount}`}).where(and(eq(materialsTable.id,data.materialId),eq(materialsTable.userId,userId),sql`${materialsTable.stockGrams}+${data.amount} >= 0`)).returning();if(!m)throw new HttpError(409,'Material indisponível ou estoque insuficiente.');}
    else {await tx.execute(sql`SELECT id FROM pricing_products WHERE id=${data.productId!} AND user_id=${userId} FOR UPDATE`);const [p]=await tx.select().from(productsTable).where(and(eq(productsTable.id,data.productId!),eq(productsTable.userId,userId)));if(!p)throw new HttpError(404,'Produto não encontrado.');if(!Number.isInteger(data.amount))throw new HttpError(400,'Quantidade de produtos deve ser inteira.');const [balance]=await tx.select({total:sql<string>`coalesce(sum(${stockMovementsTable.amount}),0)`}).from(stockMovementsTable).where(and(eq(stockMovementsTable.userId,userId),eq(stockMovementsTable.productId,data.productId!)));if(Number(balance?.total??0)+data.amount<0)throw new HttpError(409,'Estoque de produtos insuficiente.');}
    await tx.insert(stockMovementsTable).values({userId,operationKey:data.key,materialId:data.materialId,productId:data.productId,amount:data.amount,reason:data.reason});return {replayed:false};
  });res.status(201).json(result);
});
router.post('/production',async(req,res)=>{
  const data=z.object({key:z.string().uuid(),productId:z.number().int().positive(),goodUnits:z.number().int().positive().max(1000000),notes:z.string().max(500).default(''),consumption:z.array(z.object({materialId:z.number().int().positive(),grams:num,failedGrams:num})).min(1).max(100)}).parse(req.body),userId=own(res);
  const result=await db.transaction(async tx=>{
    const [operation]=await tx.insert(operationsTable).values({userId,key:data.key,kind:'production',payload:data}).onConflictDoNothing().returning();if(!operation){const [old]=await tx.select().from(operationsTable).where(and(eq(operationsTable.userId,userId),eq(operationsTable.key,data.key)));if(!isDeepStrictEqual(old?.payload,data))throw new HttpError(409,'Chave já usada em outra operação.');return {replayed:true};}
    const [p]=await tx.select().from(productsTable).where(and(eq(productsTable.id,data.productId),eq(productsTable.userId,userId)));if(!p)throw new HttpError(404,'Produto não encontrado.');
    const totals=new Map<number,Decimal>();for(const line of data.consumption)totals.set(line.materialId,(totals.get(line.materialId)??new Decimal(0)).plus(line.grams).plus(line.failedGrams));
    for(const [materialId,amount] of [...totals.entries()].sort((a,b)=>a[0]-b[0])){const [m]=await tx.update(materialsTable).set({stockGrams:sql`${materialsTable.stockGrams}-${amount.toString()}`}).where(and(eq(materialsTable.id,materialId),eq(materialsTable.userId,userId),sql`${materialsTable.stockGrams} >= ${amount.toString()}`)).returning();if(!m)throw new HttpError(409,'Estoque de filamento insuficiente ou material não encontrado.');await tx.insert(stockMovementsTable).values({userId,materialId,amount:amount.negated().toNumber(),operationKey:data.key,reason:`Produção de ${p.name}. ${data.notes}`});}
    await tx.insert(stockMovementsTable).values({userId,productId:data.productId,amount:data.goodUnits,operationKey:data.key,reason:'Produção concluída: peças aprovadas'});return {replayed:false};
  });res.status(201).json(result);
});
router.get('/production',async(_req,res)=>res.json(await db.select().from(operationsTable).where(and(eq(operationsTable.userId,own(res)),eq(operationsTable.kind,'production'))).orderBy(desc(operationsTable.createdAt))));
router.get('/audit/:entity/:id',async(req,res)=>{res.json(await db.select().from(auditTable).where(and(eq(auditTable.userId,own(res)),eq(auditTable.entity,String(req.params.entity)),eq(auditTable.entityId,id(req)))).orderBy(desc(auditTable.createdAt)));});
export default router;
