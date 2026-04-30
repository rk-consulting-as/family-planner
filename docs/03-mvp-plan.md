# 03 — MVP-plan steg for steg

## Mål for MVP (V1)

> *Gi en familie verdi fra dag én:* Foreldre kan opprette en familie, invitere barn, sette opp ukens skoletimer og gjøremål, gi belønninger og se en kombinert ukekalender. Barn kan logge inn, se hva de skal gjøre, hake av og samle belønninger.

## Hva som er **i MVP**

✅ Auth (email + passord)
✅ Opprett/bli med i familie
✅ Roller: Owner / Admin / Member
✅ Inviter via epost-link eller kode
✅ Profiler med navn, alder, fargen sin, avatar
✅ Skoletimeplan (med ukentlig RRULE)
✅ Hjemmegjøremål (tildelt ELLER pool)
✅ Markér som ferdig + foreldregodkjenning
✅ Belønningstyper: penger, screen-time, poeng (badges senere)
✅ Saldo per barn + transaksjonshistorikk
✅ Manuell gå-tracker + ukentlig km-mål
✅ Mål-system (chore_count + walking_distance)
✅ Ukekalender-visning (per medlem + kombinert familie)
✅ Dag-visning
✅ In-app varsler (notifications-tabell + bell-ikon)
✅ E-post-varsler (Supabase SMTP)
✅ Mobiltilpasset responsivt design

## Hva som er **utenfor MVP** (V1.5+)

❌ Browser/mobile push-varsler
❌ Kollisjonssjekk på tvers av medlemmer
❌ Avansert RRULE-editor (kun forhåndsdefinerte i MVP)
❌ Måneds-visning
❌ Drag-and-drop i kalender
❌ Google/Outlook/Apple sync
❌ Bilde-bevis for gjøremål
❌ Automatisk Strava/Apple Health import
❌ Klubbe/team-modus (senere)
❌ Offline / PWA
❌ AI-foreslåtte planer

---

## Sprint-plan (6 uker, antar én utvikler)

### Sprint 0 — Setup (1–2 dager)

- [ ] Opprett Supabase-prosjekt
- [ ] Opprett GitHub-repo + connect Vercel
- [ ] Kjør `0001_initial_schema.sql` i Supabase
- [ ] Sett env vars i Vercel
- [ ] Deploy «hello world» fra `mvp/`-mappa

**Akseptanse:** App er live på `*.vercel.app`, forbinder til Supabase.

---

### Sprint 1 — Auth og familier (1 uke)

- [ ] Sign up med epost + passord
- [ ] Logg inn / logg ut
- [ ] Glemt passord
- [ ] «Onboarding»-flyt: «Opprett familie» eller «Bli med via kode»
- [ ] Profilside: navn, alder, farge, avatar
- [ ] Inviter medlem (via epost-link med 7-dagers token)
- [ ] Aksepter invitasjon (signup eller logg inn)
- [ ] Familie-side: medlemsliste med roller
- [ ] Promotér til admin (kun owner)

**Akseptanse:**
- En forelder kan opprette en familie og invitere 2 barn (med separate kontoer)
- Roller respekteres i UI og databasen
- Logg ut og inn fungerer

---

### Sprint 2 — Skoletimeplan + ukekalender (1 uke)

- [ ] CRUD for `timetable_entries` (skoletimer)
- [ ] Velg dag i uka + start/slutt + fag + rom + lærer
- [ ] Auto-RRULE: «Hele skoleåret» (UNTIL = neste 1. juli)
- [ ] Ukevisning (mandag–søndag) for én bruker
- [ ] Toggle mellom medlemmer
- [ ] Kombinert visning (alle i samme rutenett, fargekodet)
- [ ] Mobiltilpasset (vertikal på små skjermer)

**Akseptanse:**
- En forelder kan legge inn Saras hele skoleuke
- Sara ser timene sine på sin innlogging
- Forelderen kan se kombinert kalender for hele familien

---

### Sprint 3 — Gjøremål + belønninger (1,5 uke)

- [ ] CRUD for `chores`
- [ ] Tildel direkte eller legg i pool
- [ ] Barn kan «plukke» fra pool
- [ ] Statusoverganger (available → selected → completed → approved)
- [ ] Foreldre-godkjenning eller -avvisning
- [ ] Belønninger utløses ved godkjenning
- [ ] `reward_balances` (penger / screen_time / poeng) per medlem
- [ ] Transaksjonshistorikk
- [ ] Barne-dashbord: «I dag», pool, mine valgte, saldo

**Akseptanse:**
- En forelder oppretter «Rydd rommet» (50 kr, daglig)
- Sara ser den, haker av når ferdig
- Forelderen får varsel «Trenger godkjenning»
- Etter godkjenning: 50 kr i Saras saldo
- Historikk viser begge transaksjoner

