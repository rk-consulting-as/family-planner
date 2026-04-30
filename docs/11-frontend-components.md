# 11 — Frontend component library

> Components are organized by domain. We follow shadcn/ui conventions: copy-paste components into `components/ui/` rather than depending on a runtime UI library. This gives us full control over styling and bundle size.

## Folder layout

```
mvp/components/
├── ui/                    # Generic, reusable
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Checkbox.tsx
│   ├── Badge.tsx
│   ├── Avatar.tsx
│   ├── Toast.tsx
│   ├── Skeleton.tsx
│   ├── ProgressBar.tsx
│   └── EmptyState.tsx
├── layout/
│   ├── AppShell.tsx
│   ├── TopNav.tsx
│   ├── BottomNav.tsx       # mobile + child UI
│   ├── AdminSidebar.tsx
│   └── PageHeader.tsx
├── auth/
│   ├── SignInForm.tsx
│   ├── SignUpForm.tsx
│   ├── ForgotPasswordForm.tsx
│   └── PinLogin.tsx
├── group/
│   ├── GroupSwitcher.tsx
│   ├── MemberList.tsx
│   ├── MemberCard.tsx
│   ├── InviteForm.tsx
│   └── AcceptInviteCard.tsx
├── calendar/
│   ├── WeekView.tsx
│   ├── DayView.tsx
│   ├── MonthView.tsx        # V1.5
│   ├── CalendarToolbar.tsx
│   ├── EventBlock.tsx
│   ├── MemberFilter.tsx
│   ├── NewEventDialog.tsx
│   ├── EventDetailsSheet.tsx
│   └── ConflictWarning.tsx
├── timetable/
│   ├── TimetableEditor.tsx
│   └── TimetableImport.tsx  # V1.5
├── chores/
│   ├── ChoreCard.tsx
│   ├── ChoreList.tsx
│   ├── ChorePool.tsx
│   ├── NewChoreDialog.tsx
│   ├── ChoreDetailsSheet.tsx
│   ├── ApprovalQueue.tsx
│   └── ChoreStatusPill.tsx
├── rewards/
│   ├── BalanceCards.tsx
│   ├── RewardHistory.tsx
│   ├── TrophyShelf.tsx
│   ├── ManualRewardForm.tsx
│   └── SpendDialog.tsx
├── walking/
│   ├── NewWalkForm.tsx
│   ├── WalkingChart.tsx
│   ├── WalkingStats.tsx
│   └── WalkingHistory.tsx
├── goals/
│   ├── GoalCard.tsx
│   ├── GoalProgressBar.tsx
│   ├── NewGoalDialog.tsx
│   └── GoalCompletedConfetti.tsx
├── notifications/
│   ├── BellButton.tsx
│   ├── NotificationList.tsx
│   ├── NotificationItem.tsx
│   └── NotificationPreferencesForm.tsx
├── child/
│   ├── ChildHomeHero.tsx
│   ├── TodayStrip.tsx
│   └── BigButton.tsx        # extra-large touch targets
├── recurrence/
│   ├── RecurrencePicker.tsx
│   └── RecurrencePreview.tsx
├── collision/
│   ├── CollisionScopeSelect.tsx
│   └── CollisionReport.tsx
└── shared/
    ├── ColorDot.tsx
    ├── DateRangePicker.tsx
    ├── ConfirmDialog.tsx
    └── ErrorBoundary.tsx
```

---

## Key components — props and behavior

### `<WeekView />`
Renders Mon–Sun grid with vertical time axis. Each member's events appear in their color.

```ts
type Props = {
  startOfWeek: Date;
  members: Array<{ id: string; displayName: string; colorHex: string }>;
  visibleMemberIds: string[];
  events: ResolvedEvent[];        // already expanded from RRULE
  onEventClick(event: ResolvedEvent): void;
  onSlotClick(start: Date, end: Date): void;
  density?: 'comfortable' | 'compact';
};
```

Internally uses CSS grid with rows for time (15-min slots) and columns for days. Events absolutely positioned.

### `<NewEventDialog />`
Modal for creating a calendar event. Embeds `<RecurrencePicker />` and `<CollisionScopeSelect />`.

```ts
type Props = {
  open: boolean;
  defaultStart?: Date;
  defaultEnd?: Date;
  onClose(): void;
  onCreated(event: Event): void;
};
```

