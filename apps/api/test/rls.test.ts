import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';

// Las políticas RLS protegen el acceso directo con el cliente de Supabase
// (la API no pasa por ellas). Aquí se ejecuta SQL como lo haría Supabase:
// con el rol de la petición y el `sub` del JWT.

let ctx: TestContext;
let ana: { id: string };
let luis: { id: string };
let productId: string;
let storeId: string;

beforeAll(async () => {
  ctx = await createTestContext();
  ana = await ctx.createUser('ana');
  luis = await ctx.createUser('luis');

  const product = await ctx.client.query<{ id: string }>(
    `insert into products (name, created_by) values ('Leche', $1) returning id`,
    [ana.id]
  );
  productId = product.rows[0]!.id;
  const store = await ctx.client.query<{ id: string }>(`select id from stores where name = 'Lidl'`);
  storeId = store.rows[0]!.id;
});

afterAll(() => ctx.close());

async function as<T>(role: 'anon' | 'authenticated', userId: string | null, sql: string, params: unknown[] = []) {
  await ctx.client.exec(`set role ${role}`);
  await ctx.client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  try {
    return await ctx.client.query<T>(sql, params);
  } finally {
    await ctx.client.exec('reset role');
  }
}

describe('políticas RLS', () => {
  it('cualquiera puede leer, pero sin sesión no se puede escribir', async () => {
    const read = await as('anon', null, 'select count(*)::int as n from stores');
    expect(read.rows).toEqual([{ n: 7 }]);

    await expect(
      as('anon', null, `insert into stores (name) values ('Pirata')`)
    ).rejects.toThrow(/row-level security/);
  });

  it('un usuario no puede registrar precios ni tiendas en nombre de otro', async () => {
    await expect(
      as('authenticated', luis.id, 'insert into prices (product_id, store_id, user_id, price) values ($1, $2, $3, 1)', [
        productId,
        storeId,
        ana.id,
      ])
    ).rejects.toThrow(/row-level security/);

    await expect(
      as('authenticated', luis.id, `insert into stores (name, created_by, is_default) values ('Falsa', $1, true)`, [
        luis.id,
      ])
    ).rejects.toThrow(/row-level security/);
  });

  it('solo el autor puede editar o borrar su precio, y no puede cedérselo a otro', async () => {
    const created = await as<{ id: string }>(
      'authenticated',
      ana.id,
      'insert into prices (product_id, store_id, user_id, price) values ($1, $2, $3, 1.5) returning id',
      [productId, storeId, ana.id]
    );
    const priceId = created.rows[0]!.id;

    // Para Luis la fila "no existe": el UPDATE y el DELETE no afectan a nada.
    const update = await as('authenticated', luis.id, 'update prices set price = 0.01 where id = $1', [priceId]);
    expect(update.affectedRows).toBe(0);
    const remove = await as('authenticated', luis.id, 'delete from prices where id = $1', [priceId]);
    expect(remove.affectedRows).toBe(0);

    await expect(
      as('authenticated', ana.id, 'update prices set user_id = $1 where id = $2', [luis.id, priceId])
    ).rejects.toThrow(/row-level security/);

    const own = await as('authenticated', ana.id, 'update prices set price = 1.4 where id = $1', [priceId]);
    expect(own.affectedRows).toBe(1);
  });

  it('productos y tiendas no se pueden editar ni borrar desde el cliente', async () => {
    const update = await as('authenticated', ana.id, `update products set name = 'Otra' where id = $1`, [productId]);
    expect(update.affectedRows).toBe(0);
  });
});
