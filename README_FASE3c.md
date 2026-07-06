## Fase 3c — "Søg efter nye forslag"-knap i selve appen

### Hvorfor dette var nødvendigt

Efter Fase 3b var den ENESTE måde at få nye forslag på enten at vente til
søndag (cron), eller køre `curl .../trigger` manuelt i en terminal. Det er
ikke noget familien kan gøre selv. Denne tilføjelse lægger en rigtig knap i
appen — men uden at TRIGGER_SECRET nogensinde ender i browseren.

### Hvordan det er bygget sikkert

Knappen kalder `/api/scan/trigger` på jeres **eget** Pages-projekt (bag
Cloudflare Access, så kun familien kan trykke på den). Den endpoint kører
server-side i Cloudflare og laver selv kaldet videre til `madplan-cron`
med den hemmelige header — hemmeligheden rører aldrig browseren eller
klient-JavaScript.

### Filer

| Fil | Status |
|---|---|
| `functions/api/[[route]].js` | **Erstattet** — tilføjer `POST /api/scan/trigger` |
| `public/index.html` | **Erstattet** — ny knap ved siden af faneblade, med status-tekst mens scanningen kører (tager typisk 60-90 sekunder) |

### Opsætning — NYT trin: to værdier skal sættes på madplan-app (Pages), ikke kun på madplan-cron

Disse skal sættes på **Pages-projektet**, med Pages' egen kommando (ikke
`wrangler secret put`, som er til almindelige Workers):

```bash
cd ~/madplan/madplan-app

# URL'en på jeres cron-worker (samme som I brugte til curl-testen)
npx wrangler pages secret put CRON_WORKER_URL --project-name=madplan
# indsæt: https://madplan-cron.frost-d36.workers.dev

# SAMME værdi som TRIGGER_SECRET i madplan-cron — kopiér den, opfind ikke en ny
npx wrangler pages secret put CRON_TRIGGER_SECRET --project-name=madplan
# indsæt den samme lange streng I brugte i madplan-cron/secret:trigger
```

Begge er sat som Pages "secrets" (krypterede miljøvariabler), selvom
`CRON_WORKER_URL` teknisk ikke er hemmelig — det er den nemmeste kommando
til at sætte en miljøvariabel på et Pages-projekt uden at skulle redigere i
dashboardet.

**Vigtigt:** ligesom D1-bindingen dengang, gælder disse kun for
deployments EFTER de er sat. Efter I har sat dem, skal I trigger'e en ny
deployment (push en commit, eller "Retry deployment" i dashboardet).

### Lokalt (valgfrit — kun hvis I vil teste selve knappen lokalt)

`wrangler pages dev` læser secrets fra en lokal `.dev.vars`-fil (aldrig
committet — den er allerede i `.gitignore` via `.env`-mønsteret, men tjek
lige at `.dev.vars` også står der). Opret filen selv, den findes ikke i
dette zip:

```
# ~/madplan/madplan-app/.dev.vars
CRON_WORKER_URL=https://madplan-cron.frost-d36.workers.dev
CRON_TRIGGER_SECRET=<samme streng som i madplan-cron>
```

### Sådan opfører knappen sig

- Hvis der allerede er en batch der venter på gennemsyn (`pending_review`),
  svarer endpointet med en fejl i stedet for at starte en ny scanning — for
  at undgå at I ender med to sæt forslag oven i hinanden. Gennemgå eller
  forkast den eksisterende batch først.
- Scanningen tager typisk 60-90 sekunder (Tjek-opslag + Claude-kald) —
  knappen deaktiveres og viser statustekst imens, så det er tydeligt at
  intet er gået i stå.
- Ved succes genindlæses siden automatisk, og den grønne "Forslag"-fane
  dukker op med det samme.

### Verificér

- [ ] `CRON_WORKER_URL` og `CRON_TRIGGER_SECRET` er sat på madplan-app (Pages), ikke kun på madplan-cron
- [ ] Ny deployment er kørt EFTER de blev sat
- [ ] Klik på "Søg efter nye forslag" på den rigtige, deployede side → status-tekst opdaterer sig, og efter 60-90 sek. dukker "Forslag"-fanen op
- [ ] Klik igen mens en batch stadig venter på gennemsyn → I får en tydelig fejlbesked i stedet for en ny, forvirrende ekstra batch
