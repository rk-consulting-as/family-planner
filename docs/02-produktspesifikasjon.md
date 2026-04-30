# 02 — Produktspesifikasjon

## 1. Visjon

En *enkel, motiverende og familievennlig* planlegger der foreldre og barn (eller andre grupper) får felles oversikt over uka — skoletimer, gjøremål, fritid, gå-mål og belønninger — på ett sted. Designet for å være visuelt og forståelig for barn, men strukturert nok til å brukes av klubber, lag og små organisasjoner.

## 2. Brukergrupper

| Persona | Rolle | Hovedbehov |
|---|---|---|
| **Mor/far Hansen** | Admin (Forelder) | Få oversikt over hele familien, fordele oppgaver, godkjenne, belønne |
| **Sara, 9 år** | Member (Barn) | Se hva hun skal i dag, velge gjøremål, samle belønninger |
| **Even, 14 år** | Member (Barn) | Selvstyrt, vil se ukeplan på telefon, registrere gå-turer |
| **Klubbleder Per** | Group Owner | Bruker appen for fotball-laget — møter, treninger, kjøreliste |
| **Tante Ingrid** | Admin (Guardian) | Hjelper søsters familie — trenger admin-tilgang |

## 3. Roller og rettigheter

```
GroupOwner  >  Admin  >  Member
```

| Handling | Owner | Admin | Member |
|---|:---:|:---:|:---:|
| Opprette/slette gruppe | ✅ | ❌ | ❌ |
| Endre gruppenavn / type | ✅ | ✅ | ❌ |
| Invitere medlemmer | ✅ | ✅ | ❌ |
| Fjerne medlemmer | ✅ | ✅ | ❌ |
| Promotere til admin | ✅ | ❌ | ❌ |
| Opprette gjøremål til andre | ✅ | ✅ | ❌ |
| Opprette gjøremål til seg selv | ✅ | ✅ | ✅ |
| Godkjenne gjennomførte gjøremål | ✅ | ✅ | ❌ |
| Definere belønninger | ✅ | ✅ | ❌ |
| Definere mål for andre | ✅ | ✅ | ❌ |
| Definere mål for seg selv | ✅ | ✅ | ✅ |
| Se andres timeplan | ✅ | ✅ | Kun hvis tillatt |
| Redigere egen timeplan | ✅ | ✅ | ✅ |
| Registrere gå-tur for seg selv | ✅ | ✅ | ✅ |
| Registrere gå-tur for andre | ✅ | ✅ | ❌ |
| Sette opp kollisjonssjekk-preferanser | ✅ | ✅ | ❌ |
| Konfigurere kalender-sync | ✅ | ✅ | ✅ (egen konto) |

**Spesielt for barneprofiler under 13 år (GDPR):**
- Må opprettes av en forelder/admin (ikke kunne registrere seg selv direkte med epost)
- Kan ha *enklere innlogging*: PIN-kode, brukernavn uten epost, eller QR-kode på familiens enhet
- Foreldre har «foreldreansvar» og kan se all data
- Detaljer i `08-sikkerhet.md`

## 4. Funksjonsoversikt

Hovedfunksjonene følger den nummererte listen i din spec. Under hver funksjon: hva som er **i MVP**, hva som er **senere**.

---

### 4.1 Ukekalender (visuell uke-/dag-/månedsvisning)

**MVP:**
- Uke-visning (mandag–søndag) med vertikale tidskolonner per dag
- Dag-visning (én dag, alle medlemmer som horisontale baner)
- Filter per medlem
- Fargekoding per medlem (auto-tildelt, kan endres)
- Kombinert familievisning (alle medlemmer i samme rutenett)
- Klikk for detaljer i en sidepanel/modal
- Mobiltilpasset (vertikal scroll på små skjermer)

**Senere:**
- Måneds-visning
- Drag-and-drop for å flytte hendelser
- Eksport til iCal-fil

---

### 4.2 Skoletimeplan

