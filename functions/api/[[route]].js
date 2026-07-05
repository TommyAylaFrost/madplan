import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

// c.env.DB er D1-bindingen sat op i wrangler.toml (binding = "DB").
const app = new Hono().basePath('/api');

// ---------- Health ----------
app.get('/health', (c) => c.json({ status: 'ok', app: 'madplan', phase: 1 }));

// ---------- Ugeplan (meals) ----------
app.get('/meals', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM meals ORDER BY day_order'
  ).all();
  const meals = results.map((m) => ({
    ...m,
    selected: !!m.selected,
    ingredients: JSON.parse(m.ingredients_json),
  }));
  return c.json(meals);
});

app.patch('/meals/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.selected !== 'boolean') {
    return c.json({ error: 'selected (boolean) er påkrævet' }, 400);
  }
  await c.env.DB.prepare('UPDATE meals SET selected = ? WHERE id = ?')
    .bind(body.selected ? 1 : 0, id)
    .run();
  return c.json({ ok: true });
});

// ---------- Lager (stock_items) ----------
const VALID_CATEGORIES = ['koeleskab', 'fryser', 'kolonial'];

app.get('/stock', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stock_items ORDER BY added_at DESC'
  ).all();
  return c.json(results);
});

app.post('/stock', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, category, expiry_date, added_by } = body;
  if (!name || !VALID_CATEGORIES.includes(category)) {
    return c.json({ error: 'name og gyldig category er påkrævet' }, 400);
  }
  const { results } = await c.env.DB.prepare(
    `INSERT INTO stock_items (name, category, expiry_date, added_by)
     VALUES (?, ?, ?, ?) RETURNING *`
  )
    .bind(name, category, expiry_date || null, added_by || null)
    .all();
  return c.json(results[0]);
});

app.delete('/stock/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM stock_items WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ---------- Indkøbsliste (shopping_checked) ----------
app.get('/shopping', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT item_key FROM shopping_checked'
  ).all();
  return c.json(results.map((r) => r.item_key));
});

app.post('/shopping/toggle', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { item_key, checked_by } = body;
  if (!item_key) return c.json({ error: 'item_key er påkrævet' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT item_key FROM shopping_checked WHERE item_key = ?'
  )
    .bind(item_key)
    .first();

  if (existing) {
    await c.env.DB.prepare('DELETE FROM shopping_checked WHERE item_key = ?')
      .bind(item_key)
      .run();
    return c.json({ item_key, checked: false });
  }
  await c.env.DB.prepare(
    'INSERT INTO shopping_checked (item_key, checked_by) VALUES (?, ?)'
  )
    .bind(item_key, checked_by || null)
    .run();
  return c.json({ item_key, checked: true });
});

export const onRequest = handle(app);
