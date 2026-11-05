CREATE INDEX "products_created_by_idx" ON "products" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "stores_created_by_idx" ON "stores" USING btree ("created_by");