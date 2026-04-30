# 09 — Calendar Sync Strategy

## Goal

Let users connect Google, Outlook and Apple calendars so that:

1. **Family Planner items** (chores, school lessons, activities) appear in their personal calendar.
2. **External events** can be read for **collision detection** (busy/free) without polluting Family Planner with every meeting.
3. **Two-way sync** is available where it makes sense, but **read-only is default** to avoid surprising the user.

## Phasing

| Phase | Provider | Direction |
|---|---|---|
| MVP | None — schema is ready, UI is hidden | — |
| V2.0 | **Google Calendar** | Two-way (opt-in) |
| V2.5 | **Microsoft Outlook** (via Graph) | Two-way |
| V3.0 | **Apple iCloud** (CalDAV) | Read + write where supported |
| V3.0 | **iCal export** (.ics URL per profile) | One-way export to any reader |

---

## 1. Google Calendar (V2.0)

### Auth

Google OAuth 2.0 via Supabase Auth (provider already supported), but we need extra scopes beyond sign-in:

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
```

We use **incremental authorization**: the user signs in normally first, then later clicks "Connect Google Calendar" which triggers a separate OAuth grant for these scopes. The new tokens are stored encrypted in `calendar_integrations`.

### Data flow

```
Family Planner               Google Calendar
       │                            │
       │   create event             │
       ├──────────────────────────► │
       │                            │
       │   fetch busy/free          │
       │ ◄──────────────────────────┤
       │   (every 15 min)           │
       │                            │
       │   webhook on changes       │
       │ ◄──────────────────────────┤  (V2.5)
```

### Sync strategies

| Family Planner item | Google action | Why |
|---|---|---|
| `events` (custom calendar items) | Create/update/delete | User explicitly created |
| `timetable_entries` | Create as RRULE event | Useful in personal calendar |
| `chore_assignments` (with due_date) | Create as ALL-DAY event | Reminder, not real meeting |
| `goals` (milestone reached) | Create as quick event | Celebration |
| Google's existing events | **Read-only**, only for busy/free | Don't import noise |

### What we send to Google

Each Family Planner event becomes a Google event with:
- `summary` = title
- `description` = description + "Synced from Family Planner • do not edit here"
- `start` / `end` (with timezone)
- `recurrence` (RRULE) if recurring
- `extendedProperties.private.familyPlannerId = <our id>` — used for matching
- `colorId` — mapped from per-user color

### Conflict detection

When user creates a new event in Family Planner with collision check:
1. If integrated, query `freebusy` API for the time range
2. Mix in own database conflicts (other Family Planner items)
3. Show unified report

### Token refresh

Google access tokens last ~1 hour, refresh tokens are long-lived but can be revoked. Strategy:
- On each API call, check `token_expires_at`
- If <60 sec remaining, refresh proactively
- If refresh fails (user revoked): mark `is_enabled = false`, notify user

### Rate limits

Google Calendar API: 1,000,000 requests/day, 60,000/min/user. We're nowhere near this for a personal app.

### Cron job

`POST /api/cron/sync-calendars` (Vercel Cron, every 15 min):

```ts
for each enabled integration:
  refresh token if needed
  push pending writes (queued in `calendar_sync_queue` table)
  pull busy/free for next 30 days, store in cache table for collision checks
```

For real-time push from Google → us, we use **Push Notifications** (channels API) when V2.5 hits. MVP uses pull-only.

---

## 2. Microsoft Outlook (V2.5)

Same pattern as Google but via **Microsoft Graph** API.

- OAuth via Microsoft Identity Platform
- Scopes: `Calendars.ReadWrite`
- Endpoints: `/me/events`, `/me/calendarView`, `/me/calendar/getSchedule` (for busy/free)
- Webhook for change notifications (better than polling for Outlook — supports it well)

The data model in `calendar_integrations` is provider-agnostic, so this is mostly a new adapter file.

```
lib/calendar/
  ├── types.ts              # CalendarProvider interface
  ├── google.ts             # Google adapter
  ├── outlook.ts            # Outlook adapter (V2.5)
  └── apple.ts              # CalDAV adapter (V3.0)
