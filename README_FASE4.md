## Fase 4 — fjern og erstat en enkelt dag, og gem familiens favoritter

### Nyt

1. **Fjern en ret for én dag** — "✕ Fjern"-knap på hvert middagskort. Dagen
   bliver tom (ikke slettet — mandag er stadig mandag), og falder automatisk
   ud af indkøbslisten indtil den fyldes igen.
2. **En tom dag tilbyder to veje til at fylde den igen:**
   - Vælg direkte fra en gemt favorit (vises som klikbare chips, hvis I har nogen)
   - "🎲 Bed om 3 forslag til [dag]" — beder Claude om 3 nye, alternative
     retter til lige præcis den dag, som ikke gentager de cuisiner/diæter
     resten af ugen allerede har rigeligt af
3. **"★ Gem"-knap** på ethvert middagskort — gemmer retten i en ny
   "Favoritter"-fane, til brug igen senere.

### Vigtigt: nyt miljø-krav på madplan-app selv

Swap-forslagene (`/api/meals/:id/swap-suggestions`) kalder Anthropics API
**direkte fra Pages-projektet** — ikke via `madplan-cron` som resten af
forslags-systemet. Det betyder `madplan-app` nu selv skal have en
Anthropic-nøgle:

```bash
cd ~/madplan/madplan-app
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=madplan
# indsæt jeres Anthropic API-nøgle (samme fra console.anthropic.com som brugt til madplan-cron — kan være samme nøgle, eller en ny, op til jer)
```

Husk samme regel som altid: dette gælder kun deployments EFTER secret'en er
sat — push en commit eller "Retry deployment" bagefter.

**Til lokal test**, tilføj i `.dev.vars` (findes ikke i dette zip, I har
allerede filen fra Fase 3c — bare tilføj en linje):
```
ANTHROPIC_API_KEY=<jeres nøgle>
```

### Filer

| Fil | Status |
|---|---|
| `schema_fase4.sql` | **Ny** — `is_empty`-kolonne på `meals` (ALTER TABLE, kør kun én gang) + ny `favorites`-tabel |
| `functions/api/[[route]].js` | **Erstattet** — tilføjer clear/fill/swap-suggestions/favorites-endpoints |
| `public/index.html` | **Erstattet** — fjern/gem-knapper, tom-dag-kort, ny Favoritter-fane |

### Opsætning

```bash
cd ~/madplan/madplan-app
# kopiér schema_fase4.sql, functions/api/[[route]].js, public/index.html herind

npx wrangler d1 execute madplan-db --local --file=schema_fase4.sql
npx wrangler d1 execute madplan-db --remote --file=schema_fase4.sql

npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=madplan
# + tilføj samme værdi i .dev.vars til lokal test

npm run dev   # verificér, push til main bagefter
```

### Verificér

- [ ] "✕ Fjern" tømmer dagen — kortet bliver stiplet/gråt med "Ingen ret valgt endnu"
- [ ] Den tomme dag falder ud af indkøbslisten (tjek totalen ændrer sig)
- [ ] "★ Gem" på en rigtig ret opretter en ny favorit — synlig i Favoritter-fanen
- [ ] Klik på en favorit-chip på en tom dag fylder dagen med favorittens indhold med det samme
- [ ] "🎲 Bed om 3 forslag" viser en loading-tekst i 10-20 sekunder, derefter 3 forskellige forslag med "Brug denne"-knapper
- [ ] At klikke "Brug denne" på et swap-forslag fylder dagen korrekt og opdaterer indkøbslisten
- [ ] At forsøge at gemme samme titel som favorit to gange giver en besked i stedet for en dublet
- [ ] Fjern en favorit fra Favoritter-fanen — den forsvinder og er væk permanent
