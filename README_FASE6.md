## Fase 6 — lageret "lærer" jeres stregkoder

### Hvad dette løser

Fase 5's barcode-scanning virker, men Open Food Facts har tynd dækning af
REMA 1000's egne private label-varer (bekræftet direkte: stregkode
4005401152200 gav `status: 0, "product not found"`). Denne fase løser det
ved at lade appen selv huske, hvad en stregkode betyder, første gang I
skriver det manuelt — permanent, i jeres egen database.

### Hvordan det virker nu

1. Ved scanning tjekkes **først jeres egen database** (`barcode_overrides`) — hurtigere end at spørge Open Food Facts, og virker for alt I selv har lært den
2. Hvis ikke fundet lokalt, falder den tilbage til Open Food Facts (som før)
3. Hvis heller ikke fundet der, skriver I navnet manuelt som altid
4. **Uanset hvor navnet kom fra**, gemmes stregkode → navn + kategori lokalt, når varen rent faktisk tilføjes til lageret
5. Næste gang samme stregkode scannes — af hvem som helst i familien — er både navn OG kategori udfyldt med det samme, ingen ekstern opslag nødvendig

Over tid bliver jeres lokale database bedre end Open Food Facts til
*jeres* husholdnings faktiske indkøb, uden nogen ekstra opsætning eller omkostning.

### Filer

| Fil | Status |
|---|---|
| `schema_fase6.sql` | **Ny** — `barcode_overrides`-tabel, additiv |
| `functions/api/[[route]].js` | **Erstattet** — tilføjer `GET /api/barcode/:code` og `POST /api/barcode` |
| `public/index.html` | **Erstattet** — tjekker lokal hukommelse først, husker efter hver tilføjelse, tydeliggør om varen er "genkendt fra jeres eget lager" vs. Open Food Facts vs. ukendt |

### Opsætning

```bash
cd ~/madplan/madplan-app
# kopiér schema_fase6.sql, functions/api/[[route]].js, public/index.html herind

npx wrangler d1 execute madplan-db --local --file=schema_fase6.sql
npx wrangler d1 execute madplan-db --remote --file=schema_fase6.sql

npm run dev   # verificér, push til main bagefter
```

Ingen nye secrets krævet.

### Verificér

- [ ] Scan en stregkode I ved ikke er i Open Food Facts (fx en REMA 1000-vare) → skriv navn manuelt → tilføj
- [ ] Scan SAMME stregkode igen → statusteksten siger nu "Genkendt fra jeres eget lager", navn og kategori er allerede udfyldt
- [ ] En stregkode der findes i Open Food Facts, virker stadig som i Fase 5 første gang
- [ ] Efter at have tilføjet en OFF-fundet vare, giver et gensyn med samme stregkode nu "Genkendt fra jeres eget lager" i stedet for "Fundet via Open Food Facts" — bekræfter den lokale cache overtager
