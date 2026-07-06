import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

// c.env.DB er D1-bindingen sat op i wrangler.toml (binding = "DB").
const app = new Hono().basePath('/api');

// ---------- Health ----------
app.get('/health', (c) => c.json({ status: 'ok', app: 'madplan', phase: 3 }));

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
    'SELECT * FROM stock_items ORDER BY (expiry_date IS NULL), expiry_date ASC, added_at DESC'
  ).all();
  return c.json(results);
});

app.post('/stock', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, category, expiry_date, added_by } = body;
  if (!name || !VALID_CATEGORIES.includes(category)) {
    return c.json({ error: 'name og gyldig category er påkrævet' }, 400);
  }
  if (expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
    return c.json({ error: 'expiry_date skal være i formatet YYYY-MM-DD' }, 400);
  }
  const { results } = await c.env.DB.prepare(
    `INSERT INTO stock_items (name, category, expiry_date, added_by)
     VALUES (?, ?, ?, ?) RETURNING *`
  )
    .bind(name, category, expiry_date || null, added_by || null)
    .all();
  return c.json(results[0]);
});

app.patch('/stock/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { expiry_date, name } = body;

  if (expiry_date !== undefined && expiry_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
    return c.json({ error: 'expiry_date skal være i formatet YYYY-MM-DD eller null' }, 400);
  }

  const fields = [];
  const values = [];
  if (expiry_date !== undefined) { fields.push('expiry_date = ?'); values.push(expiry_date); }
  if (name !== undefined && name !== '') { fields.push('name = ?'); values.push(name); }

  if (fields.length === 0) {
    return c.json({ error: 'intet at opdatere — send expiry_date og/eller name' }, 400);
  }

  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE stock_items SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  )
    .bind(...values)
    .all();

  if (results.length === 0) return c.json({ error: 'vare ikke fundet' }, 404);
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

// ---------- Forslag (suggestion_batches / suggestions) — Fase 3 ----------
const DOW_NAMES = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const MEAL_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Regner Monday..Sunday(indkøbsdag) ud fra kataloget's valid_from (som er en
// søndag), i dansk lokal tid — samme logik som brugt til at bygge Fase 1's
// hardcodede uge, bare dynamisk nu.
function computeDayLabels(validFromISO) {
  const base = new Date(validFromISO);
  const baseLocalDateStr = base.toLocaleDateString('en-CA', { timeZone: 'Europe/Copenhagen' }); // YYYY-MM-DD
  const baseLocal = new Date(baseLocalDateStr + 'T12:00:00'); // middag, undgår DST-kant-tilfælde
  const labels = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(baseLocal);
    d.setDate(d.getDate() + i);
    const dateLabel = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
    labels.push({ dow: DOW_NAMES[i - 1], date_label: dateLabel });
  }
  return labels; // index 0 = mandag ... index 6 = søndag (indkøbsdag)
}

app.get('/suggestions/latest', async (c) => {
  const batch = await c.env.DB.prepare(
    `SELECT * FROM suggestion_batches ORDER BY created_at DESC LIMIT 1`
  ).first();
  if (!batch) return c.json({ batch: null, suggestions: [] });

  if (batch.status !== 'pending_review') {
    return c.json({ batch, suggestions: [] });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM suggestions WHERE batch_id = ? ORDER BY perishability_rank ASC`
  ).bind(batch.id).all();
  const suggestions = results.map((s) => ({ ...s, ingredients: JSON.parse(s.ingredients_json) }));
  return c.json({ batch, suggestions });
});

app.post('/suggestions/:batchId/apply', async (c) => {
  const batchId = c.req.param('batchId');
  const body = await c.req.json().catch(() => ({}));
  const assignments = body.assignments; // [{suggestion_id, day_order}] — præcis 7, day_order 1-7 unikke

  if (!Array.isArray(assignments) || assignments.length !== 7) {
    return c.json({ error: 'assignments skal indeholde præcis 7 {suggestion_id, day_order}' }, 400);
  }
  const dayOrders = assignments.map((a) => a.day_order).slice().sort((a, b) => a - b);
  if (JSON.stringify(dayOrders) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7])) {
    return c.json({ error: 'day_order skal dække 1-7 præcis én gang hver' }, 400);
  }

  const batch = await c.env.DB.prepare('SELECT * FROM suggestion_batches WHERE id = ?').bind(batchId).first();
  if (!batch) return c.json({ error: 'batch ikke fundet' }, 404);

  const labels = computeDayLabels(batch.valid_from);

  for (const a of assignments) {
    const sug = await c.env.DB.prepare(
      'SELECT * FROM suggestions WHERE id = ? AND batch_id = ?'
    ).bind(a.suggestion_id, batchId).first();
    if (!sug) return c.json({ error: `forslag ${a.suggestion_id} ikke fundet i denne batch` }, 400);

    const idx = a.day_order - 1;
    const mealId = MEAL_IDS[idx];
    const label = labels[idx];

    await c.env.DB.prepare(
      `INSERT INTO meals (id, day_order, dow, date_label, cuisine, diet, title, blurb, kid_tip, price, price_unit, ingredients_json, selected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         day_order=excluded.day_order, dow=excluded.dow, date_label=excluded.date_label,
         cuisine=excluded.cuisine, diet=excluded.diet, title=excluded.title, blurb=excluded.blurb,
         kid_tip=excluded.kid_tip, price=excluded.price, price_unit=excluded.price_unit,
         ingredients_json=excluded.ingredients_json, selected=1`
    )
      .bind(
        mealId, a.day_order, label.dow, label.date_label,
        sug.cuisine, sug.diet, sug.title, sug.blurb, sug.kid_tip,
        sug.price, sug.price_unit, sug.ingredients_json
      )
      .run();
  }

  // Ny uge anvendt → gammel afkrydset indkøbsliste er ikke relevant længere.
  await c.env.DB.prepare('DELETE FROM shopping_checked').run();
  await c.env.DB.prepare(`UPDATE suggestion_batches SET status = 'applied' WHERE id = ?`).bind(batchId).run();

  return c.json({ ok: true });
});

app.post('/suggestions/:batchId/discard', async (c) => {
  const batchId = c.req.param('batchId');
  await c.env.DB.prepare(`UPDATE suggestion_batches SET status = 'discarded' WHERE id = ?`).bind(batchId).run();
  return c.json({ ok: true });
});

export const onRequest = handle(app);