Handles the conflict-detection round-trip (server returns `{status:'conflicts', ...}` → show `<ConflictWarning />` with "Save anyway" → resubmit with `force=true`).

### `<RecurrencePicker />`
Quick presets + advanced editor. Output is an RRULE string.

```ts
type Props = {
  value: string | null;       // RRULE string or null = does not repeat
  startDate: Date;
  onChange(rrule: string | null): void;
};
```

Presets:
- Does not repeat
- Daily
- Weekly on [day of startDate]
- Every weekday (Mon-Fri)
- Monthly on day N
- Yearly on this date
- Custom… → opens advanced editor

Advanced editor exposes: frequency, interval, byday, until/count.

### `<ChoreCard />`
The main chore atom. Used in lists and pool.

```ts
type Props = {
  chore: ChoreWithAssignment;
  variant: 'pool' | 'mine' | 'review';
  onPick?(): void;          // pool variant
  onComplete?(): void;      // mine variant
  onApprove?(): void;       // review variant
  onReject?(reason: string): void;
};
```

Visual: tall card, large emoji from chore.icon (or auto from category), title, time estimate, reward badge, action button at bottom.

### `<BalanceCards />`
Three (or N) cards showing balances per type.

```ts
type Props = {
  profileId: string;
  groupId: string;
  showSpend?: boolean;
};
```

Internally subscribes to `reward_balances` view for live updates.

### `<WalkingChart />`
Recharts line + bar chart.

```ts
type Props = {
  data: Array<{ date: string; km: number; cumulative: number }>;
  weeklyGoal?: number;
};
```

### `<CollisionScopeSelect />`
Used in any new-item flow that supports collision check.

```ts
type Props = {
  value: 'self' | 'all_children' | 'all_admins' | 'all_members' | 'custom';
  customIds?: string[];
  members: Member[];
  onChange(scope, customIds?): void;
  showSaveAsDefault?: boolean;
};
```

### `<ConflictWarning />`
Shown after server returns a conflict report.

```ts
type Props = {
  conflicts: ConflictReport;
  onForceSave(): void;
  onCancel(): void;
};
```

Renders the friendly summary "⚠ 2 children and 1 admin have conflicts" with expandable details.

### `<BigButton />` (child UI)
Extra-large, high-contrast button used in child dashboard.

```ts
type Props = {
  icon: ReactNode;
  label: string;
  badge?: string | number;
  variant?: 'primary' | 'success' | 'warning';
  onClick(): void;
};
```

Min height 80 px, rounded-2xl, shadow, satisfying tap feedback.

### `<NotificationList />`
Subscribes to realtime, shows unread first, supports mark-as-read.

```ts
type Props = {
  profileId: string;
  pageSize?: number;
};
```

### `<EmptyState />`
Standard empty pattern: illustration + title + description + primary action.

```ts
type Props = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?(): void };
};
```

---

## Theming

- **Tailwind config** with CSS variables for colors, allowing per-group accent color (set in family settings).
- **Light mode by default**, dark mode via `next-themes` (toggle in `/profil`).
- **Family color palette** auto-generated from the group's primary accent (using `chroma-js` or simple HSL math).
- **Font**: Inter (system font fallback). For child UI we may use a slightly rounder font like `Quicksand` for warmer feel.
- **Spacing scale**: Tailwind defaults (4-px base).
- **Border radius**: `rounded-xl` (12px) is our default. `rounded-2xl` for hero cards. Buttons use `rounded-lg`.

---

## Patterns to follow

### Forms
- React Hook Form + Zod resolver
- All form fields use `<Field label error description>` wrapper from `components/ui/Field.tsx`
- Submit buttons disable + show spinner while pending
- Optimistic UI where safe (mark chore done immediately, rollback if server fails)

### Data fetching
- **Server Components** for initial render
- **TanStack Query** for client-side mutations and refetches
- Realtime subscriptions for `notifications`, `chore_assignments`, `goal_progress`

### Error handling
- Top-level `<ErrorBoundary />` per route group
- `error.tsx` and `not-found.tsx` per Next.js App Router segment
- Toast notifications for non-blocking errors

### Loading
- `loading.tsx` per segment for route transitions
- Skeleton components for inline loading
- Never spinners alone — always show structure

### Accessibility
- `aria-label` on icon-only buttons
- `aria-live="polite"` regions for toasts
- Focus rings always visible
- Color contrast ratio >= 4.5:1 for body text
- Keyboard navigation for all interactive components
