# Komplett oppsett — fra null til kjørende app på 30 minutter

Følg disse stegene i rekkefølge.

## Steg 1 — Supabase-prosjekt (5 min)

1. Åpne [supabase.com](https://supabase.com/dashboard) og logg inn (eller opprett konto med samme epost du bruker på Vercel).
2. Klikk **New project**.
3. Fyll inn:
   - **Name:** `family-planner`
   - **Database password:** lag et sterkt passord. Lagre det.
   - **Region:** `Europe West (Stockholm)` — best latens for Norge.
4. Klikk **Create**. Vent ~2 min mens databasen provisioneres.

## Steg 2 — Kjør database-schemaet (3 min)

1. Åpne **SQL Editor** i Supabase venstremeny.
2. Klikk **New query**.
3. Lim inn alt fra `supabase/migrations/0001_initial_schema.sql`.
4. Klikk **Run** (eller `Ctrl/Cmd + Enter`).
5. Forvent: "Success. No rows returned"
6. Sjekk **Table Editor** — du skal nå se ~18 tabeller.

## Steg 3 — Konfigurer Auth (2 min)

> Supabase har oppdatert UI-et i 2026. Menypunktene heter nå litt annerledes enn i eldre guider.

1. Åpne **Authentication** i venstremenyen.
2. Klikk **Sign In / Providers** (under "CONFIGURATION").
3. Bekreft at **Email** står som "Enabled" i lista.
4. Klikk på **Email**-raden for å åpne detaljer.
5. (Valgfritt for utvikling) Skru av **"Confirm email"** så du slipper å bekrefte epost ved testing. Husk å skru på igjen før produksjon.
6. Klikk **URL Configuration** (også under "CONFIGURATION").
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** legg til `http://localhost:3000/**`
7. Lagre.

Når du senere deployer til Vercel: kom tilbake hit og legg Vercel-URL-en (f.eks. `https://family-planner.vercel.app`) i samme felt.

## Steg 4 — Kjør appen lokalt (10 min)

```bash
cd mvp
cp .env.local.example .env.local
```

Fyll inn `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — fra Supabase **Settings → API → Project URL**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — fra samme side, **anon public** key (ikke service_role!)

Kjør:

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Steg 5 — End-to-end test (10 min)

Test denne flyten for å verifisere at alt funker:

- [ ] Klikk "Kom i gang" → registrer med eposten din
- [ ] (Hvis du ikke skrudde av "Confirm email": klikk lenken i eposten)
- [ ] Du sendes til `/onboarding`
- [ ] Opprett familie "Familien Test"
- [ ] Du lander på `/dashboard`
- [ ] Naviger til **Admin → Gjøremål**
- [ ] Opprett "Rydde rommet" — penger 50, tildelt deg selv
- [ ] Naviger til **Gjøremål** — du ser oppgaven
- [ ] Klikk "Marker ferdig" — status blir "Venter godkjenning"
- [ ] Naviger til **Admin → Godkjenninger**
- [ ] Klikk "Godkjenn"
- [ ] Naviger til **Belønninger** — saldo viser 50 kr og transaksjon i historikken
- [ ] Naviger til **Timeplan** — opprett "Norsk" mandag 08:30–09:15
- [ ] Naviger til **Kalender** — du ser timen i ukevisningen
- [ ] Naviger til **Gå-tracker** — logg en tur 1.5 km

Hvis alle stegene fungerer: **MVP er klar!**

## Steg 6 — Push til GitHub og deploy til Vercel (5 min)

```bash
# fra rot-mappen (Family calender)
git init
git add .
git commit -m "Initial commit: family planner MVP + docs"
```

Opprett et nytt repo på [github.com/new](https://github.com/new). Ikke initialiser med README (siden vi har en allerede). Etter opprettelse:

```bash
git remote add origin git@github.com:DIN-BRUKER/family-planner.git
git branch -M main
git push -u origin main
```

Deretter:

1. Åpne [vercel.com/new](https://vercel.com/new)
2. Importer repoet
3. **VIKTIG:** Sett **Root Directory** til `mvp` (under "Build and Output Settings")
4. Under **Environment Variables**, legg inn:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://din-app.vercel.app` (Vercel viser URL etter første deploy — du kan oppdatere denne etterpå)
5. Klikk **Deploy**
6. Etter ~1 minutt er du live

Husk å gå tilbake til Supabase **Authentication → URL Configuration** og legge til Vercel-URL-en under **Site URL** og **Redirect URLs**.

## Vanlige feil

| Feil | Løsning |
|---|---|
| `Failed to fetch` på sign-in | Sjekk at NEXT_PUBLIC_SUPABASE_URL og _ANON_KEY er korrekte. Server må restartes etter endring. |
| `relation "profiles" does not exist` | Migrasjonen er ikke kjørt. Gå til Steg 2. |
| `Email link is invalid or has expired` ved bekreftelse | Sjekk at Site URL i Supabase peker til riktig domene (ikke `localhost` når du tester på Vercel). |
| Belønning utløses ikke | Sjekk **Database → Functions** i Supabase at `award_chore_reward` finnes. Sjekk **Triggers** at `trg_award_chore_reward` finnes på `chore_assignments`. |
| RLS-feil | Bruker er kanskje ikke i gruppen. Sjekk `group_members`-tabellen. |
| TypeScript-feil ved dev | Kjør `npm run typecheck`. Vanlig årsak: glemt å regenerere typer etter schema-endring. |

## Neste steg

Etter at MVP er kjørt og testet:

1. Les `docs/03-mvp-plan.md` for sprintplan
2. Velg første område for V1.5 — anbefalt: **kollisjonssjekk** (gir mest verdi, lavest risiko)
3. Inviter en testfamilie og bruk appen i en uke før neste sprint