**MVP-felter per time:**
- Fag (`subject`)
- Starttid (`start_time`)
- Sluttid (`end_time`)
- Dag i uka (`day_of_week`) eller spesifikk dato
- Klasserom (`room`)
- Lærer (`teacher`)
- Notater (`notes`)
- Gjentakelse: **typisk hele skoleåret eller halvår** — bruker RRULE med `UNTIL`
- Avbrytelser (helligdager, ferier) — markeres som unntak via `exception_dates`

**MVP-funksjoner:**
- Opprett, endre, slett time
- Importér helt skoleår (kopier sist semester)
- Vis i ukekalender med eget «timeplan»-tag

**Senere:**
- Importér fra Visma/iSkole/lignende (Norge-spesifikt)
- Push timeplan-endringer til hele klassen (krever skole-konto)

---

### 4.3 Hjemmegjøremål

**Felter:**
- Navn (`title`)
- Beskrivelse (`description`)
- Estimert tid (`estimated_minutes`)
- Frekvens via RRULE (`recurrence_rule`) — engangs, daglig, ukentlig, custom
- Tildelt til (`assigned_to_id`) — eller `null` hvis i pool
- Status: `available`, `selected`, `in_progress`, `completed`, `approved`, `rejected`
- Belønningstype (`reward_type`): `money`, `screen_time`, `points`, `badge`, `custom`
- Belønningsverdi (`reward_value`)
- Forfallsdato (`due_date`)
- Krever foreldre-godkjenning (`requires_approval`: bool)
- Hvem som godkjente, og når

**Tilstandsmaskin:**
```
                                         (admin avviser)
                                              ↓
available → selected → in_progress → completed → approved
   ↑          (barn)      (barn)      (barn)     (admin)
   |________________________________ rejected
                                       ↓
                                   available (igjen)
```

**Pool-logikk:**
- Et gjøremål med `assigned_to_id = NULL` og status `available` er i poolen.
- Et barn kan «plukke» det → `assigned_to_id = barn.id`, status → `selected`.
- Foreldre kan tilbakestille til `available` når som helst.

**MVP:**
- Opprette/endre/slette
- Tildel direkte eller legg i pool
- Marker som ferdig
- Foreldregodkjenning + belønning utløses

**Senere:**
- Bilde-bevis (last opp foto av ryddet rom)
- Streak / kombinasjons-belønninger («7 dager på rad»)
- Familielag-konkurranser

---

### 4.4 Belønningssystem

**Belønningstyper:**
| Type | Lagring | Visning |
|---|---|---|
| **Money** | Konto-saldo i kroner | Sparegris-ikon med beløp |
| **Screen time** | Saldo i minutter | TV-ikon med minutter |
| **Points** | Heltall | Stjerne med antall |
| **Badge** | Visuell, tildeles ved milepæl | Trofé-vegg |
| **Custom** | Fritekst | Gave-ikon med tekst |

**Logikk for opptjening:**
1. Gjøremål eller mål fullføres
2. Hvis `requires_approval = true`: vent på admin-godkjenning
3. Når godkjent: lag en `reward_transaction`
4. Saldo oppdateres atomisk (PostgreSQL transaksjon, RLS sjekker rett)
5. Push-/in-app-varsling til mottaker

**Brukstilfeller:**
- Barn ser sin saldo per type på dashbordet
- Forelder kan «utbetale» (konvertere screen_time til faktisk skjermtid, eller flytte penger til ekte konto manuelt)
- Historikk over alle transaksjoner (revisjonsspor)

Detaljer i `10-reward-logic.md`.

---

### 4.5 Gå-/aktivitets-tracker

**Manuell registrering (MVP):**
- Dato
- Distanse (km)
- Varighet (min)
- Notat
- Hvem som deltok (en eller flere medlemmer)

**Beregninger:**
- Antall turer denne uka / måneden
- Total km denne uka / måneden
- Gjennomsnittlig fart
- Fremgang mot mål («3,2 av 5 km denne uka»)

