# 08 — Sikkerhet, personvern og barneprofiler

## Sammendrag

Family Planner håndterer **persondata om barn**, noe som plasserer den i en strengere regulatorisk kategori enn gjennomsnittlig SaaS. Vi designer rundt fire prinsipper:

1. **Datasparing** — vi lagrer det minste mulige om barn.
2. **Foreldresamtykke og -kontroll** — foreldre/admin kontrollerer barnedata.
3. **Defense in depth** — RLS i database, auth-checks i app, validering i klient.
4. **Reverserbart** — alt kan eksporteres og slettes.

---

## 1. Autentisering

### Voksne brukere
- E-post + passord via Supabase Auth (bcrypt-hash, ikke vår sak)
- Min. 8 tegn, oppfordrer til >12. Ingen tvungne kompleksitetsregler (NIST 800-63B-anbefaling).
- Opsjonell **2FA** i V1.5 (TOTP — Google Authenticator etc.)
- Magic link og SSO med Google i V2 (Supabase Auth provider)

### Barneprofiler

GDPR i Norge: barn under **13 år** kan ikke selv samtykke til behandling av personopplysninger; foreldre må gjøre det. Praktisk for oss:

| Alder | Innloggingsmodell |
|---|---|
| **<13 år** | **Ingen egen e-post.** Forelder oppretter profilen. Innlogging via familie-kort + barne-brukernavn + 4-sifret PIN |
| **13–17 år** | Egen e-post tillatt, men forelder må *invitere* dem inn i familien (ikke fri registrering) |
| **18+** | Standard sign-up |

#### Teknisk implementasjon av PIN-login

- Profil har `auth_kind = 'pin_only'` og `pin_hash` (bcrypt)
- Login-side: skriv inn `family_handle` (unikt per familie) + `username` + 4-sifret PIN
- Server action verifiserer PIN, oppretter en *Supabase session* via Service Role Key (en-veis, server-side)
- Session har samme cookies som vanlig auth, men token har metadata `auth_kind=pin_only`
- Brute-force beskyttelse: maks 5 feil på 15 min per family/username

```ts
// /api/auth/child-pin
export async function POST(req: Request) {
  const { family_handle, username, pin } = await req.json();
  // 1. Lookup profile
  // 2. Check rate limit
  // 3. bcrypt.compare(pin, profile.pin_hash)
  // 4. Use service role to mint session
  // 5. Set HTTPOnly cookie
}
```

---

## 2. Autorisasjon (RBAC)

Tre lag som *alle* må stemme:

1. **RLS i Postgres** (`is_group_member`, `is_group_admin`) — siste forsvarslinje
2. **Server-side checks i Server Actions** — spør auth.uid() og rolle
3. **Klient-UI** — skjuler knapper/lenker, men aldri stol på dette alene

> **Tommelfingerregel:** Hvis en endring trengs i klienten *uten* tilsvarende endring i RLS, er det en bug.

Test-mønster (Playwright):
1. Logg inn som forelder, opprett gjøremål
2. Logg inn som barn, prøv å oppdatere status til 'approved' direkte via API → forventer 403/policy violation
3. Prøv å lese annen familie's data → forventer 0 rader

---

## 3. RLS-fallgruver vi har unngått

| Fallgruve | Hvorfor det er farlig | Vår løsning |
|---|---|---|
| Bruke `using (true)` i en policy | Tilsvarer ingen RLS | Aldri brukt — minimum filter på `is_group_member` |
| Glemme `with check` på insert/update | Bruker kan endre rader til andre grupper | Alle insert/update har eksplisitt with check |
| `security definer` på alt | Bypass-er RLS | Kun på helper-funksjoner som *eksplisitt* skal kunne lese alle grupper (f.eks. trigger som lager profil) |
| Cross-table joins som lekker | `select profile_data from a join b where ...` kan lekke | Bruker views med innebygd RLS, eller eksplisitte sjekker |
| Service Role Key i klient | Bypass-er all RLS | Kun i server-side kode, aldri i `app/`-mapper som rendres på klient |

---

## 4. Datasparing — hva lagrer vi (ikke)

| Vi lagrer | Vi lagrer **ikke** |
|---|---|
| Display name, alder (frivillig), avatar (frivillig) | Fullt personnummer / fødselsnummer |
| E-post (voksne) | Helsedata |
| Familie-medlemskap, rolle | Lokasjons-historie / GPS (V3-vurdering) |
| Gjøremål, belønningssaldo | Politiske oppfatninger / etnisk bakgrunn |
| Manuelle gå-turer (km, dato, varighet) | Sensorbaserte fitness-data (V3-vurdering) |
| Notifikasjoner | Chat-historie (vi har ikke chat) |

