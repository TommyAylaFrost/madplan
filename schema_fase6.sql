-- Fase 6: husk stregkoder lokalt, så jeres eget lager "lærer" REMA 1000's
-- private label-varer og andre ting Open Food Facts ikke kender. Rent
-- additivt, ingen DROP.
--
-- Kør lokalt:  wrangler d1 execute madplan-db --local --file=schema_fase6.sql
-- Kør rigtigt: wrangler d1 execute madplan-db --remote --file=schema_fase6.sql

CREATE TABLE IF NOT EXISTS barcode_overrides (
  barcode TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