**Visning:**
- Linjediagram: km over tid
- Stolpediagram: turer per dag/uke
- Progress bar mot ukentlig mål
- Trofé/badge når mål nås

**Senere:**
- Auto-import fra Apple Health, Google Fit, Strava
- GPS-tracking i mobil-app

---

### 4.6 Mål og milepæler

**Felter:**
- Navn
- Type: `walking_distance`, `chore_count`, `read_count`, `custom`
- Målverdi
- Periode: `daily`, `weekly`, `monthly`, `custom_range`
- Belønning (knytter mot reward-system)
- Tildelt til (en eller flere medlemmer)
- Status: `active`, `completed`, `failed`, `archived`

**Fremdrift:**
- Beregnes automatisk basert på relaterte hendelser (gå-tracker, gjøremål, etc.)
- Vises som progress bar
- Ved 100 %: trigger belønning + varsling

---

### 4.7 Kalender-sync

**MVP:** Forberedt arkitektur (CalendarIntegrations-tabell), men *ingen* faktisk sync ennå.

**V2 (Google først):**
1. Bruker kobler Google-konto (OAuth via Supabase Auth Provider)
2. Velger kalender(e) som skal synkes (les-only eller toveis)
3. App-events → Google: timer, gjøremål, aktiviteter
4. Google → App: kun les inn fritid/opptatt for kollisjonssjekk (ikke import som tasks)

**V3:** Outlook (Microsoft Graph), Apple (CalDAV)

Detaljer i `09-calendar-sync.md`.

---

### 4.8 Varsler

**Triggere:**
| Hendelse | Mottaker | Kanal |
|---|---|---|
| Gjøremål nær forfall | Tildelt bruker | In-app, e-post, push |
| Gjøremål fullført av barn | Foreldre | In-app, e-post |
| Gjøremål venter på godkjenning | Foreldre | In-app, e-post |
| Mål oppnådd | Bruker + foreldre | In-app, e-post, push |
| Belønning mottatt | Bruker | In-app, push |
| Skoletime starter snart | Bruker | Push |
| Familiekalender-konflikt registrert | Admin | In-app |
| Ny invitasjon | Mottaker | E-post |

**Per-bruker preferanser:**
- Standard for hver kanal (av/på)
- Per-objekt overstyr (denne ene oppgaven: ingen påminnelse)
- Stillemodus-vindu (f.eks. 21:00–07:00)

**Påminnelsestider:**
- Ingen
- Ved start
- 5 / 15 / 30 min før
- 1 t / 1 dag før
- Custom

**MVP:** In-app + e-post.
**V2:** Browser push (Web Push API) + mobile push (Capacitor + FCM/APNS).

---

### 4.9 Admin-dashboard

**Innhold:**
- Familiemedlemmer (kort med rolle, status, fargen sin)
- «Trenger godkjenning» — liste over fullførte gjøremål
- «Ukens fremgang» — alle medlemmers mål-status
- Hurtigvalg: Opprett gjøremål, opprett mål, send invitasjon
- Statistikk: gjøremål/uke per medlem, gå-distanse, belønninger utdelt
- Tilgangskontroll: hvem ser hva, hvem kan redigere

---

### 4.10 Barne-dashboard

**Innhold (designet for visuell oversikt):**
- *Hei, Sara!* (stort, vennlig)
- «I dag»-stripe: max 5 ting, store ikoner
- «Tilgjengelige oppgaver» (pool) — kort med belønnings-emblem
- «Mine valgte oppgaver» — drag-til-ferdig
- Belønningssaldo (penger / minutter / poeng) som store kort
- Trofé-vegg (badges samlet)
- Gå-tracker progress («Du har gått 3,2 av 5 km!»)
- Neste ting i kalender

**Designprinsipper:**
- Få ord, store ikoner
- Lyse, vennlige farger
- Ros og smileys ved fullføring
- Aldri «du har feilet»-språk

