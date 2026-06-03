// Stort "Dagens aktiviteter"-kort à la Stitch.
// Viser bare i dag, med visuell hierarki som matcher referansen.

import Link from "next/link";
import { AvatarStack } from "@/components/ui/Avatar";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TodayActivities({ events }: { events: DashEvent[] }) {
  const today = new Date();
  const todayKey = today.toDateString();
  const todays = events
    .filter((e) => new Date(e.starts_at).toDateString() === todayKey)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-headline-md text-on-background">
          Dagens aktiviteter
        </h2>
        <Link
          href="/kalender"
          className="text-label-lg font-bold text-primary hover:underline"
        >
          Se alle
        </Link>
      </div>

      {todays.length === 0 ? (
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-md text-center">
          <div className="text-4xl mb-2">🌤️</div>
          <p className="text-body-md text-on-surface-variant">
            Ingen planlagte aktiviteter i dag. Bruk dagen til noe hyggelig!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {todays.map((ev, i) => {
            const borderColor = ev.color_hex || (i % 2 === 0 ? "#1c648e" : "#2c6956");
            return (
              <div
                key={ev.id}
                className="bg-surface-container-lowest p-md rounded-2xl shadow-soft hover:scale-[1.01] transition-transform cursor-pointer"
                style={{ borderLeft: `4px solid ${borderColor}` }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className="text-label-sm font-bold uppercase tracking-wider"
                    style={{ color: borderColor }}
                  >
                    {ev.all_day ? "Hele dagen" : formatTime(ev.starts_at)}
                  </span>
                  <span className="text-xl">{ev.icon || "📅"}</span>
                </div>
                <h3 className="font-display font-bold text-on-surface text-lg leading-snug">
                  {ev.title}
                </h3>
                {ev.participants.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <AvatarStack
                      members={ev.participants.map((p) => ({
                        display_name: p.display_name,
                        avatar_url: p.avatar_url,
                        color_hex: p.color_hex,
                      }))}
                      size="sm"
                      max={4}
                    />
                    <span className="text-label-sm text-on-surface-variant">
                      {ev.participants
                        .slice(0, 2)
                        .map((p) => p.display_name.split(" ")[0])
                        .join(", ")}
                      {ev.participants.length > 2 && ` + ${ev.participants.length - 2}`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
