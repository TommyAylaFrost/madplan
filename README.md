# Madplan

Delt madplan-app til familien: ugentlige retforslag baseret på REMA 1000's
tilbudsavis, lager med udløbsdato, og en fælles indkøbsliste.

Dette repo er **Fase 0** af 5 — se roadmap nederst. Målet lige nu er blot:
en side der kræver login og virker på jeres eget domæne.

## Sådan får du det op at køre

### 1. Opret GitHub-repo

```bash
cd madplan-app
git remote add origin https://github.com/<dit-brugernavn>/madplan.git
git push -u origin main
```

(Reposet er allerede `git init`'et og har et første commit — du skal bare
tilføje din egen remote og pushe.)

Anbefaling: gør reposet **privat**, i hvert fald indtil Cloudflare Access er
sat op — der er ikke noget følsomt i koden selv, men ingen grund til at
gøre det offentligt.

### 2. Opret Cloudflare Pages-projekt

1. Gå til Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Vælg dit nye `madplan`-repo.
3. Build-indstillinger:
   - Framework preset: **None**
   - Build command: *(tom)*
   - Build output directory: `public`
4. Deploy. Du får en `madplan.pages.dev`-adresse — besøg den og bekræft at
   du ser "Madplan er live" og at API-status siger "kører ✓".

### 3. Kobl jeres domæne på

I Pages-projektet → **Custom domains** → tilføj fx `madplan.dit-domæne.dk`
(en underdomæne er nemmere end root-domænet, og forstyrrer ikke resten af
jeres DNS). Cloudflare sætter selv DNS-recorden op, hvis domænet allerede
ligger hos Cloudflare.

### 4. Sæt login op med Cloudflare Access

1. Gå til **Zero Trust** dashboard → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Application domain: `madplan.dit-domæne.dk`.
3. Policy: **Include** → **Emails** → indtast e-mailadresserne på dem der
   skal have adgang (dig, din forlovede, evt. andre familiemedlemmer).
4. Login-metode: e-mail one-time-code er nemmest at starte med (ingen
   opsætning) — I kan tilføje Google-login senere hvis I vil.
5. Gem, og besøg domænet i et privat/incognito-vindue — I bør nu blive
   mødt af en Cloudflare-login-side, før "Madplan er live" vises.

### 5. Verificér

- [ ] `madplan.dit-domæne.dk` beder om login, før siden vises
- [ ] Efter login vises "Madplan er live"
- [ ] API-status siger "kører ✓"
- [ ] En person der IKKE er på e-mail-listen kan ikke komme ind

Når alle fire er grønne, er Fase 0 færdig.

## Lokal udvikling

```bash
npm install
npm run dev
```

Kører siden + `/api/health` lokalt via Wrangler (kræver Node 18+).

## Roadmap

- **Fase 0** — dette repo: scaffold, GitHub → Cloudflare Pages, domæne, Access-login. ✅ når checklisten ovenfor er grøn.
- **Fase 1** — Kernefunktionalitet: rigtig frontend for ugeplan/lager/indkøbsliste, D1-database, API-endpoints (Hono).
- **Fase 2** — Udløbsdato på lagervarer + "udløber snart"-advarsler.
- **Fase 3** — Automatisk cron-job der scanner REMA 1000's avis hver weekend og foreslår 10 retter til ugen (via Anthropic API).
- **Fase 4** — Holdbarheds-baseret rækkefølge (fisk/hakket kød tidligt i ugen, fryser/kolonial senere) + notifikationer.
