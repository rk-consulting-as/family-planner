# 06 — Brukerflyt og sidestruktur

## A. Brukerflyter (user journeys)

### A1. Forelder oppretter familie og inviterer barn

```
1. Lander på  /          (marketing/landingsside)
2. Klikk "Kom i gang"
3. /sign-up  →  fyll inn navn, e-post, passord
4. Bekrefte e-post (klikk lenke i e-post fra Supabase)
5. /onboarding/velg-type    "Familie" / "Lag" / "Klubb" → Familie
6. /onboarding/familie-navn  "Familien Hansen"
7. /onboarding/farge         velg farge
8. /dashboard                tom familie, banner: "Inviter medlemmer"
9. /dashboard/inviter        skriv inn e-post for ektefelle / barn
10. Mottakere får e-post → klikker → /accept?token=...
11. Hvis ny bruker: signup-flyt → automatisk knyttet til familien
12. Hvis eksisterende: logg inn → bekreft → lagt til
```

### A2. Forelder oppretter et gjøremål

```
1. /admin/gjoremal   →  "Nytt gjøremål"
2. Tittel:        "Rydde rommet"
3. Beskrivelse:   valgfri
4. Estimert tid:  15 min
5. Frekvens:      "Hver uke" → BYDAY=SU
   eller "Engangs"
6. Tildel til:    [Sara]   ELLER  "Legg i pool"
7. Belønning:     50 kr  (penger / screen time / poeng / custom)
8. Krever godkjenning?   ✅ Ja
9. Forfallsdato:  Søndag 21:00
10. [Lagre] → varsling til Sara
```

### A3. Barn fullfører gjøremål

```
1. Logger inn → lander på /barn (eller /dashboard avhengig av rolle)
2. Ser kort "I dag":  "Rydde rommet — 50 kr"
3. Klikker kortet → details
4. Klikker stor knapp "Ferdig!" 🎉
5. Status → completed,   konfetti-animasjon
6. Melding: "Sendt til godkjenning hos foreldre"
7. Mor får varsling
8. Mor godkjenner → Saras saldo +50 kr
9. Sara får varsling: "Du fikk 50 kr! 💰"
```

### A4. Barn velger gjøremål fra pool

```
1. /barn/pool  ser tilgjengelige gjøremål
2. Klikker "Mate katten — 10 kr"
3. Modal: "Vil du ta denne?"  [Ja]
4. Status: selected, oppgaven flyttes til "Mine valgte"
5. Etter utført → samme flyt som A3
```

### A5. Forelder oppretter ukentlig gå-mål

```
1. /admin/mal  →  "Nytt mål"
2. Type: "Gå (km)"
3. Mål: 5 km
4. Periode: Ukentlig (auto-fornyes hver mandag)
5. Tildelt: alle barn
6. Belønning: badge "Treningsuke" + 20 kr
7. [Lagre]
8. Hvert barn ser i dashbord: progress bar 0/5 km
```

### A6. Barn registrerer en gå-tur

```
1. /ga-tracker  → "Ny tur"
2. Dato: i dag
3. Distanse: 1.5 km
4. Varighet: 22 min
5. Deltakere: [Sara] (default = innlogget bruker)
6. Notat: "Tur til parken"
7. [Lagre]
8. Mål-progress oppdateres automatisk
9. Hvis mål fylles: konfetti + belønning utløses
```

### A7. Forelder ser kombinert familiekalender

```
1. /kalender  default = "Min uke"
2. Toggle: "Familievisning"
3. Velg medlemmer (alle = default for forelder)
4. Filter: skole / gjøremål / aktiviteter / alt
5. Bytt: dag / uke
6. Klikk en hendelse → detaljer
7. "Ny hendelse" → modal
   → kollisjonssjekk-omfang: "Hele familien"
   → konflikter vises som varsel
   → "Lagre likevel" eller "Avbryt"
```

### A8. Forelder oppretter timeplan for barn

```
1. /admin/timeplan  → velg barn (Sara)
2. "Importer fra mal" eller "Opprett manuelt"
3. Per time:
   Mandag 08:30–09:15  Norsk  Lærer Ole  Rom 102
   ...
4. Velg "Repeter til 21. juni 2026"
5. [Lagre alle]
6. Sara ser timeplanen i sin kalender
```

### A9. Glemt passord

```
1. /sign-in  → klikk "Glemt passord"
2. Skriv e-post → [Send link]
3. Mottar e-post → klikker
4. /reset?token=...  → nytt passord
5. Logget inn automatisk
```

### A10. Inviter eksisterende voksen som admin

```
1. /admin/medlemmer  → "Inviter"
2. E-post + rolle = Admin
3. Vedkommende mottar lenke
4. Hvis innlogget: aksepter med ett klikk
5. Får full admin-tilgang
```

---

## B. Sitemap (alle ruter)

