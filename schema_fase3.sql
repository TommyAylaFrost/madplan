-- Fase 3 schema-tilføjelse: forslag fra den ugentlige avis-scanning.
--
-- VIGTIGT: denne fil bruger IF NOT EXISTS og indeholder ingen DROP TABLE —
-- den er lavet til at køre oveni jeres eksisterende, levende database uden
-- at slette lager, ugeplan eller indkøbsliste.
--
-- Kør mod den rigtige database:
--   wrangler d1 execute madplan-db --remote --file=schema_fase3.sql
-- Kør lokalt til udvikling:
--   wrangler d1 execute madplan-db --local --file=schema_fase3.sql

CREATE TABLE IF NOT EXISTS suggestion_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tjek_catalog_id TEXT,
  week_label TEXT,
  valid_from TEXT,             -- ISO-dato/tid fra Tjek, søndagen ugen starter
  valid_till TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',  -- 'pending_review' | 'applied' | 'discarded' | 'failed'
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES suggestion_batches(id),
  cuisine TEXT NOT NULL,             -- 'nordic' | 'asian'
  diet TEXT NOT NULL,                -- 'veg' | 'fish' | 'meat'
  title TEXT NOT NULL,
  blurb TEXT NOT NULL,
  kid_tip TEXT NOT NULL,
  price REAL,
  price_unit TEXT,
  ingredients_json TEXT NOT NULL,
  perishability_rank INTEGER NOT NULL   -- 1 = mest letfordærvelig (brug tidligt), 15 = mest holdbar
);