---

## 5. GDPR-rettigheter implementert

### Eksport av data
- `/profil/eksporter` → genererer JSON med alt knyttet til kontoen
- Sendes på e-post (link med 24t-ekspirasjon)
- Implementert som Supabase Edge Function

### Sletting av data ("rett til å bli glemt")
- `/profil/slett-konto` → 14-dagers grace-periode med e-post-bekreftelse
- Faktisk sletting: anonymiserer `display_name` til "Slettet bruker", nuller `email`, sletter avatar
- Reward transactions beholdes (revisjonsspor) men `profile_id` → spesiell sentinel UUID

### Innsyn for foreldre i barnas data
- Forelder ser ALL barnas data automatisk via RLS
- Ingen ekstra implementasjon nødvendig

### Begrensning av behandling
- `/profil/pause-konto` → setter `is_active = false`, RLS skjuler bruker fra alt unntatt egen tilgang

---

## 6. Hemmeligheter og kryptering

### Miljøvariabler
- `SUPABASE_URL` — public, kan eksponeres
- `SUPABASE_ANON_KEY` — public (RLS beskytter)
- `SUPABASE_SERVICE_ROLE_KEY` — **kun server**, aldri i klient-bundle, aldri logget
- `RESEND_API_KEY` — kun server
- `GOOGLE_OAUTH_CLIENT_SECRET` (V2) — kun server

### Vercel Environment Variables
- Bruk Vercel sin envir variable-håndtering
- Forskjellige verdier for Production vs. Preview vs. Development
- Aldri i `.env.local` som committes til git

### Kryptering av OAuth-tokens (V2)
- Calendar integration access/refresh tokens lagres i `calendar_integrations.*_encrypted`
- Kryptering med Supabase **pgsodium / Vault** (bygget på libsodium)
- Aldri returner dekryptert verdi til klient

---

## 7. Validering og injection

- All input valideres med **Zod** både på klient (UX) og server (sikkerhet)
- All SQL går via Supabase JS / RPC → ingen string-konkatenering
- HTML-innhold (notater, beskrivelser) renderes som tekst, aldri `dangerouslySetInnerHTML`
- File uploads:
  - Avatar: max 2 MB, kun image/jpeg, image/png, image/webp
  - Sjekkes både size + magic bytes (ikke kun MIME)
  - Lagres i Supabase Storage med RLS

---

## 8. CSRF, CORS, cookies

- Next.js Server Actions har innebygget CSRF-beskyttelse
- Cookies: `Secure`, `HttpOnly`, `SameSite=Lax`
- Ingen state-changing GET-endepunkter
- Webhook-endepunkter (cron, Stripe etc.) verifiserer signatur

---

## 9. Logging og overvåkning

- **Vercel Logs** for HTTP requests (frontend + server actions)
- **Supabase Logs** for database queries og auth events
- **Sentry** (V1.5) for ukrøllede feil
- Aldri logge: passord, tokens, PIN, full e-post (kun domene)
- Audit log for:
  - Rolle-endringer
  - Sletting av medlemmer
  - Manuelle reward-transaksjoner
  - Endringer i invitasjon-roller

---

## 10. Hendelseshåndtering

Hvis det skjer en sikkerhetsfeil:

1. **Identifiser:** sjekk Supabase logs, Vercel logs, Sentry
2. **Begrens:** roter API-keys i Vercel + Supabase, rull tilbake hvis nødvendig
3. **Vurder varsling:** GDPR krever at *alvorlige brudd* meldes Datatilsynet innen 72 timer
4. **Informer brukere:** hvis personlige data kan være eksponert
5. **Post-mortem:** dokumentér årsak og preventive tiltak

Mal-fil: `incidents/YYYY-MM-DD-kort-tittel.md`

---

## 11. Sjekkliste før hver release

- [ ] Alle nye tabeller har RLS aktivert
- [ ] Alle nye tabeller har minst en `using` policy
- [ ] Ingen `service_role` brukes i klient-side kode
- [ ] Ingen hemmeligheter i git
- [ ] Avhengigheter oppdatert (`npm audit fix`)
- [ ] Lighthouse > 90 (inkl. tilgjengelighet)
- [ ] E2E-tester for kritiske flyter passerer
- [ ] Feature flag-er rundt eksperimentelle funksjoner

---

## 12. Eksterne ressurser

- [Datatilsynet — barn og samtykke](https://www.datatilsynet.no/rettigheter-og-plikter/personvern-i-skole-og-barnehage/)
- [Supabase RLS-guide](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) — sjekkliste for moden sikkerhet
- [NIST 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) — moderne autentiserings-anbefalinger
