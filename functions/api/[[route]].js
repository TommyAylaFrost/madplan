import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

// c.env.DB er D1-bindingen sat op i wrangler.toml (binding = "DB").
const app = new Hono().basePath('/api');

// ---------- Health ----------
app.get('/health', (c) => c.json({ status: 'ok', app: 'madplan', phase: '3b' }));

// ---------- Ugeplan (meals) ----------
app.get('/meals', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM meals ORDER BY day_order'
  ).all();
  const meals = results.map((m) => ({
    ...m,
    selected: !!m.selected,
    is_empty: !!m.is_empty,
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

// Tømmer en enkelt dags ret — dagen findes stadig (mandag er stadig mandag),
// men har ingen ret tilknyttet, indtil I fylder den igen.
app.post('/meals/:id/clear', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(
    `UPDATE meals SET is_empty = 1, selected = 0 WHERE id = ?`
  ).bind(id).run();
  return c.json({ ok: true });
});

// Fylder en tom dag med enten en favorit eller et af swap-forslagene.
// Body: { title, cuisine, diet, blurb, kid_tip, price, price_unit, ingredients }
app.post('/meals/:id/fill', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { title, cuisine, diet, blurb, kid_tip, price, price_unit, ingredients } = body;
  if (!title || !cuisine || !diet) {
    return c.json({ error: 'title, cuisine og diet er påkrævet' }, 400);
  }
  await c.env.DB.prepare(
    `UPDATE meals SET
       title = ?, cuisine = ?, diet = ?, blurb = ?, kid_tip = ?,
       price = ?, price_unit = ?, ingredients_json = ?,
       is_empty = 0, selected = 1
     WHERE id = ?`
  )
    .bind(
      title, cuisine, diet, blurb || '', kid_tip || '',
      price ?? null, price_unit || null, JSON.stringify(ingredients || []),
      id
    )
    .run();
  return c.json({ ok: true });
});

// Beder Claude om 3 alternative retter til ÉN bestemt dag — ikke en hel uge.
// Kører direkte fra Pages (kræver ANTHROPIC_API_KEY sat som secret her),
// uafhængigt af den ugentlige Tjek-scanning i madplan-cron.
const SWAP_TOOL = {
  name: 'foreslaa_alternativer',
  description: 'Foreslår 3 alternative middagsretter til én bestemt dag.',
  input_schema: {
    type: 'object',
    properties: {
      options: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            cuisine: { type: 'string', enum: ['nordic', 'asian'] },
            diet: { type: 'string', enum: ['veg', 'fish', 'meat'] },
            title: { type: 'string' },
            blurb: { type: 'string' },
            kidTip: { type: 'string' },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  amt: { type: 'string' },
                  cat: { type: 'string', enum: ['Protein', 'Grønt', 'Sauce/Pantry', 'Bread/Dairy', 'Basis'] },
                },
                required: ['name', 'amt', 'cat'],
              },
            },
          },
          required: ['cuisine', 'diet', 'title', 'blurb', 'kidTip', 'ingredients'],
        },
      },
    },
    required: ['options'],
  },
};

