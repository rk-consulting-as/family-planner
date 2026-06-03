import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserAvatar } from "@/components/ui/Avatar";
import {
  Heart,
  Tag,
  Sparkles,
  UserPlus,
  Check,
  Gift,
  List,
} from "lucide-react";

type Activity = {
  id: string;
  actor_id: string;
  kind: string;
  wish_id: string | null;
  list_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor?: {
    display_name: string;
    avatar_url: string | null;
    color_hex: string | null;
  };
  wish?: { title: string; hero_image_url: string | null };
};

export default async function AktivitetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data } = await supabase
    .from("aura_activities")
    .select("id, actor_id, kind, wish_id, list_id, metadata, read_at, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const activities = (data || []) as Activity[];

  // Hent actor-profiler
  const actorIds = Array.from(new Set(activities.map((a) => a.actor_id)));
  let actorMap = new Map<
    string,
    { display_name: string; avatar_url: string | null; color_hex: string | null }
  >();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, color_hex")
      .in("id", actorIds);
    actorMap = new Map(
      ((profiles || []) as Array<{
        id: string;
        display_name: string;
        avatar_url: string | null;
        color_hex: string | null;
      }>).map((p) => [
        p.id,
        {
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          color_hex: p.color_hex,
        },
      ])
    );
  }

  // Hent wish-info
  const wishIds = Array.from(
    new Set(activities.map((a) => a.wish_id).filter(Boolean))
  ) as string[];
  let wishMap = new Map<string, { title: string; hero_image_url: string | null }>();
  if (wishIds.length > 0) {
    const { data: wishes } = await supabase
      .from("aura_wishes")
      .select("id, title, hero_image_url")
      .in("id", wishIds);
    wishMap = new Map(
      ((wishes || []) as Array<{
        id: string;
        title: string;
        hero_image_url: string | null;
      }>).map((w) => [w.id, { title: w.title, hero_image_url: w.hero_image_url }])
    );
  }

  // Berik
  const enriched = activities.map((a) => ({
    ...a,
    actor: actorMap.get(a.actor_id),
    wish: a.wish_id ? wishMap.get(a.wish_id) : undefined,
  }));

  // Marker alle som lest
  if (activities.some((a) => !a.read_at)) {
    await supabase
      .from("aura_activities")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id)
      .is("read_at", null);
  }

  // Grupper etter dag
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();

  const todayActs: typeof enriched = [];
  const yesterdayActs: typeof enriched = [];
  const earlier: typeof enriched = [];
  for (const a of enriched) {
    const key = new Date(a.created_at).toDateString();
    if (key === today) todayActs.push(a);
    else if (key === yesterdayKey) yesterdayActs.push(a);
    else earlier.push(a);
  }

  return (
    <div className="py-3 space-y-4">
      <header>
        <h1 className="aura-headline-lg">Aktivitet</h1>
        <p
          className="aura-body-md"
          style={{ color: "var(--aura-on-surface-variant)" }}
        >
          Dine siste oppdateringer fra venner.
        </p>
      </header>

      {activities.length === 0 ? (
        <div
          className="rounded-3xl p-6 text-center aura-shadow-1"
          style={{ background: "var(--aura-surface)" }}
        >
          <div className="text-4xl mb-2">🔔</div>
          <p
            className="aura-body-md"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Ingen aktivitet ennå.{" "}
            <Link
              href="/aura/venner"
              style={{ color: "var(--aura-primary-container)" }}
            >
              Finn venner
            </Link>{" "}
            for å se det de ønsker seg!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {todayActs.length > 0 && (
            <Section title="I dag" activities={todayActs} />
          )}
          {yesterdayActs.length > 0 && (
            <Section title="I går" activities={yesterdayActs} />
          )}
          {earlier.length > 0 && (
            <Section title="Tidligere" activities={earlier} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  activities,
}: {
  title: string;
  activities: Array<{
    id: string;
    kind: string;
    created_at: string;
    actor?: { display_name: string; avatar_url: string | null; color_hex: string | null };
    wish?: { title: string; hero_image_url: string | null };
    wish_id: string | null;
    metadata: Record<string, unknown>;
  }>;
}) {
  return (
    <section>
      <h2
        className="aura-label-sm uppercase tracking-wider mb-2"
        style={{ color: "var(--aura-on-surface-variant)" }}
      >
        {title}
      </h2>
      <div className="space-y-2">
        {activities.map((a) => (
          <ActivityItem key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}

function ActivityItem({
  a,
}: {
  a: {
    id: string;
    kind: string;
    created_at: string;
    actor?: { display_name: string; avatar_url: string | null; color_hex: string | null };
    wish?: { title: string; hero_image_url: string | null };
    wish_id: string | null;
    metadata: Record<string, unknown>;
  };
}) {
  const actor = a.actor?.display_name || "Noen";
  const firstName = actor.split(" ")[0];

  // Time ago
  const diff = Date.now() - new Date(a.created_at).getTime();
  const hours = Math.floor(diff / 3600000);
  const ago =
    hours < 1
      ? "nå"
      : hours < 24
      ? `${hours}t`
      : `${Math.floor(hours / 24)}d`;

  let icon: React.ReactNode;
  let bg = "var(--aura-surface-low)";
  let color = "var(--aura-on-surface-variant)";
  let text: React.ReactNode = a.kind;

  switch (a.kind) {
    case "wish_reserved":
      icon = <Gift className="w-4 h-4" />;
      bg = "var(--aura-primary-fixed)";
      color = "var(--aura-on-primary-fixed-variant, #004f57)";
      text = (
        <>
          <strong>{firstName}</strong> reserverte et ønske fra{" "}
          <strong>{a.wish?.title || "lista"}</strong>
        </>
      );
      break;
    case "wish_added":
      icon = <List className="w-4 h-4" />;
      text = (
        <>
          <strong>{firstName}</strong> la til et nytt ønske:{" "}
          <strong>{a.wish?.title}</strong>
        </>
      );
      break;
    case "wish_liked":
      icon = <Heart className="w-4 h-4" />;
      bg = "rgba(186,26,26,0.1)";
      color = "var(--aura-error)";
      text = (
        <>
          <strong>{firstName}</strong> likte ditt ønske{" "}
          <strong>&ldquo;{a.wish?.title}&rdquo;</strong>
        </>
      );
      break;
    case "price_drop":
      icon = <Tag className="w-4 h-4" />;
      bg = "rgba(46,125,50,0.1)";
      color = "var(--aura-success)";
      text = (
        <>
          <strong>Prisfall!</strong> Et ønske i listen din ble billigere.
          {a.metadata?.discount_percent && (
            <span> -{String(a.metadata.discount_percent)}%</span>
          )}
        </>
      );
      break;
    case "friend_request":
      icon = <UserPlus className="w-4 h-4" />;
      text = (
        <>
          <strong>{firstName}</strong> vil bli vennen din
        </>
      );
      break;
    case "friend_accepted":
      icon = <Check className="w-4 h-4" />;
      bg = "var(--aura-primary-fixed)";
      color = "var(--aura-on-primary-fixed-variant, #004f57)";
      text = (
        <>
          <strong>{firstName}</strong> godtok venneforespørselen
        </>
      );
      break;
    case "list_shared":
      icon = <Sparkles className="w-4 h-4" />;
      text = (
        <>
          <strong>{firstName}</strong> delte en liste med deg
        </>
      );
      break;
    default:
      icon = <Sparkles className="w-4 h-4" />;
  }

  return (
    <div
      className="rounded-2xl p-3 aura-shadow-1 flex gap-3 items-start"
      style={{ background: "var(--aura-surface)" }}
    >
      {a.actor && (
        <UserAvatar
          name={a.actor.display_name}
          avatarUrl={a.actor.avatar_url}
          colorHex={a.actor.color_hex}
          size="sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="aura-body-md" style={{ color: "var(--aura-on-surface)" }}>
          {text}
        </div>
        <div
          className="aura-label-sm mt-0.5"
          style={{ color: "var(--aura-on-surface-variant)" }}
        >
          {ago}
        </div>
        {a.wish?.hero_image_url && (
          <div className="mt-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.wish.hero_image_url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover"
            />
            <span className="aura-label-sm" style={{ color: "var(--aura-on-surface-variant)" }}>
              {a.wish.title}
            </span>
          </div>
        )}
      </div>
      <div
        className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0"
        style={{ background: bg, color }}
      >
        {icon}
      </div>
    </div>
  );
}
