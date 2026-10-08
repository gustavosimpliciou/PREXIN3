import { z } from 'zod';
import { CalculatePricingBody } from '@workspace/api-zod';
export const num = z.number().finite().nonnegative().max(1e12);
const material = CalculatePricingBody.shape.materials.element;
export const pricingSchema = CalculatePricingBody.extend({
  pricingMode:z.enum(['margin','markup']).optional(), markup:num.positive().optional(), channelName:z.string().max(100).optional(),
  partialRun:z.object({printMinutes:num,measuredKwh:num.nullable(),materials:z.array(material).min(1).max(100)}).nullable().optional(),
  additionalCosts:z.array(z.object({name:z.string().trim().min(1).max(100),amount:num,incidence:z.enum(['unit','order'])})).max(100).optional(),
  legacyAdditional:num.optional(),
});
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function requireId(value:unknown) { const parsed=z.coerce.number().int().positive().safeParse(value);if(!parsed.success) throw new HttpError(400,'Identificador inválido.');return parsed.data; }