app.post('/meals/:id/swap-suggestions', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY er ikke sat op på dette Pages-projekt' }, 500);
  }
  const dayId = c.req.param('id');

  const { results: allMeals } = await c.env.DB.prepare('SELECT * FROM meals ORDER BY day_order').all();
  const thisDay = allMeals.find((m) => m.id === dayId);
  if (!thisDay) return c.json({ error: 'dag ikke fundet' }, 404);

  const restOfWeek = allMeals
    .filter((m) => m.id !== dayId && !m.is_empty)
    .map((m) => `${m.dow}: ${m.title} (${m.cuisine}, ${m.diet})`)
    .join('\n');

  const prompt = `Du er en dansk madplanlægger for en familie på 2 voksne og 2 børn (2 og 4 år).

Resten af ugen ser sådan ud:
${restOfWeek || '(ingen andre dage planlagt endnu)'}

Foreslå 3 forskellige alternative middagsretter til ${thisDay.dow} (${thisDay.date_label}),
som IKKE gentager de cuisiner/diæter der allerede er rigeligt af i resten af ugen ovenfor.
Bland gerne nordisk og asiatisk-inspireret. Retterne skal være milde/børnevenlige, eller
have en tydelig kidTip. Ingredienser behøver ikke være tilbudsvarer — antag almindelige
dagligvarer. Brug værktøjet "foreslaa_alternativer" til at aflevere svaret.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: c.env.CLAUDE_MODEL || 'claude-sonnet-5',
      max_tokens: 2000,
      tools: [SWAP_TOOL],
      tool_choice: { type: 'tool', name: 'foreslaa_alternativer' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    return c.json({ error: `Anthropic API-kald fejlede: ${res.status} ${await res.text()}` }, 502);
  }
  const data = await res.json();
  const toolUse = data.content.find((b) => b.type === 'tool_use' && b.name === 'foreslaa_alternativer');
  if (!toolUse) {
    return c.json({ error: 'Claude returnerede ikke det forventede værktøjskald' }, 502);
  }
  return c.json({ options: toolUse.input.options });
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

// ---------- Forslag (suggestion_batches / suggestions) ----------
const DOW_NAMES = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const MEAL_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function computeDayLabels(validFromISO) {
  const base = new Date(validFromISO);
  const baseLocalDateStr = base.toLocaleDateString('en-CA', { timeZone: 'Europe/Copenhagen' }); // YYYY-MM-DD
  const baseLocal = new Date(baseLocalDateStr + 'T12:00:00');
  const labels = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(baseLocal);
    d.setDate(d.getDate() + i);
    const dateLabel = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
    labels.push({ dow: DOW_NAMES[i - 1], date_label: dateLabel });
  }
  return labels; // index 0 = mandag ... index 6 = søndag (indkøbsdag)
}

function validateAssignments(assignments) {
  if (!Array.isArray(assignments) || assignments.length !== 7) {
    return 'assignments skal indeholde præcis 7 {suggestion_id, day_order}';
  }
  const dayOrders = assignments.map((a) => a.day_order).slice().sort((a, b) => a - b);
  if (JSON.stringify(dayOrders) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7])) {
    return 'day_order skal dække 1-7 præcis én gang hver';
  }
  return null;
}

// Fælles skrive-logik: lægger 7 forslag ind i den AKTIVE ugeplan (meals-tabellen)
// og nulstiller den afkrydsede indkøbsliste. Bruges både af "anvend nu" og
// af "forfrem staged uge til aktiv".
async function writeAssignmentsToMeals(env, batch, rows) {
  const labels = computeDayLabels(batch.valid_from);
  for (const row of rows) {
    const sug = await env.DB.prepare(
      'SELECT * FROM suggestions WHERE id = ? AND batch_id = ?'
    ).bind(row.suggestion_id, batch.id).first();
    if (!sug) throw new Error(`forslag ${row.suggestion_id} ikke fundet i batch ${batch.id}`);

    const idx = row.day_order - 1;
    const mealId = MEAL_IDS[idx];
    const label = labels[idx];

    await env.DB.prepare(
      `INSERT INTO meals (id, day_order, dow, date_label, cuisine, diet, title, blurb, kid_tip, price, price_unit, ingredients_json, selected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         day_order=excluded.day_order, dow=excluded.dow, date_label=excluded.date_label,
         cuisine=excluded.cuisine, diet=excluded.diet, title=excluded.title, blurb=excluded.blurb,
         kid_tip=excluded.kid_tip, price=excluded.price, price_unit=excluded.price_unit,
         ingredients_json=excluded.ingredients_json, selected=1`
    )
      .bind(
        mealId, row.day_order, label.dow, label.date_label,
        sug.cuisine, sug.diet, sug.title, sug.blurb, sug.kid_tip,
        sug.price, sug.price_unit, sug.ingredients_json
      )
      .run();
  }
  await env.DB.prepare('DELETE FROM shopping_checked').run();
}

// Nyeste batch der venter på gennemsyn ELLER er fejlet — driver "Forslag"-fanen og bannere.
app.get('/suggestions/latest', async (c) => {
  const batch = await c.env.DB.prepare(
    `SELECT * FROM suggestion_batches WHERE status IN ('pending_review','failed') ORDER BY created_at DESC LIMIT 1`
  ).first();
  if (!batch) return c.json({ batch: null, suggestions: [] });

  if (batch.status === 'failed') return c.json({ batch, suggestions: [] });

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM suggestions WHERE batch_id = ? ORDER BY perishability_rank ASC`
  ).bind(batch.id).all();
  const suggestions = results.map((s) => ({ ...s, ingredients: JSON.parse(s.ingredients_json) }));
  return c.json({ batch, suggestions });
});

