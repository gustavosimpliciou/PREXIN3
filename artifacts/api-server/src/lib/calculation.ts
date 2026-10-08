import { and,eq } from 'drizzle-orm';
import { db, materialsTable, printersTable, pricingSettingsTable } from '@workspace/db';
import { calculatePricing, type PricingInput } from '@workspace/pricing-engine';
import { HttpError } from './validation';
export async function assertOwnership(input:PricingInput,userId:string) {
  const ids=new Set([...input.materials,...(input.partialRun?.materials ?? [])].flatMap(m=>m.materialId===null?[]:[m.materialId]));
  for(const id of ids) {const [row]=await db.select({id:materialsTable.id}).from(materialsTable).where(and(eq(materialsTable.userId,userId),eq(materialsTable.id,id)));if(!row)throw new HttpError(404,'Material não encontrado nesta conta.');}
  if(input.printerId!==null){const [row]=await db.select({id:printersTable.id}).from(printersTable).where(and(eq(printersTable.userId,userId),eq(printersTable.id,input.printerId)));if(!row)throw new HttpError(404,'Impressora não encontrada nesta conta.');}
}
export async function calculationFor(input:PricingInput,userId:string) {
  await assertOwnership(input,userId);
  const result=calculatePricing(input);
  if(!result.complete)return result;
  result.channels[0]!.channel=input.channelName || 'Venda direta';
  const [settings]=await db.select().from(pricingSettingsTable).where(eq(pricingSettingsTable.userId,userId));
  if(settings)for(const [name,prefix] of [['Atacado','wholesale'],['Marketplace','marketplace']] as const) {
    const other=calculatePricing({...input,channelName:name,practicedUnitPrice:null,desiredMargin:settings[`${prefix}Margin`],percentFees:settings[`${prefix}FeePercent`],fixedFeePerOrder:settings[`${prefix}FeePerOrder`],fixedFeePerUnit:settings[`${prefix}FeePerUnit`]});
    if(other.complete)result.channels.push(other.channels[0]!);else result.assumptions.push(`${name}: ${other.errors.concat(other.missing).join(' ')}`);
  }
  return result;
}
