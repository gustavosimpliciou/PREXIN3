import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type RoundingPolicy = "cent" | "half" | "whole" | "ending90" | "ending99";
export type WasteMode = "none" | "grams" | "percent";

export interface PricingMaterialLine {
  materialId: number | null;
  name: string;
  costPerGram: number | null;
  usefulGrams: number;
  supportsGrams: number;
  brimGrams: number;
  purgeGrams: number;
  wasteMode: WasteMode;
  wasteValue: number;
  slicerTotalGrams: number | null;
}

export interface PricingInput {
  name: string;
  quantity: number;
  piecesPerRun: number;
  materials: PricingMaterialLine[];
  printMinutes: number | null;
  setupMinutesPerRun: number;
  finishingMinutesPerUnit: number;
  jobPrepMinutes: number;
  printerId: number | null;
  averagePowerWatts: number | null;
  measuredKwh: number | null;
  energyRate: number | null;
  machinePurchaseValue: number | null;
  machineResidualValue: number | null;
  machineUsefulLifeHours: number | null;
  machineMaintenancePerHour: number | null;
  machineEnabled: boolean;
  hourlyLaborRate: number | null;
  monthlyFixedExpenses: number | null;
  productiveHoursMonthly: number | null;
  failureRate: number | null;
  packagePerUnit: number;
  packagePerOrder: number;
  componentsPerUnit: number;
  licensePerUnit: number;
  licensePerOrder: number;
  sellerShipping: number;
  otherPerUnit: number;
  otherPerOrder: number;
  percentFees: number;
  fixedFeePerOrder: number;
  fixedFeePerUnit: number;
  desiredMargin: number;
  rounding: RoundingPolicy;
  practicedUnitPrice: number | null;
  pricingMode?: "margin" | "markup";
  markup?: number;
  channelName?: string;
  partialRun?: { printMinutes: number; measuredKwh: number | null; materials: PricingMaterialLine[] } | null;
  additionalCosts?: { name: string; amount: number; incidence: "unit" | "order" }[];
  legacyAdditional?: number;
}

export interface PricingCostLine {
  label: string;
  amount: number;
}

export interface PricingChannelPrice {
  channel: string;
  breakEvenPerUnit: number | null;
  recommendedPerUnit: number | null;
  total: number | null;
  estimatedResult: number | null;
  estimatedMargin: number | null;
}

export interface PricingCalculation {
  complete: boolean;
  missing: string[];
  errors: string[];
  quantity: number;
  runs: number;
  manufacturingCost: number | null;
  completeCost: number | null;
  unitCost: number | null;
  materialGrams: number | null;
  costs: PricingCostLine[];
  channels: PricingChannelPrice[];
  legacyComparison: {
    cost: number | null;
    legacyMinimum: number | null;
    legacyWholesale: number | null;
    legacyMarketplace: number | null;
  };
  assumptions: string[];
}