### Public

| Rute | Beskrivelse |
|---|---|
| `/` | Landingsside med kort beskrivelse + CTA |
| `/sign-in` | Logg inn (email/passord, evt. Google V2) |
| `/sign-up` | Registrer ny bruker |
| `/forgot-password` | Glemt passord |
| `/reset-password` | Sett nytt passord (etter e-post-link) |
| `/accept-invitation` | Aksepter familie-invitasjon |
| `/about`, `/personvern`, `/vilkar` | Statisk innhold |

### Onboarding (innlogget, men uten familie)

| Rute | Beskrivelse |
|---|---|
| `/onboarding` | Velkommen-skjerm |
| `/onboarding/velg-handling` | "Opprett familie" eller "Bli med via kode" |
| `/onboarding/opprett-familie` | Steg-for-steg familieopprettelse |
| `/onboarding/bli-med` | Skriv inn invitasjonskode |
| `/onboarding/profil` | Profilbilde, farge, fødselsdato |

### Familie/Bruker (innlogget, har familie)

| Rute | Beskrivelse | Roller |
|---|---|---|
| `/dashboard` | Hjem (rolle-spesifikk: barn vs. voksen) | alle |
| `/kalender` | Kalendervisning | alle |
| `/kalender/ny` | Opprett hendelse | alle |
| `/kalender/[id]` | Hendelsedetaljer | alle |
| `/timeplan` | Min skoletimeplan | alle |
| `/gjoremal` | Mine gjøremål + pool | alle |
| `/gjoremal/[id]` | Gjøremål-detalj | alle |
| `/belonninger` | Min saldo + historikk + trofeer | alle |
| `/ga-tracker` | Logg gå-tur, statistikk | alle |
| `/mal` | Mine mål + fremdrift | alle |
| `/varsler` | Alle varsler | alle |
| `/profil` | Min profil | alle |
| `/profil/varslinger` | Varsel-preferanser | alle |
| `/profil/kalender-sync` | Knytte Google/Outlook (V2) | alle |

### Admin (kun admin/owner)

| Rute | Beskrivelse |
|---|---|
| `/admin` | Admin-oversikt |
| `/admin/medlemmer` | Medlemsliste, roller, invitasjoner |
| `/admin/medlemmer/inviter` | Send invitasjoner |
| `/admin/timeplan` | Administrere timeplaner for medlemmer |
| `/admin/gjoremal` | Opprette/administrere gjøremål |
| `/admin/gjoremal/godkjenninger` | Liste over fullførte → godkjenn/avvis |
| `/admin/belonninger` | Definere belønninger, manuelle transaksjoner |
| `/admin/mal` | Opprette/administrere mål |
| `/admin/statistikk` | Familie-statistikk |
| `/admin/innstillinger` | Familie-innstillinger, kollisjonssjekk-default |

### Barne-spesifikke ruter (hvis vi vil splitte UI)

I MVP samme ruter som over, men `/dashboard` viser barne-versjonen automatisk hvis bruker er Member og under en alder-terskel (kan settes per profil). Senere kan vi legge til `/barn` som dedikert barne-shell.

---

## C. Navigasjons-struktur

### Topp-navigasjon (desktop, voksne)

```
[Logo] Familien Hansen ▾   |  Hjem  Kalender  Gjøremål  Mål  Statistikk    [🔔] [Profil ▾]
```

### Bunn-navigasjon (mobil + barn)

```
[🏠 Hjem]  [📅 Kalender]  [✅ Oppgaver]  [🏆 Belønninger]  [👤 Meg]
```

### Admin-meny (sidebar når i `/admin/*`)

```
Familie-medlemmer
Gjøremål
Godkjenninger (3)
Belønninger
Mål
Timeplaner
Statistikk
Innstillinger
```

---

## D. Tilstander per side

For hver side bør vi designe:

1. **Loading skeleton** — ikke bare spinner
2. **Empty state** — vennlig melding + primær handling
3. **Error state** — forklaring + retry
4. **Success state** — vanlig innhold

Eksempel for `/gjoremal`:

| Tilstand | Innhold |
|---|---|
| Loading | Skeleton-kort med pulserende grå bokser |
| Empty | "Ingen oppgaver i dag 🎉 Sjekk poolen!" + knapp |
| Error | "Noe gikk galt. [Prøv igjen]" |
| Success | Kort-grid med gjøremål |

---

## E. Tilgjengelighet og tastatur

- Tab-rekkefølge: følger visuell rekkefølge
- ARIA-labels på alle ikon-only knapper
- Fokus-ring synlig (Tailwind `focus-visible:ring-2`)
- Skip-link "Hopp til hovedinnhold"
- Ingen kun-fargebasert info — ikoner + tekst
- Touch-targets min 44 × 44 px
- Lydløse animasjoner respekterer `prefers-reduced-motion`
