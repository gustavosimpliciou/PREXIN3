CREATE TABLE "pricing_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'PLA' NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"net_weight_grams" numeric(16, 6) NOT NULL,
	"purchase_value" numeric(16, 6) NOT NULL,
	"allocated_freight" numeric(16, 6) DEFAULT 0 NOT NULL,
	"stock_grams" numeric(16, 6) DEFAULT 0 NOT NULL,
	"low_stock_threshold" numeric(16, 6) DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text DEFAULT 'Nativos 3D' NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"energy_rate" numeric(16, 6) DEFAULT 0 NOT NULL,
	"hourly_labor_rate" numeric(16, 6) DEFAULT 0 NOT NULL,
	"monthly_fixed_expenses" numeric(16, 6) DEFAULT 0 NOT NULL,
	"productive_hours_monthly" numeric(16, 6) DEFAULT 0 NOT NULL,
	"direct_margin" numeric(16, 6) DEFAULT 0 NOT NULL,
	"wholesale_margin" numeric(16, 6) DEFAULT 0 NOT NULL,
	"marketplace_margin" numeric(16, 6) DEFAULT 0 NOT NULL,
	"direct_fee_percent" numeric(16, 6) DEFAULT 0 NOT NULL,
	"direct_fee_per_order" numeric(16, 6) DEFAULT 0 NOT NULL,
	"direct_fee_per_unit" numeric(16, 6) DEFAULT 0 NOT NULL,
	"wholesale_fee_percent" numeric(16, 6) DEFAULT 0 NOT NULL,
	"wholesale_fee_per_order" numeric(16, 6) DEFAULT 0 NOT NULL,
	"wholesale_fee_per_unit" numeric(16, 6) DEFAULT 0 NOT NULL,
	"marketplace_fee_percent" numeric(16, 6) DEFAULT 0 NOT NULL,
	"marketplace_fee_per_order" numeric(16, 6) DEFAULT 0 NOT NULL,
	"marketplace_fee_per_unit" numeric(16, 6) DEFAULT 0 NOT NULL,
	"rounding" text DEFAULT 'cent' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_printers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"purchase_value" numeric(16, 6) DEFAULT 0 NOT NULL,
	"residual_value" numeric(16, 6) DEFAULT 0 NOT NULL,
	"useful_life_hours" numeric(16, 6) DEFAULT 0 NOT NULL,
	"average_power_watts" numeric(16, 6) DEFAULT 0 NOT NULL,
	"maintenance_per_hour" numeric(16, 6) DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_product_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"calculation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text DEFAULT 'Geral' NOT NULL,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"input" jsonb NOT NULL,
	"calculation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"customer_name" text,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(16, 6) NOT NULL,
	"total" numeric(16, 6) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"valid_until" date,
	"notes" text DEFAULT '' NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"material_id" integer,
	"product_id" integer,
	"amount" numeric(16, 6) NOT NULL,
	"reason" text NOT NULL,
	"operation_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_product_versions" ADD CONSTRAINT "pricing_product_versions_product_id_pricing_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."pricing_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_stock_movements" ADD CONSTRAINT "pricing_stock_movements_material_id_pricing_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."pricing_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_stock_movements" ADD CONSTRAINT "pricing_stock_movements_product_id_pricing_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."pricing_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pricing_materials_user_idx" ON "pricing_materials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operations_owner_key_unique" ON "pricing_operations" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_settings_user_unique" ON "pricing_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pricing_printers_user_idx" ON "pricing_printers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pricing_product_versions_owner_idx" ON "pricing_product_versions" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "pricing_products_user_idx" ON "pricing_products" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pricing_quotes_user_idx" ON "pricing_quotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_owner_idx" ON "pricing_stock_movements" USING btree ("user_id");