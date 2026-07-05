-- Fase 1 schema: ugeplan (meals), lager (stock_items), indkøbsliste (shopping_checked)
--
-- Kør lokalt (til `npm run dev`):
--   wrangler d1 execute madplan-db --local --file=schema.sql
--
-- Kør mod den rigtige (produktions-)database, når den er oprettet:
--   wrangler d1 create madplan-db
--   (indsæt database_id fra output i wrangler.toml)
--   wrangler d1 execute madplan-db --remote --file=schema.sql

DROP TABLE IF EXISTS stock_items;
DROP TABLE IF EXISTS meals;
DROP TABLE IF EXISTS shopping_checked;

CREATE TABLE stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('koeleskab','fryser','kolonial')),
  expiry_date TEXT,           -- ISO dato (YYYY-MM-DD), valgfri. UI for dette kommer i Fase 2.
  added_by TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE meals (
  id TEXT PRIMARY KEY,             -- 'mon', 'tue', ...
  day_order INTEGER NOT NULL,
  dow TEXT NOT NULL,
  date_label TEXT NOT NULL,
  cuisine TEXT NOT NULL,           -- 'nordic' | 'asian'
  diet TEXT NOT NULL,              -- 'veg' | 'fish' | 'meat'
  title TEXT NOT NULL,
  blurb TEXT NOT NULL,
  kid_tip TEXT NOT NULL,
  price REAL,
  price_unit TEXT,
  ingredients_json TEXT NOT NULL,  -- JSON array af {name, amt, cat, sale, price}
  selected INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE shopping_checked (
  item_key TEXT PRIMARY KEY,       -- matcher ingrediens-navnet
  checked_by TEXT,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed: Uge 28 (05.–11. juli 2026), mandag først, søndag som indkøbsdag.
-- Fase 3 erstatter denne manuelle seed med automatisk hentede forslag.
INSERT INTO meals (id, day_order, dow, date_label, cuisine, diet, title, blurb, kid_tip, price, price_unit, ingredients_json, selected) VALUES
('mon', 1, 'Mandag', '6. juli', 'asian', 'veg',
 'Mild kokos-grøntsagscurry med æg',
 'Grøntsagsblanding simret i kokosmælk og rød karrypasta, toppet med kogte æg i både. Vegetarisk aftensmad med asiatisk smag.',
 'Tag børnenes ris, æg og grønt fra inden karrypastaen tilsættes — spæd resten med lidt ekstra kokosmælk.',
 10, 'karrypasta',
 '[{"name":"REMA 1000 Lækkert & Nemt Grøntsagsblanding","amt":"400 g","cat":"Grønt","sale":true,"price":"10,-"},{"name":"REMA 1000 Inspiring Food Rød karrypasta","amt":"1 stk","cat":"Sauce/Pantry","sale":true,"price":"10,-"},{"name":"REMA 1000 Inspiring Food Kokosmælk","amt":"400 ml","cat":"Sauce/Pantry","sale":true,"price":"8,-"},{"name":"Økologiske æg M/L","amt":"6 stk (af 10-pak)","cat":"Protein","sale":true,"price":"30,-/10stk"},{"name":"Ris","amt":"til 4","cat":"Basis","sale":false}]',
 1),
('tue', 2, 'Tirsdag', '7. juli', 'nordic', 'fish',
 'Fiskefrikadeller med remoulade',
 'Hjemmelavede frikadeller af fiskefars, stegt møre, med remoulade, kartofler og gulerødder — nem klassiker børnene kender.',
 'Fiskefrikadeller er blandt de mest børnevenlige aftensmåltider — mild smag, blød konsistens.',
 30, 'pr. 400 g',
 '[{"name":"REMA 1000 Fiskefars","amt":"400 g","cat":"Protein","sale":true,"price":"30,-"},{"name":"Kartofler","amt":"1 kg","cat":"Basis","sale":false},{"name":"Danske gulerødder","amt":"300 g (af 1 kg pose)","cat":"Grønt","sale":true,"price":"8,-/kg"},{"name":"Remoulade","amt":"1 glas","cat":"Sauce/Pantry","sale":false}]',
 1),
('wed', 3, 'Onsdag', '8. juli', 'asian', 'meat',
 'Korean BBQ-svin wok med grønt',
 'Marmoreret grillfilet i korean BBQ-marinade, wokket med grøntsagsblanding og sojasauce, serveret over ris.',
 'Wok en ekstra mild portion grønt uden marinade til de yngste, del kødet i små stykker.',
 35, 'pr. 400 g',
 '[{"name":"REMA 1000 Ribsteaks Korean BBQ / grillfilet","amt":"400 g","cat":"Protein","sale":true,"price":"35,-"},{"name":"REMA 1000 Lækkert & Nemt Grøntsagsblanding","amt":"400 g","cat":"Grønt","sale":true,"price":"10,-"},{"name":"REMA 1000 Inspiring Food Sojasauce","amt":"1 stk","cat":"Sauce/Pantry","sale":true,"price":"10,-"},{"name":"Ris","amt":"til 4","cat":"Basis","sale":false}]',
 1),
('thu', 4, 'Torsdag', '9. juli', 'nordic', 'fish',
 'Stegt laks med dild og kartofler',
 'Laksefileter med sennep-dildsovs, nye kartofler og en let salatmix — hurtig hverdagsmiddag med et nordisk touch.',
 'Fjern evt. skind før servering til de mindste, og server sovsen ved siden af.',
 39, 'pr. 225 g',
 '[{"name":"REMA 1000 Laksefileter","amt":"2×225 g","cat":"Protein","sale":true,"price":"39,-/pk"},{"name":"Salatmix eller rucola","amt":"75 g","cat":"Grønt","sale":true,"price":"8,-"},{"name":"Kartofler","amt":"til 4","cat":"Basis","sale":false},{"name":"Sennep + fløde/creme fraiche til sovs","amt":"","cat":"Basis","sale":false}]',
 1),
('fri', 5, 'Fredag', '10. juli', 'asian', 'meat',
 'Gyoza-fredag med wokgrønt',
 'Nem fredagsmiddag: pandestegte gyoza med dip, hurtig wok af grøntsagsblanding og ris. Klar på 15 minutter.',
 'Dumplings er sikkert vindernummer hos de fleste børn — skær evt. i halve stykker til den 2-årige. Tjek pakken hvis I vil have en vegetarisk fyldning.',
 15, 'pr. pakke',
 '[{"name":"REMA 1000 Inspiring Food Gyoza med dip","amt":"2 pakker","cat":"Protein","sale":true,"price":"15,-/pk"},{"name":"REMA 1000 Lækkert & Nemt Grøntsagsblanding","amt":"400 g","cat":"Grønt","sale":true,"price":"10,-"},{"name":"Ris","amt":"til 4","cat":"Basis","sale":false}]',
 1),
('sat', 6, 'Lørdag', '11. juli', 'nordic', 'meat',
 'Nordisk marineret svin med focaccia',
 'Frilandsgris i nordisk marinade, grillet eller pandestegt, med hverdagssalat og lun focaccia — afslappet lørdagsmiddag.',
 'Skær kødet i strimler og server salaten separat, så børnene selv kan sammensætte.',
 29, 'pr. 250–350 g',
 '[{"name":"REMA 1000 Frilandsgris, nordisk marinade","amt":"300 g","cat":"Protein","sale":true,"price":"29,-"},{"name":"Møllegaarden Hverdagssalat","amt":"200 g","cat":"Grønt","sale":true,"price":"10,-"},{"name":"REMA 1000 Pane di Italia Focaccia","amt":"1 stk","cat":"Bread/Dairy","sale":true,"price":"10,-"}]',
 1),
('sun', 7, 'Søndag', '12. juli', 'nordic', 'veg',
 'Æggekage med ost og grønt (indkøbsdag)',
 'Hurtig bagt æggekage med skæreost og grøntsagsblanding, friskt brød og salat på siden — perfekt når I lige er kommet hjem fra storhandlen.',
 'Skær æggekagen i tern, så den er nem for de mindste at spise med fingrene.',
 30, 'æg, 10 stk',
 '[{"name":"Økologiske æg M/L","amt":"4 stk (rest af 10-pak)","cat":"Protein","sale":true,"price":"30,-/10stk"},{"name":"REMA 1000 Kronekilde skæreost","amt":"150 g (revet)","cat":"Bread/Dairy","sale":true,"price":"35,-/stor pk"},{"name":"REMA 1000 Lækkert & Nemt Grøntsagsblanding","amt":"200 g","cat":"Grønt","sale":true,"price":"10,-"},{"name":"REMA 1000 Bagels eller surdejsbrød","amt":"til 4","cat":"Bread/Dairy","sale":true,"price":"15,-"}]',
 1);
