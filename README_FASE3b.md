## Fase 3b — planlæg næste uge uden at røre den aktive

### Hvad ændrede sig

Én ny, lille tabel (`staged_assignments`) — ingen ændring af `meals`-tabellens
struktur, så dette er en langt mindre migration end det ville have været at
lave en fuld "flere uger side om side"-model.

| Fil | Status |
|---|---|
| `schema_fase3b.sql` | **Ny** — kun `staged_assignments`, additiv |
| `functions/api/[[route]].js` | **Erstattet** — tilføjer `/api/staged/latest`, `/api/staged/:id/promote`, og en `/stage`-variant af apply-endpointet. Den gamle `/apply` opfører sig præcis som før. |
| `public/index.html` | **Erstattet** — ugefordelings-trinnet har nu to knapper i stedet for én, plus en ny blå banner når en kommende uge ligger klar |

### Sådan virker det nu

Når I har valgt 7 retter og set ugefordelingen, er der to veje:

- **"Sæt som denne uges plan nu"** — samme opførsel som hele vejen igennem
  Fase 3: overskriver den aktive uge med det samme. Brug denne når
  omstændigheder ændrer sig midt i en uge.
- **"Gem til senere (kommende uge)"** — rører IKKE jeres nuværende ugeplan.
  Fordelingen gemmes, og en blå banner ("📅 Uge XX er bygget og klar...")
  dukker op for alle, med to knapper: **Forkast**, eller **"Sæt som aktiv
  ugeplan nu"** — det sidste er det bevidste øjeblik hvor I rent faktisk
  skifter over, fx søndag morgen efter storhandlen.

Så I kan nu godt forberede næste uges plan tirsdag, mens denne uges middage
kører helt uforstyrret — og først aktivere den nye, når I selv vælger det.

### Opsætning

```bash
cd ~/madplan/madplan-app
# kopiér schema_fase3b.sql, functions/api/[[route]].js, public/index.html herind
npx wrangler d1 execute madplan-db --local --file=schema_fase3b.sql
npx wrangler d1 execute madplan-db --remote --file=schema_fase3b.sql
npm run dev   # verificér lokalt før push
```

Ingen ændringer nødvendige i `madplan-cron` — den skriver stadig bare
`pending_review`-batches som før; hvad I vælger at gøre med dem (anvend nu
eller gem til senere) er alene styret i `madplan-app`.

### Verificér

- [ ] Vælg 7 forslag fra en batch, klik "Gem til senere" — jeres nuværende Ugeplan-fane er uændret
- [ ] En blå banner med korrekt uge-label dukker op
- [ ] "Sæt som aktiv ugeplan nu" skifter Ugeplan-fanen til den nye uges 7 retter, med korrekte datoer
- [ ] Indkøbslisten er nulstillet efter forfremmelse (ingen gamle afkrydsninger)
- [ ] "Forkast" på den blå banner fjerner den uden at røre noget andet
- [ ] Den gamle vej ("Sæt som denne uges plan nu") virker stadig præcis som i Fase 3 — øjeblikkelig overskrivning
