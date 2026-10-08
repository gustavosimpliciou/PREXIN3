import { pricingSchema, HttpError } from "../lib/validation";
import { calculationFor, assertOwnership } from "../lib/calculation";
import operationsRouter from "./operations";
import { getAuth } from "@clerk/express";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { Router, type IRouter, type RequestHandler } from "express";
import {
  ArchiveMaterialParams,
  ArchivePrinterParams,
  CalculatePricingBody,
  CalculatePricingResponse,
  CreateMaterialBody,
  CreateMaterialResponse,
  CreatePrinterBody,
  CreatePrinterResponse,
  CreateProductBody,
  CreateProductResponse,
  CreateQuoteBody,
  CreateQuoteResponse,
  DeleteProductParams,
  DeleteProductResponse,
  GetDashboardResponse,
  GetProductParams,
  GetProductResponse,
  GetSettingsResponse,
  ListMaterialsResponse,
  ListPrintersResponse,
  ListProductsResponse,
  ListQuotesResponse,
  SaveSettingsBody,
  SaveSettingsResponse,
  UpdateMaterialBody,
  UpdateMaterialParams,
  UpdateMaterialResponse,
  UpdatePrinterBody,
  UpdatePrinterParams,
  UpdatePrinterResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import {
  db,
  auditTable,
  stockMovementsTable,
  materialsTable,
  printersTable,
  pricingSettingsTable,
  productVersionsTable,
  productsTable,
  quotesTable,
} from "@workspace/db";
import {
  calculatePricing,
  type PricingInput,
} from "@workspace/pricing-engine";

const router: IRouter = Router();

const requireUser: RequestHandler = (req, res, next) => {
  const userId = res.locals.userId || getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  res.locals.userId = userId;
  next();
};

const ownerId = (res: Parameters<RequestHandler>[1]) =>
  res.locals.userId as string;

const defaultSettings = {
  id: 0,
  companyName: "Nativos 3D",
  currency: "BRL" as const,
  energyRate: 0,
  hourlyLaborRate: 0,
  monthlyFixedExpenses: 0,
  productiveHoursMonthly: 0,
  directMargin: 0,
  wholesaleMargin: 0,
  marketplaceMargin: 0,
  directFeePercent: 0,
  directFeePerOrder: 0,
  directFeePerUnit: 0,
  wholesaleFeePercent: 0,
  wholesaleFeePerOrder: 0,
  wholesaleFeePerUnit: 0,
  marketplaceFeePercent: 0,
  marketplaceFeePerOrder: 0,
  marketplaceFeePerUnit: 0,
  rounding: "cent" as const,
};

function materialResponse(material: typeof materialsTable.$inferSelect) {
  const costPerGram =
    material.netWeightGrams > 0
      ? (material.purchaseValue + material.allocatedFreight) /
        material.netWeightGrams
      : 0;
  return { ...material, costPerGram };
}

function parseBody<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { message: string } } },
  body: unknown,
  res: Parameters<RequestHandler>[1],
): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data === undefined) {
    res.status(400).json({ error: parsed.error?.message ?? "Revise os campos informados." });
    return null;
  }
  return parsed.data;
}

const settingsForUser = async (userId: string) => {
  const [settings] = await db
    .select()
    .from(pricingSettingsTable)
    .where(eq(pricingSettingsTable.userId, userId))
    .limit(1);
  return settings ?? { ...defaultSettings };
};

router.use(requireUser);
router.use(operationsRouter);

router.get("/dashboard", async (_req, res): Promise<void> => {
  const userId = ownerId(res);
  const [
    [productCount],
    [materialCount],
    [printerCount],
    [quoteCount],
    lowStockMaterials,
    recentProducts,
    recentQuotes,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(materialsTable).where(and(eq(materialsTable.userId, userId), eq(materialsTable.archived, false))),
    db.select({ count: sql<number>`count(*)::int` }).from(printersTable).where(and(eq(printersTable.userId, userId), eq(printersTable.active, true))),
    db.select({ count: sql<number>`count(*)::int` }).from(quotesTable).where(eq(quotesTable.userId, userId)),
    db.select().from(materialsTable)
      .where(and(eq(materialsTable.userId, userId), eq(materialsTable.archived, false), lte(materialsTable.stockGrams, materialsTable.lowStockThreshold)))
      .orderBy(desc(materialsTable.updatedAt)).limit(5),
    db.select().from(productsTable).where(eq(productsTable.userId, userId))
      .orderBy(desc(productsTable.updatedAt)).limit(5),
    db.select().from(quotesTable).where(eq(quotesTable.userId, userId))
      .orderBy(desc(quotesTable.createdAt)).limit(5),
  ]);
  res.json(
    GetDashboardResponse.parse({
      productCount: productCount?.count ?? 0,
      materialCount: materialCount?.count ?? 0,
      printerCount: printerCount?.count ?? 0,
      quoteCount: quoteCount?.count ?? 0,
      lowStockMaterials: lowStockMaterials.map(materialResponse),
      recentProducts,
      recentQuotes,
    }),
  );
});

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await settingsForUser(ownerId(res));
  res.json(GetSettingsResponse.parse(settings));
});