// Nyeste batch der er "staged" (bygget, men ikke gjort aktiv endnu) — driver
// "næste uge er klar"-bannereret, uafhængigt af om der ALSO er en ny batch
// til gennemsyn.
app.get('/staged/latest', async (c) => {
  const batch = await c.env.DB.prepare(
    `SELECT * FROM suggestion_batches WHERE status = 'staged' ORDER BY created_at DESC LIMIT 1`
  ).first();
  if (!batch) return c.json({ batch: null, assignments: [] });

  const { results } = await c.env.DB.prepare(
    `SELECT sa.day_order, s.* FROM staged_assignments sa
     JOIN suggestions s ON s.id = sa.suggestion_id
     WHERE sa.batch_id = ? ORDER BY sa.day_order ASC`
  ).bind(batch.id).all();
  const assignments = results.map((r) => ({ ...r, ingredients: JSON.parse(r.ingredients_json) }));
  return c.json({ batch, assignments });
});

// Anvend med det samme — overskriver den AKTIVE uge (samme opførsel som hele
// vejen igennem Fase 3, uændret). Bruges når "omstændigheder ændrer sig" og
// I vil justere ugen der allerede kører.
app.post('/suggestions/:batchId/apply', async (c) => {
  const batchId = c.req.param('batchId');
  const body = await c.req.json().catch(() => ({}));
  const err = validateAssignments(body.assignments);
  if (err) return c.json({ error: err }, 400);

  const batch = await c.env.DB.prepare('SELECT * FROM suggestion_batches WHERE id = ?').bind(batchId).first();
  if (!batch) return c.json({ error: 'batch ikke fundet' }, 404);

  await writeAssignmentsToMeals(c.env, batch, body.assignments);
  await c.env.DB.prepare(`UPDATE suggestion_batches SET status = 'applied' WHERE id = ?`).bind(batchId).run();
  return c.json({ ok: true });
});

// Gem til senere — rører IKKE den aktive uge. Bruges til at forberede næste
// uge, mens denne uge stadig kører.
app.post('/suggestions/:batchId/stage', async (c) => {
  const batchId = c.req.param('batchId');
  const body = await c.req.json().catch(() => ({}));
  const err = validateAssignments(body.assignments);
  if (err) return c.json({ error: err }, 400);

  const batch = await c.env.DB.prepare('SELECT * FROM suggestion_batches WHERE id = ?').bind(batchId).first();
  if (!batch) return c.json({ error: 'batch ikke fundet' }, 404);

  for (const a of body.assignments) {
    const sug = await c.env.DB.prepare(
      'SELECT id FROM suggestions WHERE id = ? AND batch_id = ?'
    ).bind(a.suggestion_id, batchId).first();
    if (!sug) return c.json({ error: `forslag ${a.suggestion_id} ikke fundet i denne batch` }, 400);

    await c.env.DB.prepare(
      `INSERT INTO staged_assignments (batch_id, suggestion_id, day_order) VALUES (?, ?, ?)`
    ).bind(batchId, a.suggestion_id, a.day_order).run();
  }

  await c.env.DB.prepare(`UPDATE suggestion_batches SET status = 'staged' WHERE id = ?`).bind(batchId).run();
  return c.json({ ok: true });
});

