# 01 — Teknologivalg og begrunnelse

## Kort versjon

| Lag | Valg | Hvorfor |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript** | Moderne React, server components, deployes rett til Vercel |
| Styling | **Tailwind CSS + shadcn/ui-komponenter** | Hurtig, konsistent, lett å tilpasse for barn vs. voksen-UI |
| State / data | **TanStack Query + Server Actions** | Cache, optimistiske oppdateringer, mindre boilerplate |
| Database | **Supabase (Postgres)** | Du kjenner det allerede, full Postgres, RLS gir RBAC «gratis» |
| Auth | **Supabase Auth** | Email + Google + magic link out of the box, JWT, RLS-integrert |
| Storage | **Supabase Storage** | Profilbilder, badges, vedlegg |
| Realtime | **Supabase Realtime** | Live oppdatering av familiekalender uten polling |
| Hosting | **Vercel** | Du kjenner det, gratis nivå holder for MVP, perfekt for Next.js |
| Versjonskontroll | **GitHub** | Du kjenner det, GitHub Actions for CI |
| Mobil (senere) | **Capacitor** | Pakker samme web-app som iOS/Android — minimal merkode |
| Dato/tid | **date-fns** + **date-fns-tz** | Liten, immutable, treeshakable |
| Gjentakelse | **rrule.js** | Implementerer iCalendar RFC 5545 — samme regler som Google/Apple |
| Skjema-validering | **Zod** | Samme schema brukes i frontend og backend |
| Forms | **React Hook Form + Zod** | Standard valg, lite re-render |
| Charts | **Recharts** eller **Chart.js** | Brukes til gå-tracker og statistikk |
| Ikoner | **Lucide** | Lett, konsistent, allerede med shadcn |
| Tester | **Vitest + Playwright** | Vitest for unit, Playwright for e2e |

---

## Hvorfor Supabase i stedet for separat NestJS-backend?

Din opprinnelige spec foreslo **Node.js / NestJS + PostgreSQL**. Det er en helt fin stack, men gitt at du allerede bruker Supabase på andre prosjekter, gir dette deg:

1. **Mindre kode å skrive og vedlikeholde** — auth, RLS, storage og realtime er ferdig.
2. **Row Level Security (RLS)** dekker rollebasert tilgang direkte i databasen. En forelder ser barnas gjøremål; et barn ser bare sine egne. Reglene ligger i SQL og kan ikke omgås av en ny endepunkt.
3. **Ett mindre miljø å drifte.** Vercel + Supabase, ferdig. Ingen container-orchestrering, ingen separat API-server.
4. **Realtime ut av boksen.** Når et barn merker et gjøremål som ferdig, ser forelderen det umiddelbart i admin-dashbordet uten ekstra kode.
5. **Migreringspath er trygg.** Hvis du senere trenger tung backend-logikk (f.eks. AI-planlegging, kompleks scheduling), kan du legge til en NestJS- eller FastAPI-tjeneste *ved siden av* uten å rive opp Supabase.

### Når kan du trenge en egen backend likevel?

- Tunge bakgrunnsjobber (cron) — løses i mellomtiden via **Supabase Edge Functions** eller **Vercel Cron**.
- Integrasjoner som krever lange kjøringstider (>10 sek) — Vercel Functions har 10 sek på Hobby-plan, 60 sek på Pro.
- Kompleks ML/AI-pipeline — egen tjeneste (Python) ville vært riktig.

For Family Planner er ingenting av dette nødvendig før V3.

---

## Hvorfor Capacitor for mobil i stedet for React Native eller Flutter?

| | **Capacitor** | **React Native** | **Flutter** |
|---|---|---|---|
| Gjenbruk av Next.js-koden | 100 % | ~30 % (må omskrives med native komponenter) | 0 % (Dart) |
| Tid til mobil-app | Dager | Måneder | Måneder |
| App Store / Play Store-godkjent | Ja | Ja | Ja |
| Native ytelse for tunge animasjoner | Begrenset | God | Best |
| Krever to kodebaser? | Nei | Egentlig ja | Ja |

**Vurdering:** Family Planner er en CRUD-app med kalender og lister — ikke et 3D-spill. Capacitor er det riktige valget. Hvis appen senere må ha avansert kamera/AR-funksjonalitet, kan vi alltid legge til en native modul i Capacitor.

---

## Hvorfor RRULE for gjentakende hendelser?

Du trenger fleksible gjentakelsesregler:
- *«Hver mandag og onsdag»*
- *«Første fredag i måneden»*
- *«Hver 3. dag»*
- *«Til 1. juni»* / *«5 ganger til»*

Disse regnes som standard via **RFC 5545 (iCalendar)** — samme regler som Google Calendar, Apple Calendar og Outlook bruker internt. Ved å bruke `rrule.js` i frontend og lagre RRULE-strenger i databasen får vi:

1. **Plug-and-play sync** med Google/Outlook/Apple senere — ingen oversetting nødvendig.
2. **Én algoritme** for å generere konkrete forekomster av en regel innenfor et tidsvindu.
3. **Lett å vise og redigere** med standardkomponenter.

Eksempel på lagret RRULE: `FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260601T000000Z`

---

## Kostnadsbilde (MVP-fase)

| Tjeneste | Plan | Pris |
|---|---|---|
| Vercel | Hobby | 0 kr |
| Supabase | Free tier (500 MB DB, 50 000 MAU) | 0 kr |
| GitHub | Free | 0 kr |
| Domene (valgfritt) | familyplanner.no e.l. | ~150 kr/år |
| **Totalt** | | **0–150 kr/år** |

Når du nærmer deg grensene (typisk ved 10–50 aktive familier som bruker mye), oppgraderer du til Vercel Pro (~200 kr/mnd) og Supabase Pro (25 USD/mnd).

---

## Hva som *ikke* er valgt — og hvorfor

| Verktøy | Hvorfor ikke nå |
|---|---|
| **Prisma ORM** | Supabase har gode TS-typer auto-genererte fra schema. Mindre lag = mindre å vedlikeholde. Kan legges til senere hvis ønsket. |
| **NextAuth / Auth.js** | Supabase Auth dekker alt vi trenger og er tett integrert med RLS. |
| **Redux / Zustand** | TanStack Query + React Server Components dekker ~95 % av behovene. Vi legger til Zustand kun hvis vi trenger global UI-state (f.eks. åpne modaler). |
| **GraphQL** | Overkill for MVP. Supabase har PostgREST som gir oss REST + automatiske typer. |
| **Microservices** | Premature. Monolitt nå, splitt senere hvis det trengs. |

---

## Anbefalt mappestruktur i kodebasen

```
mvp/
├── app/                   # Next.js App Router
│   ├── (auth)/           # Login, sign-up
│   ├── (app)/            # Beskyttede ruter
│   │   ├── dashboard/
│   │   ├── kalender/
│   │   ├── gjoremal/
│   │   ├── belonninger/
│   │   ├── ga-tracker/
│   │   └── admin/
│   ├── api/              # Webhook-endepunkter, callbacks
│   └── layout.tsx
├── components/
│   ├── ui/               # shadcn-stil basis (Button, Card, ...)
│   ├── calendar/
│   ├── chores/
│   └── rewards/
├── lib/
│   ├── supabase/         # Server + client klienter
│   ├── auth/             # Hjelpefunksjoner rundt auth
│   ├── rrule/            # Wrapper rundt rrule.js
│   └── utils.ts
├── types/                # TS-typer (auto-genererte fra Supabase + egne)
├── supabase/
│   └── migrations/
├── public/
└── package.json
```
