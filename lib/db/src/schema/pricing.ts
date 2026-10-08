import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const money = (name: string) =>
  numeric(name, { precision: 16, scale: 6, mode: "number" });

export const pricingSettingsTable = pgTable(
  "pricing_settings",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    companyName: text("company_name").notNull().default("Nativos 3D"),
    currency: text("currency").notNull().default("BRL"),
    energyRate: money("energy_rate").notNull().default(0),
    hourlyLaborRate: money("hourly_labor_rate").notNull().default(0),
    monthlyFixedExpenses: money("monthly_fixed_expenses").notNull().default(0),
    productiveHoursMonthly: money("productive_hours_monthly").notNull().default(0),
    directMargin: money("direct_margin").notNull().default(0),
    wholesaleMargin: money("wholesale_margin").notNull().default(0),
    marketplaceMargin: money("marketplace_margin").notNull().default(0),
    directFeePercent: money("direct_fee_percent").notNull().default(0),
    directFeePerOrder: money("direct_fee_per_order").notNull().default(0),
    directFeePerUnit: money("direct_fee_per_unit").notNull().default(0),
    wholesaleFeePercent: money("wholesale_fee_percent").notNull().default(0),
    wholesaleFeePerOrder: money("wholesale_fee_per_order").notNull().default(0),
    wholesaleFeePerUnit: money("wholesale_fee_per_unit").notNull().default(0),
    marketplaceFeePercent: money("marketplace_fee_percent").notNull().default(0),
    marketplaceFeePerOrder: money("marketplace_fee_per_order").notNull().default(0),
    marketplaceFeePerUnit: money("marketplace_fee_per_unit").notNull().default(0),
    rounding: text("rounding").notNull().default("cent"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("pricing_settings_user_unique").on(table.userId)],
);

export const materialsTable = pgTable(
  "pricing_materials",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull().default("PLA"),
    brand: text("brand").notNull().default(""),
    color: text("color").notNull().default(""),
    supplier: text("supplier").notNull().default(""),
    netWeightGrams: money("net_weight_grams").notNull(),
    purchaseValue: money("purchase_value").notNull(),
    allocatedFreight: money("allocated_freight").notNull().default(0),
    stockGrams: money("stock_grams").notNull().default(0),
    lowStockThreshold: money("low_stock_threshold").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("pricing_materials_user_idx").on(table.userId)],
);

export const printersTable = pgTable(
  "pricing_printers",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    model: text("model").notNull().default(""),
    purchaseValue: money("purchase_value").notNull().default(0),
    residualValue: money("residual_value").notNull().default(0),
    usefulLifeHours: money("useful_life_hours").notNull().default(0),
    averagePowerWatts: money("average_power_watts").notNull().default(0),
    maintenancePerHour: money("maintenance_per_hour").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("pricing_printers_user_idx").on(table.userId)],
);

export const productsTable = pgTable(
  "pricing_products",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    sku: text("sku"),
    category: text("category").notNull().default("Geral"),
    status: text("status").notNull().default("incomplete"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    calculation: jsonb("calculation").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("pricing_products_user_idx").on(table.userId)],
);

export const productVersionsTable = pgTable(
  "pricing_product_versions",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    calculation: jsonb("calculation").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("pricing_product_versions_owner_idx").on(table.userId, table.productId)],
);

export const quotesTable = pgTable(
  "pricing_quotes",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    customerName: text("customer_name"),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    total: money("total").notNull(),
    status: text("status").notNull().default("draft"),
    validUntil: date("valid_until", { mode: "string" }),
    notes: text("notes").notNull().default(""),
    snapshot: jsonb("snapshot").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("pricing_quotes_user_idx").on(table.userId)],
);

export const preferencesTable = pgTable('pricing_preferences', {
  userId: text('user_id').primaryKey(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovementsTable = pgTable('pricing_stock_movements', {
  id: serial('id').primaryKey(), userId: text('user_id').notNull(),
  materialId: integer('material_id').references(() => materialsTable.id),
  productId: integer('product_id').references(() => productsTable.id),
  amount: money('amount').notNull(), reason: text('reason').notNull(),
  operationKey: text('operation_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('stock_owner_idx').on(t.userId)]);

export const operationsTable = pgTable('pricing_operations', {
  id: serial('id').primaryKey(), userId: text('user_id').notNull(),
  key: text('key').notNull(), kind: text('kind').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('operations_owner_key_unique').on(t.userId,t.key)]);

export const auditTable = pgTable('pricing_audit', {
  id: serial('id').primaryKey(), userId: text('user_id').notNull(),
  entity: text('entity').notNull(), entityId: integer('entity_id').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