---

### Sprint 4 — Gå-tracker + mål (4 dager)

- [ ] CRUD for `walking_entries`
- [ ] Linjediagram (Recharts) over uka/måneden
- [ ] CRUD for `goals` (chore_count, walking_distance)
- [ ] Auto-fremdrift basert på relaterte hendelser
- [ ] Trofé/varsling ved fullført mål
- [ ] Belønning utbetales ved fullført mål

**Akseptanse:**
- Sara registrerer 5 gå-turer denne uka
- Mål «Gå 5 km» viser fremgang og «utbetaler» 30 kr ved fullføring

---

### Sprint 5 — Varsler, polish, deploy (3–4 dager)

- [ ] `notifications`-tabell med trigger-funksjoner i Supabase
- [ ] Bell-ikon med ulest-teller (realtime via Supabase Realtime)
- [ ] E-post-varsler for: invitasjon, godkjenningsforespørsel, mål oppnådd
- [ ] Tom-tilstand og loading skeletons overalt
- [ ] Tilgjengelighetsgjennomgang (axe-core)
- [ ] Lighthouse-gjennomgang (mål: >90 på alle akser)
- [ ] Onboarding-tutorial (3-step intro)
- [ ] Produksjonsdeploy + brukertest med en testfamilie

**Akseptanse:**
- En testfamilie bruker appen i én uke uten kritiske feil
- Lighthouse > 90, ingen WCAG AA-feil
- Realtime varsler fungerer

---

## Akseptansekriterier-rammeverk (Gherkin-stil)

For å sikre konsistens, følges dette mønsteret per feature:

```gherkin
Feature: Tildele gjøremål til barn

  Scenario: Forelder tildeler nytt gjøremål direkte
    Given jeg er innlogget som forelder i familien "Hansen"
    And familien har et barn ved navn "Sara"
    When jeg oppretter gjøremålet "Rydde rommet" og tildeler det til Sara
    Then skal Sara se gjøremålet under "Mine oppgaver"
    And status skal være "selected"
    And belønning skal vises som "50 kr"

  Scenario: Barn fullfører og venter på godkjenning
    Given gjøremålet "Rydde rommet" har status "selected" for Sara
    When Sara markerer det som ferdig
    Then status skal endres til "completed"
    And forelder skal motta et varsel "Trenger godkjenning"
    And belønning skal IKKE være utbetalt enda

  Scenario: Forelder godkjenner
    Given gjøremålet "Rydde rommet" har status "completed"
    When forelder klikker "Godkjenn"
    Then status skal endres til "approved"
    And Saras saldo skal øke med 50 kr
    And Sara skal motta varsel "Belønning mottatt: 50 kr"
```

Hver MVP-feature skal ha 3–5 slike scenarioer. Bruker disse som grunnlag for Playwright-tester i Sprint 5.

---

## Definisjon av «Ferdig» per oppgave

En oppgave regnes som ferdig når:

1. ✅ Koden er pushet til main (eller godkjent PR mergt)
2. ✅ Bygger uten feil (`npm run build`)
3. ✅ TypeScript uten errors
4. ✅ Manuell test mot akseptansekriteriene har bestått
5. ✅ Mobil + desktop sjekket
6. ✅ RLS-policies dekker tilgangskontroll
7. ✅ E2E-test eksisterer for kritiske flyter (Sprint 5)

---

## Risiko og avhengigheter

| Risiko | Sannsynlighet | Påvirkning | Tiltak |
|---|---|---|---|
| Barn-auth uten epost (GDPR-krav) | Høy | Høy | Bygg PIN-basert child-login allerede i Sprint 1 — egen artikkel i `08-sikkerhet.md` |
| RLS-feil gir uautorisert tilgang | Medium | Kritisk | Test alle policies med `supabase test db` + manuell rollbasert testing |
| Vercel timeout for tunge spørringer | Lav | Medium | Pagination overalt, indekser i Postgres |
| Mobile push krever Apple Developer-konto | Sikker | Lav (først V2) | Planlegges i V2-sprint |
| RRULE-edge cases (sommertid, tidssoner) | Medium | Medium | Lagre alt i UTC + bruker-tidssone separat. Bruk `date-fns-tz` |

---

## Hvordan starte i dag

1. Følg `mvp/README.md` og få den lokale prototypen til å kjøre
2. Inviter én testfamilie (deg selv + en partner-konto for testing)
3. Bruk appen i en hel uke
4. Loggfør hva som funker / ikke funker
5. Prioriter Sprint 1-3 basert på din egen erfaring
