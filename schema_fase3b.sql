-- Fase 3b: gør det muligt at bygge NÆSTE uges plan uden at røre den
-- nuværende, aktive uge. Rent additivt — ingen DROP, sikker at køre oveni
-- levende data.
--
-- Kør lokalt:  wrangler d1 execute madplan-db --local --file=schema_fase3b.sql
-- Kør rigtigt: wrangler d1 execute madplan-db --remote --file=schema_fase3b.sql

CREATE TABLE IF NOT EXISTS staged_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES suggestion_batches(id),
  suggestion_id INTEGER NOT NULL REFERENCES suggestions(id),
  day_order INTEGER NOT NULL
);