---

### 4.11 Delt familiekalender + kollisjonssjekk

**Visning:**
- Bytt mellom: «Min kalender», «Familie», «Egendefinert utvalg»
- Hvert medlem har en farge
- Filter: bare skole / bare gjøremål / bare aktiviteter / alt
- Skjul/vis spesifikke medlemmer med toggles

**Kollisjonssjekk ved opprettelse av ny hendelse:**
1. Bruker velger sjekkomfang:
   - Bare denne personen
   - Alle barn
   - Alle voksne
   - Hele familien
   - Egendefinert
2. System spør: «Lagre forrige valg som standard?»
3. Ved lagring kjøres sjekk
4. Konflikter vises som mykt varsel (ikke hard blokkering):

```
⚠ Konflikt funnet
- Sara har «Pianotime» 16:00–17:00
- Even har «Fotballtrening» 16:30–17:30
- 1 forelder (Mor) har «Møte» 16:00–17:00

Vil du fortsette likevel?  [Avbryt]  [Lagre]
```

5. Brukeren kan alltid lagre uansett.

---

### 4.12 Gjentakende hendelser

Bruker RRULE-standarden. Eksempler:

| Beskrivelse | RRULE |
|---|---|
| Daglig | `FREQ=DAILY` |
| Ukentlig | `FREQ=WEEKLY` |
| Månedlig | `FREQ=MONTHLY` |
| Hver hverdag | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |
| Hver mandag og onsdag | `FREQ=WEEKLY;BYDAY=MO,WE` |
| Første fredag i måneden | `FREQ=MONTHLY;BYDAY=1FR` |
| Hver 3. dag | `FREQ=DAILY;INTERVAL=3` |
| Til 1. juni 2026 | `FREQ=WEEKLY;UNTIL=20260601T000000Z` |
| 5 ganger | `FREQ=WEEKLY;COUNT=5` |

**UI-mønster:**
- Enkel «hurtigvalg»-knapper for de vanligste
- «Custom»-modal med visuell editor for resten
- Forhåndsvisning: «Dette gir 12 forekomster mellom 1. mai og 1. juni»

**Lagring:**
- Hovedhendelse i `events`-tabellen med `recurrence_rule`
- Unntak (slettet eller flyttet enkelt-forekomst) i `event_exceptions`-tabellen

---

### 4.13 Push-varsler og påminnelser

Allerede dekket i 4.8. Tekniske detaljer:

- **Web push:** Service worker + Web Push API + VAPID-nøkler. Funker i Chrome/Edge/Firefox/Safari (iOS 16.4+ etter PWA-installering).
- **Mobil push:** Capacitor Push Notifications plugin + Firebase Cloud Messaging (Android) + Apple Push Notification Service (iOS).
- **E-post:** Resend.com eller Supabase's innebygde transactional via SMTP.
- **Tidsplanlegging:** Supabase pg_cron eller Vercel Cron + en queue-tabell.

---

## 5. Ikke-funksjonelle krav

| Krav | Mål |
|---|---|
| Mobilrespons | Funker fra 320 px og opp |
| Lasting (LCP) | <2 s på 4G |
| Tilgjengelighet | WCAG 2.1 AA |
| Språk | Bokmål først, engelsk i V2 |
| GDPR | Foreldresamtykke for barn <13 år, eksport/sletting |
| Tilgjengelighet for barn | Lesbarhet 8 år+, store touch-targets (44 px), enkle ord |
| Offline | Les-only cachet versjon i V2 (PWA) |
| Sikkerhet | RLS på alle tabeller, ingen klient-side rolle-sjekk |

## 6. Suksessmålinger

- Antall aktive familier
- Snitt gjøremål fullført / barn / uke
- Andel gjøremål som godkjennes (mål: >95 %)
- Kollisjoner unngått (telles ved «Avbryt» etter konflikt-varsel)
- Andel barn som logger inn min. 3 dager / uke
