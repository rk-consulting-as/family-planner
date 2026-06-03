// Mini-kalender for i dag + 2 dager fram. Rask planlegging fra dashboard.

import Link from "next/link";
import { AvatarStack, UserAvatar } from "@/components/ui/Avatar";

export type DashEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean | null;
  icon: string | null;
  color_hex: string | null;
  category: string | null;
  participants: Array<{
    profile_id: string;
    display_name: string;
    avatar_url: string | null;
    color_hex: string | null;
  }>;
};

function formatDayHeader(d: Date, today: Date): { label: string; date: string } {
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const overmorrow = new Date(today);
  overmorrow.setDate(overmorrow.getDate() + 2);

  let label = "";
  if (sameDay) label = "I dag";
  else if (d.toDateString() === tomorrow.toDateString()) label = "I morgen";
  else if (d.toDateString() === overmorrow.toDateString()) label = "I overmorgen";
  else
    label = d.toLocaleDateString("nb-NO", { weekday: "long" });

  return {
    label,
    date: d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }),
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Next3Days({
  events,
  startDate,
  skipToday = true,
}: {
  events: DashEvent[];
  startDate?: Date;
  /** Hopp over i dag (vises i TodayActivities-kortet) */
  skipToday?: boolean;
}) {
  const today = startDate || new Date();
  const days: Date[] = [];
  const offset = skipToday ? 1 : 0;
  for (let i = offset; i < offset + 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  // Grupper hendelser per dag
  const byDay = new Map<string, DashEvent[]>();
  for (const ev of events) {
    const evDate = new Date(ev.starts_at);
    const key = evDate.toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(ev);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden shadow-soft">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
        <div>
          <h2 className="font-display font-semibold text-on-surface">
            Senere denne uka
          </h2>
          <p className="text-label-sm text-on-surface-variant">Rask planlegging</p>
        </div>
        <Link
          href="/kalender"
          className="text-label-lg text-primary hover:underline font-bold"
        >
          Hele kalenderen →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/20">
        {days.map((d, i) => {
          const head = formatDayHeader(d, today);
          const list = byDay.get(d.toDateString()) || [];
          const isToday = i === 0;
          return (
            <div key={i} className="p-3 min-h-[180px]">
              <div className="flex items-baseline justify-between mb-2">
                <span
                  className={`text-sm font-semibold ${
                    isToday ? "text-brand-700" : "text-slate-700"
                  }`}
                >
                  {head.label}
                </span>
                <span className="text-xs text-slate-400">{head.date}</span>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Ingenting planlagt</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.slice(0, 6).map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start gap-2 text-xs rounded-lg p-2 hover:bg-slate-50"
                      style={{
                        background: ev.color_hex ? ev.color_hex + "15" : undefined,
                        borderLeft: ev.color_hex
                          ? `3px solid ${ev.color_hex}`
                          : "3px solid #94a3b8",
                      }}
                    >
                      <span className="text-sm leading-none mt-0.5">
                        {ev.icon || "📅"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {ev.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                          <span>
                            {ev.all_day ? "Hele dagen" : formatTime(ev.starts_at)}
                          </span>
                          {ev.participants.length > 0 && (
                            <>
                              <span>•</span>
                              <AvatarStack
                                members={ev.participants.map((p) => ({
                                  display_name: p.display_name,
                                  avatar_url: p.avatar_url,
                                  color_hex: p.color_hex,
                                }))}
                                size="xs"
                                max={3}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                  {list.length > 6 && (
                    <li className="text-xs text-slate-400 italic">
                      + {list.length - 6} til
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Eksporter en hjelper også
export { UserAvatar };
