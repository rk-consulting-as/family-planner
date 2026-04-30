# Family Planner — Prosjektoversikt

> Familie- og gruppeplanlegger som kombinerer ukekalender, skoletimeplan, gjøremål, belønninger, gå-tracker og delte kalendere — bygget som responsiv web-app, klar til å pakkes som iOS/Android-app senere.

**Eier:** Rune Kvelland
**Status:** MVP-spesifikasjon + kjørbar prototype
**Dato startet:** 2026-04-30

---

## Innhold i denne mappa

| Mappe / fil | Hva det er |
|---|---|
| `README.md` | Denne filen — overordnet oversikt |
| `docs/01-tech-stack.md` | Anbefalt teknologivalg og begrunnelse |
| `docs/02-produktspesifikasjon.md` | Komplett funksjonsspesifikasjon (alle 17 områder) |
| `docs/03-mvp-plan.md` | Hva som er med i MVP, sprintplan, akseptansekriterier |
| `docs/04-database-schema.md` | Postgres/Supabase schema med relasjoner og RLS |
| `docs/05-api-endpoints.md` | API-design (Server Actions + Supabase RPC) |
| `docs/06-brukerflyt-og-sider.md` | User journeys og sitemap |
| `docs/07-roadmap.md` | V1 → V2 → V3 plan |
| `docs/08-sikkerhet.md` | Sikkerhet, GDPR, barneprofiler |
| `docs/09-calendar-sync.md` | Google/Outlook/Apple integrasjon |
| `docs/10-reward-logic.md` | Belønningsmotor i detalj |
| `docs/11-frontend-components.md` | Frontend-komponentbibliotek |
| `supabase/migrations/` | Klar-til-kjøring SQL for Supabase |
| `mvp/` | Kjørbar Next.js + Supabase prototype |

---

## Teknologivalg (kort)

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn-stil komponenter
- **Backend / DB / Auth:** Supabase (Postgres, Auth, Storage, Realtime, RLS)
- **Hosting:** Vercel (web), Supabase (DB)
- **Mobil senere:** Capacitor wrapper (samme kodebase → iOS + Android)
- **Versjonskontroll:** GitHub
- **Dato/gjentakelse:** `date-fns` + `rrule` (kalender-standard RRULE-regler)

Se `docs/01-tech-stack.md` for full begrunnelse.

---

## Slik starter du MVP-prototypen lokalt

1. Opprett et Supabase-prosjekt på [supabase.com](https://supabase.com) (gratis nivå holder lenge)
2. Gå til **SQL Editor** i Supabase og kjør innholdet i `supabase/migrations/0001_initial_schema.sql`
3. Hent **Project URL** og **anon key** fra Supabase → Settings → API
4. I `mvp/`-mappa:
   ```bash
   cp .env.local.example .env.local
   # lim inn URL + anon key i .env.local
   npm install
   npm run dev
   ```
5. Åpne http://localhost:3000

Full setup-guide i `mvp/README.md`.

---

## Slik deployer du til Vercel

1. Push `mvp/`-mappa til et GitHub-repo
2. Importer i Vercel
3. Legg inn samme env vars som lokalt
4. Deploy — ferdig

---

## Veien videre

| Fase | Innhold | Estimat |
|---|---|---|
| **MVP (V1)** | Auth, familie, ukekalender, gjøremål, basic belønninger, gå-tracker | 4–6 uker |
| **V1.5** | Gjentakende hendelser, kollisjonssjekk, varsler (email + in-app) | 3–4 uker |
| **V2** | Google Calendar sync, push-varsler, mobile apps via Capacitor | 4–6 uker |
| **V3** | Outlook/Apple sync, klubbe/team-modus, AI-assistert planlegging | 6–8 uker |

Detaljer i `docs/07-roadmap.md`.
