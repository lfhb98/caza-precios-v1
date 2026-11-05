CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid,
	"price" numeric(10, 2) NOT NULL,
	"image_path" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_price_positive" CHECK ("prices"."price" > 0),
	CONSTRAINT "prices_observed_at_not_future" CHECK ("prices"."observed_at" <= now() + interval '5 minutes')
);
--> statement-breakpoint
ALTER TABLE "prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_not_empty" CHECK (length(trim("products"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_name_not_empty" CHECK (length(trim("stores"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prices_product_observed_idx" ON "prices" USING btree ("product_id","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "prices_store_idx" ON "prices" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "prices_user_idx" ON "prices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_name_unique" ON "products" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "stores_name_unique" ON "stores" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE POLICY "prices_select" ON "prices" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "prices_insert" ON "prices" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("prices"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "prices_update_own" ON "prices" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("prices"."user_id" = (select auth.uid())) WITH CHECK ("prices"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "prices_delete_own" ON "prices" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("prices"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "products_select" ON "products" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "products_insert" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("products"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_select" ON "profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "stores_select" ON "stores" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "stores_insert" ON "stores" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("stores"."created_by" = (select auth.uid()) and "stores"."is_default" = false);