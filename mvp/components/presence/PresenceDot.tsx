/**
 * Liten "online"-indikator. Vises bare når brukeren faktisk er online OG
 * har valgt å være synlig (eller hvis ser kalles fra admin-perspektiv).
 */
export function PresenceDot({
  lastSeenAt,
  visible,
  alwaysShow = false,
  size = 10,
  className = "",
}: {
  lastSeenAt: string | null;
  visible: boolean;
  alwaysShow?: boolean;     // sett true når visningsbruker er admin
  size?: number;
  className?: string;
}) {
  const isOnline = isRecentlySeen(lastSeenAt);
  if (!isOnline) return null;
  if (!visible && !alwaysShow) return null;

  return (
    <span
      className={`inline-block rounded-full bg-emerald-500 ring-2 ring-white ${className}`}
      style={{ width: size, height: size }}
      aria-label="online"
      title="Online nå"
    />
  );
}

export function isRecentlySeen(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff < 3 * 60 * 1000; // 3 min
}

export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "ukjent";
  const t = new Date(lastSeenAt);
  const now = Date.now();
  const diffSec = Math.floor((now - t.getTime()) / 1000);
  if (diffSec < 60) return "nå nettopp";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min siden`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} t siden`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)} dager siden`;
  return t.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}
