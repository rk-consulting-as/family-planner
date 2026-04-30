# Family Planner — MVP

Next.js 14 + Supabase prototype. Kjøres lokalt på 5 minutter.

## 1. Forutsetninger

- Node.js 18.18+ (helst 20 LTS)
- En gratis Supabase-konto (https://supabase.com)
- Git + GitHub-konto (for senere Vercel-deploy)

## 2. Sett opp Supabase

1. Gå til https://supabase.com/dashboard, klikk **New project**.
2. Navn: `family-planner`. Velg region (Stockholm anbefales for Norge). Sett et databasepassord — lagre det.
3. Vent ~2 min mens prosjektet provisioneres.
4. Åpne **SQL Editor** (venstremeny) → **New query**.
5. Lim inn hele innholdet i `../supabase/migrations/0001_initial_schema.sql` og klikk **Run**.
6. Du bør se "Success. No rows returned" — schemaet er nå live.
7. Gå til **Authentication → Providers** og sørg for at Email er aktivert. For lokal testing: skru av "Confirm email" midlertidig (Settings → Email Auth) — så slipper du e-post-bekreftelse på sign-up.

## 3. Kjør appen lokalt

```bash
cd mvp
cp .env.local.example .env.local
```

Åpne `.env.local` og fyll inn:

- `NEXT_PUBLIC_SUPABASE_URL` — finnes i Supabase → Settings → API → "Project URL"
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — samme side, "anon public" key

Deretter:

```bash
npm install
npm run dev
```

Åpne http://localhost:3000.

## 4. Test gjennom

1. Klikk **Kom i gang** → opprett konto med eposten din
2. Du sendes til onboarding → opprett en familie ("Familien Hansen")
3. Du lander på dashbordet — invitasjonskoden vises i et kort
4. Åpne **Admin → Gjøremål** og opprett "Rydde rommet" (50 kr, krever godkjenning)
5. Åpne **Gjøremål** og marker den som ferdig
6. Åpne **Admin → Godkjenninger** og godkjenn — saldoen oppdateres
7. Åpne **Belønninger** og se transaksjonshistorikken
8. Åpne **Timeplan** og legg til en skoletime
9. Åpne **Kalender** og se timen i ukevisningen
10. Åpne **Gå-tracker** og logg en tur

For å teste flerbruker: åpne en privat-fane, registrer en ny konto, bruk invitasjonskoden fra steg 3 i onboarding.

## 5. Deploy til Vercel

```bash
git init
git add .
git commit -m "MVP family planner"
# Opprett et repo på github.com og push
git remote add origin git@github.com:DIN-BRUKER/family-planner.git
git branch -M main
git push -u origin main
```

Deretter:

1. Åpne https://vercel.com/new og importer repoet
2. **Root Directory:** `mvp/` (viktig — siden repoet inneholder docs også)
3. Klikk **Environment Variables** og legg inn de samme to verdiene som i `.env.local`
4. **Deploy** — etter ~1 min er du live på `*.vercel.app`

## 6. Hva er med i MVP

- ✅ Auth (epost + passord)
- ✅ Opprett/bli med i familie via kode
- ✅ Roller: owner / admin / member (RLS i database)
- ✅ Skoletimeplan (med ukentlig RRULE)
- ✅ Gjøremål (direkte tildeling + pool)
- ✅ Marker ferdig + foreldre-godkjenning + automatisk belønning (DB-trigger)
- ✅ Belønningstyper: penger, skjermtid (min), poeng
- ✅ Saldo-visning + transaksjonshistorikk
- ✅ Manuell gå-tracker (km, varighet, deltakere)
- ✅ Ukekalender (kombinert familievisning, fargekoding per medlem)
- ✅ Mobiltilpasset (bunn-nav på mobile, top-nav på desktop)

## 7. Hva er IKKE i MVP

Se `../docs/03-mvp-plan.md` for full liste, men kort:

- Browser/mobile push-varsler (V2)
- Kollisjonssjekk på tvers av medlemmer (V1.5)
- Avansert RRULE-editor (V1.5)
- Måneds-visning (V1.5)
- Drag-and-drop i kalender (V1.5)
- Google/Outlook/Apple sync (V2)
- Mål-system (V1.5 — schema er klart)
- Bilde-bevis for gjøremål (V2)
- E-post-utsending fra invitasjoner (V1.5 — schema og action er klart, bare SMTP gjenstår)

## 8. Mappestruktur

```
mvp/
├── app/
│   ├── (auth)/             # sign-in, sign-up
│   ├── (app)/              # auth-protected: dashboard, kalender, gjoremal, ...
│   │   ├── admin/
│   │   ├── kalender/
│   │   ├── gjoremal/
│   │   └── ...
│   ├── auth/callback/      # Supabase OAuth callback
│   ├── onboarding/         # opprett/bli med i familie
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # landingsside
├── components/
│   ├── ui/                 # Button, Card, Input, Badge, EmptyState
│   ├── layout/             # TopNav, MobileBottomNav
│   └── calendar/           # WeekView
├── lib/
│   ├── supabase/           # client, server, middleware
│   ├── actions/            # Server Actions: groups, chores, walking, timetable
│   ├── types/database.ts   # Supabase TS-typer
│   ├── queries.ts          # getActiveContext()
│   └── utils.ts
├── middleware.ts           # auth-redirect
└── package.json
```

## 9. Vanlige problemer

| Problem | Løsning |
|---|---|
| "relation profiles does not exist" | Du har ikke kjørt SQL-migrasjonen i Supabase. Se steg 2.5. |
| Etter sign-up: må bekrefte e-post først | Skru av "Confirm email" i Supabase auth-settings for raskere lokal testing. |
| Kunne ikke se ny opprettet familie | Sjekk at du er innlogget som samme bruker som opprettet den. RLS hindrer alt annet. |
| Belønning ble ikke utbetalt etter godkjenning | Sjekk at SQL-trigger `trg_award_chore_reward` er opprettet (se Migration → Functions i Supabase). |

## 10. Hva nå?

Se `../README.md` for prosjektoversikt og `../docs/` for full dokumentasjon. Spesielt:

- `../docs/03-mvp-plan.md` — neste sprintplan
- `../docs/07-roadmap.md` — V1.5/V2/V3
- `../docs/08-sikkerhet.md` — barneprofiler og GDPR
