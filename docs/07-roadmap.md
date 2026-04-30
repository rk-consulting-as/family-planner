# 07 — Roadmap

## Visjonen i tre faser

| Fase | Tema | Tidsramme |
|---|---|---|
| **MVP / V1** | "Hverdagshelten" — daglig planlegging og belønning for én familie | 4–6 uker |
| **V1.5** | "Reduser friksjon" — gjentakelser, varsler, kollisjon | 3–4 uker |
| **V2** | "Connected" — kalender-sync, push, mobil-app | 4–6 uker |
| **V3** | "Fellesskap" — grupper utover familie, AI, monetisering | 6–8 uker |

---

## V1 — MVP (uke 1–6)

Se `03-mvp-plan.md` for detaljert sprintplan. Sluttmål:

- Kjører på vercel.app
- En familie kan registreres på <2 min
- Forelder kan opprette gjøremål, barn fullfører, belønning utbetales
- Ukekalender funker for skoletimer + gjøremål + aktiviteter
- Manuell gå-tracker + ukentlig mål
- In-app + e-post-varsler

---

## V1.5 — Reduser friksjon (uke 7–10)

| Feature | Hvorfor |
|---|---|
| Avansert RRULE-editor (visuell) | Brukerne vil ha "hver første mandag", ikke bare "ukentlig" |
| Kollisjonssjekk på tvers av medlemmer | Spart fra dobbeltbookinger |
| Drag-and-drop i ukekalender | Forventet i 2026 |
| Måneds-visning | Foreldre vil planlegge fram i tid |
| Bilde-bevis for gjøremål | "Vis at du har ryddet" |
| Foreldre-PIN på godkjenning (mobil) | Hindre at barn godkjenner seg selv på delt enhet |
| Streak-tracking ("7 dager på rad") | Engasjement |
| Custom badges + trofé-vegg | Belønning bortenfor penger |
| Markdown i notater | Lettere å skrive bedre beskrivelser |
| Barne-friendly PIN-innlogging | Yngre barn uten egen e-post |
| Eksport til iCal-fil (.ics) | Brukerne vil dele med besteforeldre etc. |
| Bedre tom-tilstander og onboarding | Færre brukere som dropper av |

---

## V2 — Connected (uke 11–16)

### Kalender-integrasjoner
- **Google Calendar** (toveis sync av valgte kalendere)
- **Outlook Calendar** (Microsoft Graph)
- **Apple Calendar** (CalDAV — vanskeligst, kan utsettes til V2.5)

### Mobile apps via Capacitor
- iOS-app (krever Apple Developer-konto, ~$99/år)
- Android-app (Google Play, ~$25 én gang)
- App Store-optimalisering, screenshots, beskrivelse
- Native push via FCM (Android) og APNS (iOS)

### Web push
- Service worker + Web Push API
- Funker i Chrome, Edge, Firefox, Safari (med PWA-installasjon)

### PWA / offline mode
- Cache-strategi for kjernen
- "Du er offline"-banner
- Endringer queue-es til online igjen

### Familie-bytting
- Tilhør flere familier samtidig (Mor som er admin i sin familie + tante i søsters familie)
- Hurtig-bytter i toppen

---

## V3 — Fellesskap og oppskalering (uke 17+)

### Grupper utover familie
- Profile-mode i grupper: "Hjemme-familie", "Klubb", "Lag"
- Roller utvides: trener, styremedlem, kasserer
- Aktiviteter med påmelding ("Trening tirsdag — meld på/av")
- Kjøreliste (felles bilkjøring til trening)

### AI-assistert planlegging (premium)
- "Foreslå gjøremål basert på alder"
- "Optimal fordeling av oppgaver mellom barn"
- "Generer ukens timeplan basert på frigivelser fra skole"
- Bruker Claude API (Anthropic)

### Familie-økonomi
- Mer komplett "lommepenger"-funksjon
- Sparemål med bilder ("Nytt LEGO-sett — 1200 kr")
- Foreldre-utbetaling med bekreftelse fra Vipps/MobilePay (V3.5)

### Monetisering
- **Gratis**: 1 familie, 5 medlemmer, basisfunksjoner
- **Pro** (49 kr/mnd): ubegrenset medlemmer, kalender-sync, AI-funksjoner, custom badges
- **Klubb** (199 kr/mnd): for klubber/lag, betalings-integrasjon, eksport, white-label

---

## Tekniske milepæler parallelt

| Område | V1 | V1.5 | V2 | V3 |
|---|---|---|---|---|
| Database | Initial schema | Indeks-tuning | Partisjoner for events/transactions | Read replicas |
| Tester | Manuell + smoke | Unit (Vitest) | E2E (Playwright) | Load tests |
| CI/CD | Vercel auto | + Github Actions lint/test | + Preview-DB per PR | + canary deploys |
| Observability | Vercel Analytics | + Supabase logs | Sentry for errors | OpenTelemetry traces |
| Sikkerhet | RLS + Auth | + 2FA | + audit log | + SOC2-ready |
| Internasjonalisering | nb-NO | + en-US | + sv, da | + nl, de |

---

## Hvordan beslutte hva som er neste?

Bruk denne sjekklisten ved slutten av hver sprint:

1. **Hvilke 5 ting har brukerne klagd mest på?** → de øverste tre i neste sprint
2. **Hvilke 3 ting reduserer onboarding-friksjon?** → alltid med
3. **Hvilken ene ting ville få deg til å betale?** → utforsk i sandbox
4. **Hva er teknisk gjeld som vil bremse oss snart?** → 20 % av sprint-kapasitet

Roadmapen ovenfor er en *retning*, ikke et løfte. Reagér på det som faktisk skjer.
