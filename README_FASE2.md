## Fase 2 — udløbsdato på lagervarer

### Filer der er ændret

| Fil | Status |
|---|---|
| `functions/api/[[route]].js` | **Erstattet** — tilføjer `PATCH /api/stock/:id` til at sætte/rette udløbsdato på en vare der allerede findes. `GET /api/stock` sorterer nu efter udløbsdato (dem der udløber snart, først). |
| `public/index.html` | **Erstattet** — dato-felt ved oprettelse af en vare, farvede badges (rød/gul/grå) på hver vare, en "udløber snart"-banner øverst på siden, og en lille prik på "Lager"-fanen når noget kræver opmærksomhed. |

Ingen ændringer i `schema.sql` — `expiry_date`-kolonnen var allerede der fra Fase 1, bare ubrugt i UI'en indtil nu.

### Sådan virker det

- Når du tilføjer en vare i Lager, kan du valgfrit sætte en dato ved siden af.
- Hver vare i lager-listen viser status:
  - **Grå** = udløber om mere end 5 dage (eller ingen dato sat)
  - **Gul** = udløber om 5 dage eller mindre
  - **Rød** = udløber om 2 dage, i dag, eller er allerede udløbet
- Disse tærskler (2 og 5 dage) er justerbare — de sidder øverst i `<script>`-blokken i `index.html` som `URGENT_DAYS` og `SOON_DAYS`, hvis I vil ændre dem.
- En rød/gul vare der matcher en ingrediens i en af ugens retter, får samme advarsel vist direkte på middagskortet og i "Allerede på lager"-sektionen af indkøbslisten — så I kan se hvis en ret faktisk er en god idé at lave snart, fordi noget skal bruges.
- Glemte du datoen ved oprettelse? Klik ind i dato-feltet ud for varen i lager-listen når som helst for at tilføje eller rette den — det går direkte til databasen (`PATCH /api/stock/:id`).

### Verificér

- [ ] Tilføj en vare med en udløbsdato 1 dag ude i fremtiden — den skal vise sig med rød baggrund og "udløber om 1 dag"
- [ ] Tilføj en vare med en dato 10 dage ude — grå/neutral
- [ ] Rediger datoen på en eksisterende vare direkte i listen — genindlæs siden, bekræft ændringen er gemt
- [ ] Sæt en dato der matcher en ingrediens i en af ugens retter (fx "gulerødder" med en dato om 2 dage) — bekræft badge'en dukker op både på middagskortet og i indkøbslistens "Allerede på lager"-sektion
- [ ] "Lager"-fanen får en lille rød prik når mindst én vare er rød/gul

### Bevidst udeladt (kommer evt. senere)

- Automatisk kobling mellem "denne vare er ved at løbe ud" og "flyt en ret der bruger den, tidligere i ugen" — det kræver mere logik og hænger bedre sammen med Fase 3's automatiske forslag, hvor holdbarhed allerede indgår i rækkefølgen af de 10 forslag.