router.put("/settings", async (req, res): Promise<void> => {
  const data = parseBody(SaveSettingsBody, req.body, res);
  if (!data) return;
  if (data.monthlyFixedExpenses > 0 && data.productiveHoursMonthly <= 0) {
    res.status(400).json({
      error: "Informe horas produtivas mensais quando houver despesas fixas para alocar.",
    });
    return;
  }
  for (const prefix of ['direct', 'wholesale', 'marketplace'] as const) {
    if (data[`${prefix}Margin`] + data[`${prefix}FeePercent`] >= 1) { res.status(400).json({error:'Taxas e margem devem somar menos de 100% em cada canal.'});return; }
  }
  const userId = ownerId(res);
  const [saved] = await db
    .insert(pricingSettingsTable)
    .values({ ...data, userId })
    .onConflictDoUpdate({
      target: pricingSettingsTable.userId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  res.json(SaveSettingsResponse.parse(saved));
});

router.post("/calculations", async (req, res): Promise<void> => {
  const data = parseBody(pricingSchema, req.body, res);
  if (!data) return;
  res.json(await calculationFor(data, ownerId(res)));
});

router.get("/materials", async (_req, res): Promise<void> => {
  const rows = await db.select().from(materialsTable)
    .where(and(eq(materialsTable.userId, ownerId(res)), eq(materialsTable.archived, false)))
    .orderBy(desc(materialsTable.updatedAt));
  res.json(ListMaterialsResponse.parse(rows.map(materialResponse)));
});

router.post("/materials", async (req, res): Promise<void> => {
  const data = parseBody(CreateMaterialBody, req.body, res);
  if (!data) return;
  if (data.netWeightGrams <= 0) {
    res.status(400).json({ error: "O peso líquido comprado deve ser maior que zero." });
    return;
  }
  const [row] = await db.insert(materialsTable)
    .values({ ...data, userId: ownerId(res) }).returning();
  await db.insert(stockMovementsTable).values({userId:ownerId(res),materialId:row!.id,amount:row!.stockGrams,reason:'Saldo inicial no cadastro',operationKey:crypto.randomUUID()});
  res.status(201).json(CreateMaterialResponse.parse(materialResponse(row!)));
});

router.patch("/materials/:id", async (req, res): Promise<void> => {
  const params = UpdateMaterialParams.safeParse(req.params);
  const data = parseBody(UpdateMaterialBody, req.body, res);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!data) return;
  if (data.netWeightGrams <= 0) {
    res.status(400).json({ error: "O peso líquido comprado deve ser maior que zero." });
    return;
  }
  const [previous] = await db.select().from(materialsTable).where(and(eq(materialsTable.id,params.data.id),eq(materialsTable.userId,ownerId(res))));
  if (!previous) { res.status(404).json({error:'Material não encontrado.'});return; }
  if (previous.stockGrams !== data.stockGrams) {res.status(400).json({error:'Altere o saldo em Estoque e produção, informando uma justificativa.'});return;}
  const [row] = await db.update(materialsTable).set({ ...data, updatedAt: new Date() })
    .where(and(eq(materialsTable.id, params.data.id), eq(materialsTable.userId, ownerId(res))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Material não encontrado." });
    return;
  }
  await db.insert(auditTable).values({userId:ownerId(res),entity:'material',entityId:row.id,data:{before:previous,after:row}});
  res.json(UpdateMaterialResponse.parse(materialResponse(row)));
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  const params = ArchiveMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.update(materialsTable).set({ archived: true, updatedAt: new Date() })
    .where(and(eq(materialsTable.id, params.data.id), eq(materialsTable.userId, ownerId(res))))
    .returning({ id: materialsTable.id });
  if (!row) {
    res.status(404).json({ error: "Material não encontrado." });
    return;
  }
  res.sendStatus(204);
});

router.get("/printers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(printersTable)
    .where(and(eq(printersTable.userId, ownerId(res)), eq(printersTable.active, true)))
    .orderBy(desc(printersTable.updatedAt));
  res.json(ListPrintersResponse.parse(rows));
});

router.post("/printers", async (req, res): Promise<void> => {
  const data = parseBody(CreatePrinterBody, req.body, res);
  if (!data) return;
  if (data.usefulLifeHours <= 0 || data.residualValue > data.purchaseValue) {
    res.status(400).json({ error: "O valor residual não pode superar o valor de aquisição." });
    return;
  }
  const [row] = await db.insert(printersTable).values({ ...data, userId: ownerId(res) }).returning();
  res.status(201).json(CreatePrinterResponse.parse(row));
});

router.patch("/printers/:id", async (req, res): Promise<void> => {
  const params = UpdatePrinterParams.safeParse(req.params);
  const data = parseBody(UpdatePrinterBody, req.body, res);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!data) return;
  if (data.usefulLifeHours <= 0 || data.residualValue > data.purchaseValue) {
    res.status(400).json({ error: "O valor residual não pode superar o valor de aquisição." });
    return;
  }
  const [previous] = await db.select().from(printersTable).where(and(eq(printersTable.id,params.data.id),eq(printersTable.userId,ownerId(res))));
  const [row] = await db.update(printersTable).set({ ...data, updatedAt: new Date() })
    .where(and(eq(printersTable.id, params.data.id), eq(printersTable.userId, ownerId(res))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Impressora não encontrada." });
    return;
  }
  await db.insert(auditTable).values({userId:ownerId(res),entity:'printer',entityId:row.id,data:{before:previous,after:row}});
  res.json(UpdatePrinterResponse.parse(row));
});

router.delete("/printers/:id", async (req, res): Promise<void> => {
  const params = ArchivePrinterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.update(printersTable).set({ active: false, updatedAt: new Date() })
    .where(and(eq(printersTable.id, params.data.id), eq(printersTable.userId, ownerId(res))))
    .returning({ id: printersTable.id });
  if (!row) {
    res.status(404).json({ error: "Impressora não encontrada." });
    return;
  }
  res.sendStatus(204);
});

router.get("/products", async (_req, res): Promise<void> => {
  const rows = await db.select().from(productsTable)
    .where(eq(productsTable.userId, ownerId(res)))
    .orderBy(desc(productsTable.updatedAt));
  res.json(ListProductsResponse.parse(rows));
});

router.post("/products", async (req, res): Promise<void> => {
  const data = parseBody(CreateProductBody, req.body, res);
  if (!data) return;
  const userId = ownerId(res);
  const pricing = pricingSchema.safeParse(data.input);
  if (!pricing.success) { res.status(400).json({error:'Revise os dados da precificação.',fields:pricing.error.issues});return; }
  const calculation = pricing.success ? await calculationFor(pricing.data as PricingInput, userId) : null;
  const status = calculation?.complete ? "ready" : "incomplete";
  const row = await db.transaction(async tx => {
  const [row] = await tx.insert(productsTable).values({
    name: data.name,
    sku: data.sku,
    category: data.category,
    input: data.input,
    calculation: calculation as unknown as Record<string, unknown> | null,
    status,
    userId,
  }).returning();
  await tx.insert(productVersionsTable).values({
    productId: row!.id,
    userId,
    input: data.input,
    calculation: calculation as unknown as Record<string, unknown> | null,
  });
  return row;
  });
  res.status(201).json(CreateProductResponse.parse(row));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.userId, ownerId(res))))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  res.json(GetProductResponse.parse(row));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const data = parseBody(UpdateProductBody, req.body, res);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!data) return;
  const userId = ownerId(res);
  const pricing = pricingSchema.safeParse(data.input);
  if (!pricing.success) { res.status(400).json({error:'Revise os dados da precificação.',fields:pricing.error.issues});return; }
  const calculation = pricing.success ? await calculationFor(pricing.data as PricingInput, userId) : null;
  const row = await db.transaction(async tx => {
  const [row] = await tx.update(productsTable).set({
    name: data.name,
    sku: data.sku,
    category: data.category,
    input: data.input,
    calculation: calculation as unknown as Record<string, unknown> | null,
    status: calculation?.complete ? "ready" : "incomplete",
    updatedAt: new Date(),
  }).where(and(eq(productsTable.id, params.data.id), eq(productsTable.userId, userId))).returning();
  if (!row) {
    throw new HttpError(404,"Produto não encontrado.");
  }
  await tx.insert(productVersionsTable).values({
    productId: row.id,
    userId,
    input: data.input,
    calculation: calculation as unknown as Record<string, unknown> | null,
  });
  return row;
  });
  res.json(UpdateProductResponse.parse(row));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [movement] = await db.select({id:stockMovementsTable.id}).from(stockMovementsTable).where(and(eq(stockMovementsTable.productId,params.data.id),eq(stockMovementsTable.userId,ownerId(res)))).limit(1);
  if(movement){res.status(409).json({error:'Este produto possui histórico de estoque e deve ser preservado.'});return;}
  const [row] = await db.delete(productsTable).where(
    and(eq(productsTable.id, params.data.id), eq(productsTable.userId, ownerId(res))),
  ).returning({ id: productsTable.id });
  if (!row) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  res.sendStatus(204);
});

router.get("/quotes", async (_req, res): Promise<void> => {
  const rows = await db.select().from(quotesTable)
    .where(eq(quotesTable.userId, ownerId(res)))
    .orderBy(desc(quotesTable.createdAt));
  res.json(ListQuotesResponse.parse(rows));
});

router.post("/quotes", async (req, res): Promise<void> => {
  const data = parseBody(CreateQuoteBody, req.body, res);
  if (!data) return;
  const [row] = await db.insert(quotesTable).values({
    ...data,
    validUntil: data.validUntil instanceof Date
      ? data.validUntil.toISOString().slice(0, 10)
      : data.validUntil,
    total: data.unitPrice * data.quantity,
    userId: ownerId(res),
  }).returning();
  res.status(201).json(CreateQuoteResponse.parse(row));
});

export default router;