export const ENGINE_VERSION = '2.0.0';
const D = (value: number | string) => new Decimal(value);
export function parseBrazilianNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  let normalized = value.trim().replace(/^R\$\s*/, '').replace(/\s/g, '');
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const result = Number(normalized); return Number.isFinite(result) ? result : null;
}
export const emptyMaterial = (): PricingMaterialLine => ({ materialId: null, name: '', costPerGram: null, usefulGrams: 0, supportsGrams: 0, brimGrams: 0, purgeGrams: 0, wasteMode: 'none', wasteValue: 0, slicerTotalGrams: null });
export const emptyPricingInput = (): PricingInput => ({
  name: '', quantity: 1, piecesPerRun: 1, materials: [emptyMaterial()], printMinutes: null,
  setupMinutesPerRun: 0, finishingMinutesPerUnit: 0, jobPrepMinutes: 0, printerId: null,
  averagePowerWatts: null, measuredKwh: null, energyRate: null, machinePurchaseValue: null,
  machineResidualValue: null, machineUsefulLifeHours: null, machineMaintenancePerHour: null,
  machineEnabled: false, hourlyLaborRate: null, monthlyFixedExpenses: null, productiveHoursMonthly: null,
  failureRate: null, packagePerUnit: 0, packagePerOrder: 0, componentsPerUnit: 0,
  licensePerUnit: 0, licensePerOrder: 0, sellerShipping: 0, otherPerUnit: 0, otherPerOrder: 0,
  percentFees: 0, fixedFeePerOrder: 0, fixedFeePerUnit: 0, desiredMargin: 0,
  rounding: 'cent', practicedUnitPrice: null, pricingMode: 'margin', markup: 2,
});
export function ceilPrice(value: Decimal, policy: RoundingPolicy): Decimal {
  if (policy === 'cent') return value.toDecimalPlaces(2, Decimal.ROUND_CEIL);
  if (policy === 'half') return value.mul(2).ceil().div(2);
  if (policy === 'whole') return value.ceil();
  const ending = D(policy === 'ending90' ? '.90' : '.99');
  const candidate = value.floor().plus(ending);
  return candidate.gte(value) ? candidate : candidate.plus(1);
}
export function materialConsumption(line: PricingMaterialLine): Decimal {
  if (line.slicerTotalGrams !== null) return D(line.slicerTotalGrams);
  return D(line.usefulGrams).plus(line.supportsGrams).plus(line.brimGrams).plus(line.purgeGrams)
    .plus(line.wasteMode === 'grams' ? line.wasteValue : line.wasteMode === 'percent' ? D(line.usefulGrams).mul(line.wasteValue) : 0);
}
export function calculatePricing(input: PricingInput): PricingCalculation {
  const errors: string[] = [], missing: string[] = [], assumptions: string[] = [];
  const fail = (): PricingCalculation => ({ complete: false, missing: [...new Set(missing)], errors: [...new Set(errors)], quantity: Number.isSafeInteger(input?.quantity) ? input.quantity : 0, runs: 0, manufacturingCost: null, completeCost: null, unitCost: null, materialGrams: null, costs: [], channels: [], legacyComparison: { cost: null, legacyMinimum: null, legacyWholesale: null, legacyMarketplace: null }, assumptions });
  const check = (value: unknown, label: string, required = true) => {
    if (value === null || value === undefined) { if (required) missing.push(`Informe ${label}.`); return; }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) errors.push(`Revise ${label}: use um número não negativo e finito.`);
  };
  if (!input || typeof input !== 'object') { errors.push('Informe os dados de produção.'); return fail(); }
  const fields: [keyof PricingInput, string][] = [
    ['quantity','a quantidade'],['piecesPerRun','as peças por execução'],['printMinutes','a duração da impressão'],
    ['setupMinutesPerRun','o preparo por execução'],['finishingMinutesPerUnit','o acabamento'],['jobPrepMinutes','o preparo único'],
    ['energyRate','a tarifa de energia'],['hourlyLaborRate','o valor da hora de trabalho'],['monthlyFixedExpenses','as despesas fixas mensais'],
    ['packagePerUnit','a embalagem unitária'],['packagePerOrder','a embalagem por pedido'],['componentsPerUnit','os componentes'],
    ['licensePerUnit','a licença por unidade'],['licensePerOrder','a licença por pedido'],['sellerShipping','o frete subsidiado'],
    ['otherPerUnit','os adicionais unitários'],['otherPerOrder','os adicionais por pedido'],['percentFees','as taxas percentuais'],
    ['fixedFeePerOrder','a taxa por pedido'],['fixedFeePerUnit','a taxa por unidade'],['desiredMargin','a margem'],
  ];
  for (const [field,label] of fields) check(input[field],label);
  for (const key of ['averagePowerWatts','measuredKwh','productiveHoursMonthly','failureRate','practicedUnitPrice','legacyAdditional'] as const) check(input[key],key,false);
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 || input.quantity > 1000000) errors.push('Quantidade deve ser inteira, entre 1 e 1.000.000.');
  if (!Number.isSafeInteger(input.piecesPerRun) || input.piecesPerRun <= 0) errors.push('Peças por execução deve ser um inteiro positivo.');
  if ((input.failureRate ?? 0) >= 1) errors.push('A taxa de falha deve ser menor que 100%.');
  if (input.percentFees >= 1 || (input.pricingMode !== 'markup' && D(input.percentFees || 0).plus(input.desiredMargin || 0).gte(1))) errors.push('A soma das taxas e da margem deve ser menor que 100%.');
  if (input.pricingMode === 'markup') { check(input.markup,'o multiplicador'); if ((input.markup ?? 0) <= 0) errors.push('Multiplicador deve ser positivo.'); }
  if (!['cent','half','whole','ending90','ending99'].includes(input.rounding)) errors.push('Selecione um arredondamento válido.');
  if (input.averagePowerWatts !== null && input.measuredKwh !== null) errors.push('Escolha potência média OU consumo medido.');
  if (input.averagePowerWatts === null && input.measuredKwh === null) missing.push('Informe a potência média ou o consumo medido.');
  if (input.machineEnabled) {
    for (const key of ['machinePurchaseValue','machineResidualValue','machineUsefulLifeHours','machineMaintenancePerHour'] as const) check(input[key],key);
    if ((input.machineUsefulLifeHours ?? 0) <= 0) errors.push('Vida útil da máquina deve ser positiva.');
    if ((input.machineResidualValue ?? 0) > (input.machinePurchaseValue ?? 0)) errors.push('Valor residual não pode superar a aquisição.');
  } else assumptions.push('Custo de máquina desativado explicitamente.');
  if ((input.monthlyFixedExpenses ?? 0) > 0 && (input.productiveHoursMonthly ?? 0) <= 0) missing.push('Informe horas produtivas mensais positivas para alocar despesas fixas.');
  const validateMaterials = (lines: PricingMaterialLine[], prefix: string) => {
    if (!Array.isArray(lines) || !lines.length) { missing.push(`Informe ao menos um material ${prefix}.`); return; }
    for (const [i,line] of lines.entries()) {
      if (!line || typeof line !== 'object') { errors.push('Material inválido.'); continue; }
      check(line.costPerGram,`o custo por grama do material ${i+1} ${prefix}`);
      if (!['none','grams','percent'].includes(line.wasteMode)) errors.push('Selecione uma perda válida.');
      if (line.slicerTotalGrams !== null) check(line.slicerTotalGrams,`o consumo do fatiador ${prefix}`);
      else for (const key of ['usefulGrams','supportsGrams','brimGrams','purgeGrams','wasteValue'] as const) check(line[key],`o peso ${key} do material ${i+1}`);
    }
  };
  validateMaterials(input.materials,'por execução');
  const remainder = input.quantity % input.piecesPerRun;
  if (input.partialRun && remainder) {
    check(input.partialRun.printMinutes,'o tempo do lote parcial');
    validateMaterials(input.partialRun.materials,'no lote parcial');
    if (input.measuredKwh !== null) check(input.partialRun.measuredKwh,'o consumo medido do lote parcial');
  }
  for (const extra of input.additionalCosts ?? []) { check(extra.amount,extra.name || 'o adicional'); if (!extra.name?.trim() || !['unit','order'].includes(extra.incidence)) errors.push('Informe nome e incidência de cada adicional.'); }
  if (missing.length || errors.length) return fail();
  const fullRuns = input.partialRun && remainder ? Math.floor(input.quantity/input.piecesPerRun) : Math.ceil(input.quantity/input.piecesPerRun);
  const partial = !!input.partialRun && remainder > 0;
  const runs = fullRuns + (partial ? 1 : 0);
  if (!partial && remainder) assumptions.push(`Lote final completo: ${runs*input.piecesPerRun-input.quantity} peça(s) excedente(s) cobradas no pedido; entrada em estoque apenas na produção.`);
  const materialsCost = (lines: PricingMaterialLine[]) => lines.reduce((sum,line)=>sum.plus(materialConsumption(line).mul(line.costPerGram!)),D(0));
  const gramsFor = (lines: PricingMaterialLine[]) => lines.reduce((sum,line)=>sum.plus(materialConsumption(line)),D(0));
  const material = materialsCost(input.materials).mul(fullRuns).plus(partial ? materialsCost(input.partialRun!.materials) : 0);
  const grams = gramsFor(input.materials).mul(fullRuns).plus(partial ? gramsFor(input.partialRun!.materials) : 0);
  const hours = D(input.printMinutes!).mul(fullRuns).plus(partial ? input.partialRun!.printMinutes : 0).div(60);
  const kwh = input.measuredKwh !== null ? D(input.measuredKwh).mul(fullRuns).plus(partial ? input.partialRun!.measuredKwh! : 0) : hours.mul(input.averagePowerWatts!).div(1000);
  const energy = kwh.mul(input.energyRate!);
  const machine = input.machineEnabled ? D(input.machinePurchaseValue!).minus(input.machineResidualValue!).div(input.machineUsefulLifeHours!).plus(input.machineMaintenancePerHour!).mul(hours) : D(0);
  const setup = D(input.setupMinutesPerRun).mul(runs).div(60).mul(input.hourlyLaborRate!);
  const factor = D(1).div(D(1).minus(input.failureRate ?? 0));
  const repeated = material.plus(energy).plus(machine).plus(setup);
  const risk = repeated.mul(factor.minus(1));
  const finishing = D(input.finishingMinutesPerUnit).mul(input.quantity).div(60).mul(input.hourlyLaborRate!);
  const manufacturing = repeated.mul(factor).plus(finishing);
  const overhead = input.monthlyFixedExpenses! > 0 ? D(input.monthlyFixedExpenses!).div(input.productiveHoursMonthly!).mul(hours).mul(factor) : D(0);
  const job = D(input.jobPrepMinutes).div(60).mul(input.hourlyLaborRate!);
  const extras = D(input.packagePerUnit).plus(input.componentsPerUnit).plus(input.licensePerUnit).plus(input.otherPerUnit).mul(input.quantity)
    .plus(input.packagePerOrder).plus(input.licensePerOrder).plus(input.sellerShipping).plus(input.otherPerOrder);
  const namedExtras = (input.additionalCosts ?? []).reduce((sum,x)=>sum.plus(D(x.amount).mul(x.incidence === 'unit' ? input.quantity : 1)),D(0));
  const completeCost = manufacturing.plus(overhead).plus(job).plus(extras).plus(namedExtras);
  const costEntries: [string,Decimal][] = [['Material',material],['Energia',energy],['Máquina',machine],['Preparação por execução',setup],['Provisão de falhas',risk],['Acabamento',finishing],['Alocação estimada de despesas fixas',overhead],['Preparação única do pedido',job],['Embalagens, componentes e outros',extras],...(input.additionalCosts ?? []).map(x=>[x.name,D(x.amount).mul(x.incidence === 'unit' ? input.quantity : 1)] as [string,Decimal])];
  const fixedFees = D(input.fixedFeePerOrder).plus(D(input.fixedFeePerUnit).mul(input.quantity));
  const equilibrium = completeCost.plus(fixedFees).div(D(1).minus(input.percentFees)).div(input.quantity);
  const unrounded = input.pricingMode === 'markup' ? completeCost.mul(input.markup!).div(input.quantity) : completeCost.plus(fixedFees).div(D(1).minus(input.percentFees).minus(input.desiredMargin)).div(input.quantity);
  const recommended = ceilPrice(unrounded,input.rounding);
  const channel = (name:string,price:Decimal): PricingChannelPrice => {
    const total = price.mul(input.quantity), result = total.mul(D(1).minus(input.percentFees)).minus(fixedFees).minus(completeCost);
    return { channel:name, breakEvenPerUnit:equilibrium.toNumber(), recommendedPerUnit:price.toNumber(), total:total.toNumber(), estimatedResult:result.toNumber(), estimatedMargin:total.gt(0) ? result.div(total).toNumber() : null };
  };
  const channels = [channel(input.channelName || 'Canal informado',recommended)];
  if (input.practicedUnitPrice !== null) channels.push(channel('Preço praticado',D(input.practicedUnitPrice)));
  if (channels.some(c=>(c.estimatedResult ?? 0)<0)) assumptions.push('Preço abaixo do equilíbrio: o pedido apresenta resultado estimado negativo.');
  if ((input.failureRate ?? 0)>0) assumptions.push('Considera reposição integral de execuções malsucedidas.');
  if (input.monthlyFixedExpenses!>0) assumptions.push('Alocação estimada de despesas fixas; exclua custos já cobrados diretamente.');
  if (input.pricingMode === 'markup') assumptions.push('Multiplicador não é margem: multiplicar por 2 não significa margem de 100%.');
  const legacy = input.materials.reduce((sum,line)=>sum.plus(D(line.usefulGrams).mul('1.03').mul(line.costPerGram!)),D(0)).mul(fullRuns)
    .plus(partial ? input.partialRun!.materials.reduce((sum,line)=>sum.plus(D(line.usefulGrams).mul('1.03').mul(line.costPerGram!)),D(0)) : 0).plus(D(input.legacyAdditional ?? 0).mul(input.quantity));
  assumptions.push('Comparação legada: peso útil + 3%, custo do filamento e adicionais legados; não inclui tempo nem taxas.');
  return { complete:true,missing:[],errors:[],quantity:input.quantity,runs,manufacturingCost:manufacturing.toNumber(),completeCost:completeCost.toNumber(),unitCost:completeCost.div(input.quantity).toNumber(),materialGrams:grams.toNumber(),costs:costEntries.map(([label,amount])=>({label,amount:amount.toNumber()})),channels,legacyComparison:{cost:legacy.toNumber(),legacyMinimum:legacy.mul(3).toNumber(),legacyWholesale:legacy.mul(4).toNumber(),legacyMarketplace:legacy.mul(8).toNumber()},assumptions };
}
