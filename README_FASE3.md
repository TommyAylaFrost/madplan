## Fase 3 — automatisk avis-scanning + 15 forslag om ugen

### Vigtigt: dette kræver en ANDEN Cloudflare-ressource end Pages

Cloudflare Pages understøtter ikke Cron Triggers direkte — de findes kun på
almindelige **Workers**. Derfor består Fase 3 af to dele:

1. **`madplan-app`** (jeres eksisterende Pages-projekt) — får nye API-endpoints
   og en ny "Forslag"-fane, men ændres ikke arkitektonisk.
2. **`worker-cron/`** — en helt ny, selvstændig Worker, deployet separat, som
   kører hver søndag og skriver forslag ind i den **samme** D1-database.

To deployments, én delt database. Det er den prisbillige/simple løsning uden
at bygge en kø eller separat backend-service.

### Filer

| Fil | Status |
|---|---|
| `schema_fase3.sql` | **Ny** — tilføjer `suggestion_batches` og `suggestions`. Bruger `CREATE TABLE IF NOT EXISTS`, ingen `DROP` — sikker at køre oveni jeres levende data. |
| `functions/api/[[route]].js` | **Erstattet** — tilføjer `/api/suggestions/latest`, `/api/suggestions/:id/apply`, `/api/suggestions/:id/discard` |
| `public/index.html` | **Erstattet** — ny "Forslag"-fane: vælg 7 af 15, fordel dem over ugen, bekræft |
| `worker-cron/src/index.js` | **Ny** — selve scanningen: finder næste uges avis, henter tilbud, spørger Claude, gemmer 15 forslag |
| `worker-cron/wrangler.toml` | **Ny** — cron-schema (søndag 05:00 UTC) + D1-binding |
| `worker-cron/package.json` | **Ny** — deploy- og secret-scripts |

### Verificeret inden denne blev skrevet

`https://squid-api.tjek.com/v2/catalogs?dealer_ids=11deC&order_by=-run_from`
er testet direkte og returnerer reelt REMA 1000's aviser med korrekte
`run_from`/`run_till`-datoer og labels som "Uge 28". Det er stadig en
udokumenteret tredjeparts-API — hvis Tjek ændrer noget uden varsel, fejler
scanningen synligt (se "Hvis scanningen fejler" nedenfor) i stedet for at
give jer en tavs, tom uge.

### Opsætning

**1. Migrér den nye database-tilføjelse (mod jeres eksisterende madplan-app):**
```bash
cd ~/madplan/madplan-app
# kopiér schema_fase3.sql, functions/api/[[route]].js og public/index.html herind først
npx wrangler d1 execute madplan-db --local --file=schema_fase3.sql
npx wrangler d1 execute madplan-db --remote --file=schema_fase3.sql
```

**2. Sæt cron-workeren op** (i en ny mappe, fx `~/madplan/madplan-cron`):
```bash
cd ~/madplan
cp -r madplan-fase3/worker-cron madplan-cron
cd madplan-cron
npm install
```

Ret `wrangler.toml`: indsæt samme `database_id` som i `madplan-app/wrangler.toml`.

**3. Sæt secrets** (aldrig i kode — kun via `wrangler secret put`, som gemmer dem krypteret hos Cloudflare):
```bash
npm run secret:anthropic
# indsæt din Anthropic API-nøgle når den beder om det

npm run secret:trigger
# find på en tilfældig lang streng, fx: openssl rand -hex 32
# denne bruges til at teste manuelt uden at vente til søndag
```

**4. Deploy workeren:**
```bash
npm run deploy
```

Dette opretter en ny, separat Worker (`madplan-cron`) i Cloudflare — den har
intet med jeres Pages-domæne at gøre og kræver ikke Access-login, da kun
`/trigger`-endpointet er tilgængeligt og det kræver en hemmelig header.

**5. Test manuelt** (i stedet for at vente på søndag):
```bash
curl -X POST https://madplan-cron.<din-cloudflare-subdomain>.workers.dev/trigger \
  -H "x-trigger-secret: <den streng du satte i secret:trigger>"
```

Forvent et svar som:
```json
{"ok": true, "batchId": 1, "catalog": "Uge 29", "count": 15}
```

**6. Push de ændrede filer i `madplan-app` til `main`** som normalt, så
Pages-deploy'et får den nye "Forslag"-fane og de nye endpoints.

### Sådan virker "review og vælg"-flowet

1. Cron-workeren (eller det manuelle trigger-kald) genererer 15 forslag og
   gemmer dem som en `pending_review`-batch.
2. Alle der åbner appen ser en grøn banner: "15 nye forslag klar til
   gennemsyn" — og en ny "Forslag"-fane med en prik.
3. I fanen: klik retter til/fra (op til 7). Tæller viser "X / 7 valgt".
4. Når præcis 7 er valgt: "Se ugefordeling" bliver aktiv. Klik den.
5. Forslagene er nu sorteret automatisk efter *perishability* — det mest
   letfordærvelige (frisk fisk, hakket kød) lander mandag, det mest holdbare
   (frost, dåser) lander søndag. Brug pilene til at bytte om, hvis I er
   uenige med rækkefølgen.
6. "Bekræft og brug som ugeplan" — overskriver de 7 dage i Ugeplan-fanen med
   de valgte retter, nulstiller den afkrydsede indkøbsliste (ny uge = ny
   liste), og markerer batchen som `applied`.
7. "Forkast alle forslag" er tilgængelig på ethvert tidspunkt i trin 3 — så
   forsvinder banneret og fanen, og jeres nuværende ugeplan rører sig ikke.

### Hvis scanningen fejler

Hvis Tjek-API'et ændrer sig, eller Claude ikke returnerer gyldigt JSON, får
I i stedet en rød banner: "Ugentlig scanning fejlede: [fejlbesked]". Jeres
eksisterende ugeplan er upåvirket — I kan stadig redigere den manuelt, og I
kan køre `curl`-kommandoen fra trin 5 igen for at prøve forfra, når fejlen
er rettet.

### Verificér

- [ ] `curl .../trigger` (trin 5) returnerer `{"ok": true, ...}` med 15 retter
- [ ] "Forslag"-fanen dukker op med en grøn banner på forsiden
- [ ] Du kan vælge præcis 7 af de 15 — tælleren opdaterer sig live
- [ ] "Se ugefordeling" er deaktiveret indtil præcis 7 er valgt
- [ ] Ugefordelingen virker plausibel — fisk/kød der hurtigt bliver dårligt ligger tidligt, dåser/frost ligger sent
- [ ] Efter "Bekræft" viser Ugeplan-fanen de 7 nye retter med rigtige datoer for den korrekte uge
- [ ] Indkøbslisten er nulstillet (ingen gamle afkrydsninger fra sidste uge)
- [ ] "Forkast alle forslag" fjerner banneren uden at ændre den nuværende ugeplan

### Omkostninger og drift

- Cron kører én gang om ugen — ét Claude-kald, prisen er ubetydelig uanset model.
- `env.CLAUDE_MODEL` i `worker-cron/wrangler.toml` kan sættes eksplicit hvis
  I vil skifte model (standard er `claude-sonnet-5` hvis intet er sat).
- `wrangler tail` (kør `npm run tail` i `madplan-cron`) viser live-logs, hvis
  I vil se hvad der sker under næste automatiske kørsel.
