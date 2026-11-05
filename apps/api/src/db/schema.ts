import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase';

// Esquema descrito en docs/database.md. Las políticas RLS protegen el acceso
// directo desde los clientes de Supabase; la API se conecta como propietaria
// de las tablas (las ignora) y aplica los mismos permisos en las rutas.

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

const everyone = [anonRole, authenticatedRole];

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    username: text('username').notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [
    pgPolicy('profiles_select', { for: 'select', to: everyone, using: sql`true` }),
    pgPolicy('profiles_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ]
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('products_name_not_empty', sql`length(trim(${t.name})) > 0`),
    uniqueIndex('products_name_unique').using('btree', sql`lower(trim(${t.name}))`),
    // Toda clave foránea con índice: ON DELETE SET NULL no recorre la tabla entera.
    index('products_created_by_idx').on(t.createdBy),
    pgPolicy('products_select', { for: 'select', to: everyone, using: sql`true` }),
    pgPolicy('products_insert', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${t.createdBy} = ${authUid}`,
    }),
  ]
);

export const stores = pgTable(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('stores_name_not_empty', sql`length(trim(${t.name})) > 0`),
    uniqueIndex('stores_name_unique').using('btree', sql`lower(trim(${t.name}))`),
    index('stores_created_by_idx').on(t.createdBy),
    pgPolicy('stores_select', { for: 'select', to: everyone, using: sql`true` }),
    pgPolicy('stores_insert', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${t.createdBy} = ${authUid} and ${t.isDefault} = false`,
    }),
  ]
);

export const prices = pgTable(
  'prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    price: numeric('price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    imagePath: text('image_path'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    check('prices_price_positive', sql`${t.price} > 0`),
    // Margen de 5 minutos para relojes de móvil ligeramente adelantados.
    check('prices_observed_at_not_future', sql`${t.observedAt} <= now() + interval '5 minutes'`),
    index('prices_product_observed_idx').on(t.productId, t.observedAt.desc()),
    index('prices_store_idx').on(t.storeId),
    index('prices_user_idx').on(t.userId),
    pgPolicy('prices_select', { for: 'select', to: everyone, using: sql`true` }),
    pgPolicy('prices_insert', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy('prices_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy('prices_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
  ]
);
