import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatMinutes } from "@/lib/utils";
import { CheckSquare, Calendar, Footprints, Trophy, Users, Flame, ShoppingBag } from "lucide-react";
import { markHabitDone } from "@/lib/actions/habits";

export default async function DashboardPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  // Today's chores for this user
  const today = new Date().toISOString().slice(0, 10);

  const { data: myAssignments } = await supabase
    .from("chore_assignments")
    .select("id, status, due_date, chore:chores(title, reward_type, reward_value)")
    .eq("group_id", ctx.group.id)
    .eq("assigned_to", ctx.user.id)
    .in("status", ["selected", "in_progress", "completed"])
    .order("due_date", { ascending: true })
    .limit(5);

  const { data: poolAssignments } = await supabase
    .from("chore_assignments")
    .select("id, due_date, chore:chores(title, reward_type, reward_value)")
    .eq("group_id", ctx.group.id)
    .eq("status", "available")
    .is("assigned_to", null)
    .limit(5);

  const { data: balances } = await supabase
    .from("reward_balances")
    .select("type, balance")
    .eq("profile_id", ctx.user.id)
    .eq("group_id", ctx.group.id);

  const { data: recentWalks } = await supabase
    .from("walking_entries")
    .select("distance_km, occurred_on")
    .eq("group_id", ctx.group.id)
    .contains("participant_ids", [ctx.user.id])
    .gte("occurred_on", weekStartIso())
    .order("occurred_on", { ascending: false });

  // Dagens vaner for innlogget bruker
  const { data: habitsRaw } = await supabase.rpc("habits_with_stats", {
    p_group: ctx.group.id,
    p_profile: ctx.user.id,
  });
  type HabitDashRow = {
    id: string;
    profile_id: string;
    title: string;
    emoji: string | null;
    target_per_period: number;
    today_count: number;
    streak: number;
  };
  const todaysHabits = (habitsRaw || []) as HabitDashRow[];

  // Åpne ønsker som denne brukeren skal se (RLS-filtrert i DB)
  const { data: needsRaw } = await supabase
    .from("needs")
    .select("id, title, category, priority, requested_by, location_note")
    .eq("group_id", ctx.group.id)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(5);
  type NeedDashRow = {
    id: string;
    title: string;
    category: string | null;
    priority: "low" | "normal" | "high";
    requested_by: string;
    location_note: string | null;
  };
  const openNeeds = (needsRaw || []) as NeedDashRow[];

  const weekKm = (recentWalks || []).reduce((s, w) => s + Number(w.distance_km || 0), 0);

  const moneyBalance = balances?.find((b) => b.type === "money")?.balance ?? 0;
  const screenBalance = balances?.find((b) => b.type === "screen_time_minutes")?.balance ?? 0;
  const pointsBalance = balances?.find((b) => b.type === "points")?.balance ?? 0;

  const isAdmin = ctx.role !== "member";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hei, {ctx.profile.display_name}! 👋</h1>
        <p className="text-slate-600">
          {today} • {ctx.group.name}
        </p>
      </div>

      {/* Belønningssaldo-rad */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BalanceCard label="Lommepenger" value={formatCurrency(Number(moneyBalance))} icon="💰" />
        <BalanceCard
          label="Skjermtid"
          value={formatMinutes(Number(screenBalance))}
          icon="📺"
        />
        <BalanceCard label="Poeng" value={`${Number(pointsBalance)} stk`} icon="⭐" />
        <BalanceCard label="Gå denne uka" value={`${weekKm.toFixed(1)} km`} icon="👟" />
      </div>

      {/* Dagens vaner — vises øverst hvis det er noen */}
      {todaysHabits.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Dagens vaner</CardTitle>
            <Link href="/vaner">
              <Button variant="ghost" size="sm">Se alle</Button>
            </Link>
          </CardHeader>
          <CardBody>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {todaysHabits.map((h) => {
                const done = h.today_count >= h.target_per_period;
                return (
                  <div
                    key={h.id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        <span className="text-xl">{h.emoji || "✅"}</span>
                        <span className="truncate">{h.title}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Flame className="w-3 h-3" />
                          {h.streak}
                        </span>
                        <span>{h.today_count}/{h.target_per_period} i dag</span>
                      </div>
                    </div>
                    {done ? (
                      <Badge variant="success">✓</Badge>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await markHabitDone(h.id, h.profile_id);
                        }}
                      >
                        <Button size="sm">Hak av</Button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Åpne ønsker som denne brukeren skal se */}
      {openNeeds.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>
              <ShoppingBag className="w-4 h-4 inline mr-1" /> Åpne ønsker
            </CardTitle>
            <Link href="/onsker">
              <Button variant="ghost" size="sm">Se alle</Button>
            </Link>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {openNeeds.map((n) => {
                const requester = ctx.members.find((m) => m.profile_id === n.requested_by);
                return (
                  <li key={n.id}>
                    <Link
                      href={`/onsker/${n.id}`}
                      className="p-3 rounded-xl bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{n.title}</div>
                        <div className="text-xs text-slate-500">
                          Fra {requester?.display_name || "?"}
                          {n.location_note && ` • ${n.location_note}`}
                          {n.category && ` • ${n.category}`}
                        </div>
                      </div>
                      {n.priority === "high" && <Badge variant="danger">Høy</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Dine oppgaver</CardTitle>
            <Link href="/gjoremal">
              <Button variant="ghost" size="sm">
                Se alle
              </Button>
            </Link>
          </CardHeader>
          <CardBody>
            {!myAssignments || myAssignments.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="w-8 h-8" />}
                title="Ingen oppgaver akkurat nå 🎉"
                description="Sjekk poolen for tilgjengelige gjøremål du kan plukke."
                action={
                  <Link href="/gjoremal">
                    <Button variant="secondary">Åpne gjøremål</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {myAssignments.map((a) => {
                  type C = { title: string; reward_type?: string; reward_value?: number } | null;
                  const c = (a as { chore: C }).chore;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200"
                    >
                      <div>
                        <div className="font-medium">{c?.title}</div>
                        <div className="text-xs text-slate-500">
                          {a.due_date ? `Frist: ${a.due_date}` : "Ingen frist"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <RewardBadge type={c?.reward_type} value={c?.reward_value} />
                        <StatusPill status={a.status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Tilgjengelige gjøremål</CardTitle>
            <Link href="/gjoremal">
              <Button variant="ghost" size="sm">
                Velg en
              </Button>
            </Link>
          </CardHeader>
          <CardBody>
            {!poolAssignments || poolAssignments.length === 0 ? (
              <EmptyState title="Tom for nå 🌱" description="Foreldre/admin kan legge til flere." />
            ) : (
              <ul className="space-y-2">
                {poolAssignments.map((a) => {
                  type C = { title: string; reward_type?: string; reward_value?: number } | null;
                  const c = (a as { chore: C }).chore;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50"
                    >
                      <span className="font-medium">{c?.title}</span>
                      <RewardBadge type={c?.reward_type} value={c?.reward_value} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <QuickLink href="/kalender" icon={<Calendar className="w-5 h-5" />} label="Ukekalender" />
        <QuickLink href="/ga-tracker" icon={<Footprints className="w-5 h-5" />} label="Logg gå-tur" />
        <QuickLink href="/belonninger" icon={<Trophy className="w-5 h-5" />} label="Belønninger" />
      </div>

      {isAdmin && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>
              <Users className="w-5 h-5 inline mr-2" />
              Admin
            </CardTitle>
            <Link href="/admin">
              <Button size="sm" variant="secondary">
                Åpne admin
              </Button>
            </Link>
          </CardHeader>
          <CardBody>
            <div className="text-sm text-slate-600">
              Invitasjonskode for {ctx.group.name}:{" "}
              <span className="font-mono font-bold tracking-widest text-slate-900">
                {ctx.group.invite_code}
              </span>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function BalanceCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs text-slate-500 mt-2">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50 transition flex items-center gap-3"
    >
      <span className="text-brand-600">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function RewardBadge({ type, value }: { type?: string; value?: number | null }) {
  if (!type || value == null) return null;
  if (type === "money") return <Badge variant="success">{formatCurrency(Number(value))}</Badge>;
  if (type === "screen_time_minutes") return <Badge variant="info">{value} min skjerm</Badge>;
  if (type === "points") return <Badge variant="warning">{value} ⭐</Badge>;
  return <Badge>{value}</Badge>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { v: "default" | "info" | "success" | "warning"; label: string }> = {
    available: { v: "default", label: "Tilgjengelig" },
    selected: { v: "info", label: "Mine" },
    in_progress: { v: "info", label: "Pågår" },
    completed: { v: "warning", label: "Venter godkj." },
    approved: { v: "success", label: "Godkjent" },
    rejected: { v: "default", label: "Avvist" },
  };
  const s = map[status] ?? { v: "default" as const, label: status };
  return <Badge variant={s.v}>{s.label}</Badge>;
}

function weekStartIso(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