// Forfrem en staged uge til at være den aktive ugeplan — det tidspunkt hvor
// I rent faktisk skifter over, fx søndag morgen efter storhandlen.
app.post('/staged/:batchId/promote', async (c) => {
  const batchId = c.req.param('batchId');
  const batch = await c.env.DB.prepare(
    `SELECT * FROM suggestion_batches WHERE id = ? AND status = 'staged'`
  ).bind(batchId).first();
  if (!batch) return c.json({ error: 'ingen staged batch med dette id' }, 404);

  const { results: rows } = await c.env.DB.prepare(
    `SELECT suggestion_id, day_order FROM staged_assignments WHERE batch_id = ?`
  ).bind(batchId).all();
  if (rows.length !== 7) {
    return c.json({ error: `forventede 7 staged assignments, fandt ${rows.length}` }, 500);
  }

  await writeAssignmentsToMeals(c.env, batch, rows);
  await c.env.DB.prepare(`UPDATE suggestion_batches SET status = 'applied' WHERE id = ?`).bind(batchId).run();
  return c.json({ ok: true });
});

// Forkast — virker uanset status (pending_review, staged, eller failed).
app.post('/suggestions/:batchId/discard', async (c) => {
  const batchId = c.req.param('batchId');
  await c.env.DB.prepare(`UPDATE suggestion_batches SET status = 'discarded' WHERE id = ?`).bind(batchId).run();
  return c.json({ ok: true });
});

// Manuel scan-knap i UI'en. Kalder madplan-cron-workeren server-side, så
// TRIGGER_SECRET aldrig sendes til eller ligger i browseren. Kræver
// CRON_WORKER_URL og CRON_TRIGGER_SECRET sat op som miljøvariabler/secrets
// på dette Pages-projekt (se README).
app.post('/scan/trigger', async (c) => {
  if (!c.env.CRON_WORKER_URL || !c.env.CRON_TRIGGER_SECRET) {
    return c.json(
      { error: 'CRON_WORKER_URL og/eller CRON_TRIGGER_SECRET er ikke konfigureret på dette Pages-projekt endnu' },
      500
    );
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM suggestion_batches WHERE status = 'pending_review' LIMIT 1`
  ).first();
  if (existing) {
    return c.json(
      { error: 'Der er allerede forslag klar til gennemsyn — se dem færdig eller forkast dem, før I scanner igen' },
      409
    );
  }

  const res = await fetch(`${c.env.CRON_WORKER_URL}/trigger`, {
    method: 'POST',
    headers: { 'x-trigger-secret': c.env.CRON_TRIGGER_SECRET },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) return c.json({ error: 'Scanning fejlede', detail: data }, 502);
  return c.json(data);
});

// ---------- Favoritter ----------
app.get('/favorites', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM favorites ORDER BY saved_at DESC'
  ).all();
  return c.json(results.map((f) => ({ ...f, ingredients: JSON.parse(f.ingredients_json) })));
});

app.post('/favorites', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { title, cuisine, diet, blurb, kid_tip, price, price_unit, ingredients } = body;
  if (!title || !cuisine || !diet) {
    return c.json({ error: 'title, cuisine og diet er påkrævet' }, 400);
  }
  // Undgå oplagte dubletter — samme titel er allerede gemt.
  const existing = await c.env.DB.prepare('SELECT id FROM favorites WHERE title = ?').bind(title).first();
  if (existing) return c.json({ alreadySaved: true, id: existing.id });

  const { results } = await c.env.DB.prepare(
    `INSERT INTO favorites (title, cuisine, diet, blurb, kid_tip, price, price_unit, ingredients_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(title, cuisine, diet, blurb || '', kid_tip || '', price ?? null, price_unit || null, JSON.stringify(ingredients || []))
    .all();
  return c.json(results[0]);
});

app.delete('/favorites/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM favorites WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export const onRequest = handle(app);
