## Fase 5 — scan en stregkode for at tilføje den til lageret

### Hvordan det virker

To ting kædet sammen, begge kører direkte i browseren — ingen nye
Cloudflare-secrets, ingen ny backend-endpoint, ingen ny database-tabel:

1. **Kamera → stregkode-nummer**: biblioteket [html5-qrcode](https://github.com/mebjas/html5-qrcode)
   (indlæst via CDN) læser kameraets billede live og genkender EAN/UPC-koder.
2. **Stregkode-nummer → produktnavn**: opslag mod [Open Food Facts](https://world.openfoodfacts.org)'
   gratis, offentlige API — intet API-nøgle krævet, kaldes direkte fra browseren.

Hvis stregkoden ikke findes i Open Food Facts (almindeligt for mindre danske
mærker), falder det bare tilbage til at I selv skriver navnet — intet går i
stykker, det er bare som at taste det manuelt fra starten.

### Filer

| Fil | Status |
|---|---|
| `public/index.html` | **Erstattet** — tilføjer scan-biblioteket, en "📷 Scan stregkode"-knap i Lager-fanen, og en kamera-modal |

Ingen ændringer i `schema.sql`, `functions/api/[[route]].js`, eller
`madplan-cron` — denne funktion bruger den eksisterende `POST /api/stock`
endpoint, uændret.

### Vigtigt: kræver HTTPS og skal testes på en rigtig telefon

Kameraadgang i browsere kræver en sikker kontekst (HTTPS) — det har I
allerede via Cloudflare Pages, så intet ekstra at opsætte. Men test dette
på en faktisk telefon, ikke kun på laptoppen:
- Kamera-tilladelsesprompten opfører sig forskelligt på iPhone/Safari vs.
  Android/Chrome vs. desktop
- `localhost` tæller normalt også som en sikker kontekst, så lokal test
  virker fint på selve udviklingsmaskinen — men test alligevel på telefonen
  mod jeres rigtige domæne, det er der det faktisk skal bruges

### Opsætning

```bash
cd ~/madplan/madplan-app
# kopiér public/index.html herind (erstatter Fase 4-versionen)
npm run dev   # verificér lokalt (kamera virker også på localhost)
```

Ingen migrationer, ingen secrets — bare push til `main` som normalt bagefter.

### Sådan bruges det

1. Gå til Lager-fanen → "📷 Scan stregkode"
2. Ret kameraet mod stregkoden på varen
3. Ved genkendelse: automatisk opslag. Findes varen, er navnet udfyldt —
   ellers er feltet tomt og I skriver det selv
4. Vælg kategori (Køleskab/Fryser/Kolonial) og evt. udløbsdato
5. "Tilføj til lager" — varen dukker op i den valgte kategoris liste med det samme

### Verificér

- [ ] "📷 Scan stregkode" åbner en kamera-modal og beder om kameratilladelse
- [ ] En genkendt stregkode (prøv en almindelig dagligvare) udfylder navnet automatisk
- [ ] En ukendt/utydelig stregkode falder tilbage til tomt navnefelt uden at crashe
- [ ] "Scan igen" genstarter kameraet uden at skulle lukke og åbne modalen forfra
- [ ] "×" lukker modalen og slukker kameraet ordentligt (tjek at kamera-LED'en slukker, hvis telefonen har en)
- [ ] Den tilføjede vare dukker op i den rigtige kategori i Lager med det samme, ingen genindlæsning nødvendig
