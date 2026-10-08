import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { and,eq } from 'drizzle-orm';
import { db,operationsTable,productsTable,productVersionsTable,materialsTable,stockMovementsTable } from '@workspace/db';
import { emptyPricingInput,emptyMaterial } from '@workspace/pricing-engine';
import { HttpError,num } from '../lib/validation';
import { parseWorkbook,type ImportPreview } from '../lib/import-workbook';
const router=Router();
router.post('/imports/preview',async(req,res)=>{
  const {base64}=z.object({base64:z.string().max(7*1024*1024)}).parse(req.body);let preview:ImportPreview;try{preview=await parseWorkbook(Buffer.from(base64,'base64'));}catch(error){throw new HttpError(400,error instanceof Error?error.message:'Arquivo inválido.');}
  const userId=res.locals.userId as string;const existing=await db.select({name:productsTable.name}).from(productsTable).where(eq(productsTable.userId,userId));const duplicates=preview.products.filter(p=>existing.some(e=>e.name.trim().toLocaleLowerCase()===p.name.toLocaleLowerCase())).map(p=>p.name);
  const key=randomUUID();await db.insert(operationsTable).values({userId,key,kind:'import_preview',payload:preview as unknown as Record<string,unknown>});res.json({...preview,token:key,duplicates});
});
router.post('/imports/confirm',async(req,res)=>{
  const data=z.object({token:z.string().uuid(),duplicateAction:z.enum(['skip','update']),stockUnit:z.enum(['skip','grams','kg','rolls']),gramsPerRoll:num.positive().optional(),confirmFullRolls:z.boolean().optional()}).parse(req.body),userId=res.locals.userId as string;
  if(data.stockUnit==='rolls'&&(!data.gramsPerRoll||!data.confirmFullRolls))throw new HttpError(400,'Informe o peso do rolo e confirme que as quantidades representam rolos completos.');
  const output=await db.transaction(async tx=>{
    await tx.execute((await import('drizzle-orm')).sql`SELECT id FROM pricing_operations WHERE user_id=${userId} AND key=${data.token} FOR UPDATE`);
    const [op]=await tx.select().from(operationsTable).where(and(eq(operationsTable.userId,userId),eq(operationsTable.key,data.token)));
    if(!op||!['import_preview','import_done'].includes(op.kind))throw new HttpError(404,'Importação não encontrada.');
    if(op.kind==='import_done')return {replayed:true};
    const preview=op.payload as unknown as ImportPreview;if(preview.errors.length)throw new HttpError(400,'Corrija os erros na planilha e gere uma nova prévia.');
    let created=0,updated=0,skipped=0;
    for(const p of preview.products){const existing=await tx.select().from(productsTable).where(eq(productsTable.userId,userId));const old=existing.find(e=>e.name.trim().toLocaleLowerCase()===p.name.toLocaleLowerCase());if(old&&data.duplicateAction==='skip'){skipped++;continue;}
      const input={...emptyPricingInput(),name:p.name,otherPerUnit:p.additional!,legacyAdditional:p.additional!,materials:[{...emptyMaterial(),name:`${p.material} ${p.brand}`.trim(),usefulGrams:p.weight!,costPerGram:p.priceKg!/1000,wasteMode:'percent' as const,wasteValue:0.03}],importReference:{sheet:p.sheet,row:p.row,legacyPrices:p.legacyPrices}};
      const values={name:p.name,category:p.category,input,status:'incomplete',calculation:null,userId};
      const [saved]=old?await tx.update(productsTable).set({...values,updatedAt:new Date()}).where(and(eq(productsTable.id,old.id),eq(productsTable.userId,userId))).returning():await tx.insert(productsTable).values(values).returning();
      await tx.insert(productVersionsTable).values({productId:saved!.id,userId,input,calculation:null});if(old)updated++;else created++;
    }
    if(data.stockUnit!=='skip')for(const m of preview.materials){if(m.quantity===null||m.quantity<0||m.priceKg===null||m.priceKg<0)throw new HttpError(400,`Estoque: revise a linha ${m.row}.`);const name=`${m.material} ${m.color}`.trim();const rows=await tx.select().from(materialsTable).where(eq(materialsTable.userId,userId));const old=rows.find(x=>x.name.toLocaleLowerCase()===name.toLocaleLowerCase());if(old&&data.duplicateAction==='skip')continue;
      const stock=m.quantity*(data.stockUnit==='grams'?1:data.stockUnit==='kg'?1000:data.gramsPerRoll!);const values={name,type:m.material,color:m.color,brand:'',supplier:'',netWeightGrams:1000,purchaseValue:m.priceKg,allocatedFreight:0,stockGrams:stock,lowStockThreshold:0,userId};
      const [saved]=old?await tx.update(materialsTable).set({...values,updatedAt:new Date()}).where(eq(materialsTable.id,old.id)).returning():await tx.insert(materialsTable).values(values).returning();
      await tx.insert(stockMovementsTable).values({userId,materialId:saved!.id,amount:stock-(old?.stockGrams??0),reason:'Saldo confirmado na importação da planilha',operationKey:data.token});
    }
    await tx.update(operationsTable).set({kind:'import_done'}).where(eq(operationsTable.id,op.id));return {created,updated,skipped,investmentReferences:preview.investments.length};
  });res.json(output);
});
router.get('/imports',async(_req,res)=>{res.json(await db.select().from(operationsTable).where(and(eq(operationsTable.userId,res.locals.userId),eq(operationsTable.kind,'import_done'))));});
export default router;
