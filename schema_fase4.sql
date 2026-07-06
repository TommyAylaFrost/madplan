-- Fase 4: fjern en enkelt dags ret, få forslag kun til den dag, og gem
-- retter som familiefavoritter. Rent additivt, ingen DROP.
--
-- Kør lokalt:  wrangler d1 execute madplan-db --local --file=schema_fase4.sql
-- Kør rigtigt: wrangler d1 execute madplan-db --remote --file=schema_fase4.sql

-- OBS: I modsætning til CREATE TABLE IF NOT EXISTS, fejler ALTER TABLE ADD
-- COLUMN hvis kolonnen allerede findes. Kør denne linje kun ÉN gang — hvis
-- I ved et uheld kører hele filen igen, vil kun denne ene linje fejle med
-- "duplicate column name", hvilket er harmløst og kan ignoreres.
ALTER TABLE meals ADD COLUMN is_empty INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  diet TEXT NOT NULL,
  blurb TEXT NOT NULL,
  kid_tip TEXT NOT NULL,
  price REAL,
  price_unit TEXT,
  ingredients_json TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