```

## 3. Apple iCloud (V3.0)

CalDAV is the protocol. App passwords required (since Apple doesn't support OAuth for iCloud calendar). This means:

- Less convenient UX (user must generate an app-specific password)
- Less reliable than Google/Outlook
- Limited write support

For V3 we will likely offer:
- **One-click iCal subscription URL** (read-only export from Family Planner — works in Apple Calendar trivially)
- **Manual CalDAV setup** for advanced users who want write

---

## 4. iCal export (V2.5 quick win)

Independent of OAuth. Each profile gets a unique long-lived URL:

```
https://family-planner.app/ical/<profile_id>?token=<random_string>
```

Returns a valid `.ics` file with:
- All upcoming events for this profile (next 90 days)
- All recurring events as RRULE
- ETag for caching

Apple Calendar, Google Calendar, Outlook all support **subscribing** to such a URL — refreshes automatically. This is the lowest-effort, highest-value sync option, ironically.

```ts
// app/ical/[profileId]/route.ts
export async function GET(req, { params }) {
  // verify token
  // fetch events
  // build ICS string
  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' }
  });
}
```

---

## 5. Data model changes for V2

`calendar_integrations` already in MVP schema. Need to add:

```sql
-- Outgoing sync queue
create table public.calendar_sync_queue (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.calendar_integrations(id) on delete cascade,
  operation text not null check (operation in ('create','update','delete')),
  source_kind text not null,       -- 'event','timetable_entry','chore_assignment'
  source_id uuid not null,
  external_id text,                -- the Google/Outlook ID once known
  payload jsonb not null,
  attempts int default 0,
  last_error text,
  scheduled_for timestamptz default now(),
  completed_at timestamptz
);

-- Cached busy/free for collision checks
create table public.calendar_busy_cache (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.calendar_integrations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text,                     -- 'google','outlook','apple'
  fetched_at timestamptz default now()
);
create index on public.calendar_busy_cache (integration_id, starts_at);
```

---

## 6. Privacy considerations

- We never store **content** of external events (titles, attendees) — only busy/free time slots
- Tokens encrypted at rest with pgsodium
- User can disconnect at any time, which:
  - Sets `is_enabled = false`
  - Deletes encrypted tokens
  - Optionally: deletes our events from Google (with user confirmation)
- Audit log for connect / disconnect / sync errors

---

## 7. Edge cases to remember

| Case | Plan |
|---|---|
| User in different timezone from family | Per-profile timezone, all timestamps in UTC, render in user's TZ |
| Daylight saving time | Use `date-fns-tz` for conversions, RRULE handles DST natively |
| User edits a Family Planner event in Google directly | Either ignore (one-way intent), or read back via `extendedProperties` and update — V2.5 |
| Two-way sync conflict (edited in both places) | "Last write wins" with timestamp, plus a notification to the user |
| User deletes a synced event in Google | Detected next sync; we mark our copy as soft-deleted |
| Recurring event exception (one occurrence cancelled in Google) | Add to our `event_exceptions` table |
| External calendar gets disconnected mid-sync | Queue retries with exponential backoff; after 5 failures notify user |

---

## 8. Implementation checklist for V2.0

- [ ] Add Google OAuth client in Google Cloud Console
- [ ] Add OAuth credentials to Vercel env vars
- [ ] Build `/api/integrations/google/start` and `/callback`
- [ ] Build `lib/calendar/google.ts` adapter
- [ ] Build `calendar_sync_queue` table + migration
- [ ] Build `app/api/cron/sync-calendars` route
- [ ] Add Vercel Cron config in `vercel.json`
- [ ] Settings UI: `/profil/kalender-sync` with connect/disconnect + which calendars to use
- [ ] E2E test: connect → create event → see in Google
- [ ] Documentation for users
