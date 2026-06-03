import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserAvatar } from "@/components/ui/Avatar";
import { Search, Users } from "lucide-react";
import FriendRequestActions from "./FriendRequestActions";

export default async function VennerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Venneforespørsler (kommet til meg)
  const { data: pendingRaw } = await supabase
    .from("aura_friendships")
    .select("id, requester_id, created_at")
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  type Pending = { id: string; requester_id: string; created_at: string };
  const pending = (pendingRaw || []) as Pending[];

  // Aksepterte venner
  const { data: friendsRaw } = await supabase
    .from("aura_friendships")
    .select("id, requester_id, recipient_id")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .eq("status", "accepted");

  type Friend = { id: string; requester_id: string; recipient_id: string };
  const friends = (friendsRaw || []) as Friend[];

  // Hent profiler for alle som vises
  const allIds = Array.from(
    new Set([
      ...pending.map((p) => p.requester_id),
      ...friends.flatMap((f) =>
        f.requester_id === user.id ? [f.recipient_id] : [f.requester_id]
      ),
    ])
  );
  let profileMap = new Map<
    string,
    {
      display_name: string;
      avatar_url: string | null;
      color_hex: string | null;
    }
  >();
  if (allIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, color_hex")
      .in("id", allIds);
    profileMap = new Map(
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

  return (
    <div className="py-3 space-y-4">
      <Link
        href="/aura"
        className="aura-label-lg"
        style={{ color: "var(--aura-primary-container)" }}
      >
        ← Tilbake
      </Link>
      <header>
        <h1 className="aura-headline-lg">Venneforespørsler</h1>
      </header>

      {/* Søk */}
      <div
        className="rounded-full px-4 py-3 flex items-center gap-2"
        style={{ background: "var(--aura-surface-low)" }}
      >
        <Search
          className="w-4 h-4"
          style={{ color: "var(--aura-on-surface-variant)" }}
        />
        <input
          placeholder="Finn venner"
          className="bg-transparent flex-1 outline-none aura-body-md"
          style={{ color: "var(--aura-on-surface)" }}
        />
      </div>

      {/* Venter på svar */}
      {pending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2
              className="aura-headline-md"
              style={{ color: "var(--aura-on-surface)" }}
            >
              Venter på svar ({pending.length})
            </h2>
            <Link
              href="#"
              className="aura-label-lg"
              style={{ color: "var(--aura-primary-container)" }}
            >
              Se alle
            </Link>
          </div>
          <div className="space-y-2">
            {pending.map((p) => {
              const profile = profileMap.get(p.requester_id);
              if (!profile) return null;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl p-3 flex items-center gap-3 aura-shadow-1"
                  style={{ background: "var(--aura-surface)" }}
                >
                  <UserAvatar
                    name={profile.display_name}
                    avatarUrl={profile.avatar_url}
                    colorHex={profile.color_hex}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="aura-label-lg"
                      style={{ color: "var(--aura-on-surface)" }}
                    >
                      {profile.display_name}
                    </div>
                    <div
                      className="aura-label-sm"
                      style={{ color: "var(--aura-on-surface-variant)" }}
                    >
                      Vil bli venn
                    </div>
                  </div>
                  <FriendRequestActions friendshipId={p.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Aksepterte venner */}
      {friends.length > 0 && (
        <section>
          <h2
            className="aura-headline-md mb-2"
            style={{ color: "var(--aura-on-surface)" }}
          >
            Vennene dine ({friends.length})
          </h2>
          <div className="space-y-2">
            {friends.map((f) => {
              const otherId =
                f.requester_id === user.id ? f.recipient_id : f.requester_id;
              const profile = profileMap.get(otherId);
              if (!profile) return null;
              return (
                <div
                  key={f.id}
                  className="rounded-2xl p-3 flex items-center gap-3 aura-shadow-1"
                  style={{ background: "var(--aura-surface)" }}
                >
                  <UserAvatar
                    name={profile.display_name}
                    avatarUrl={profile.avatar_url}
                    colorHex={profile.color_hex}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="aura-label-lg"
                      style={{ color: "var(--aura-on-surface)" }}
                    >
                      {profile.display_name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pending.length === 0 && friends.length === 0 && (
        <div
          className="rounded-3xl p-8 text-center aura-shadow-1"
          style={{ background: "var(--aura-surface)" }}
        >
          <div className="text-5xl mb-2">
            <Users
              className="w-12 h-12 mx-auto"
              style={{ color: "var(--aura-on-surface-variant)" }}
            />
          </div>
          <p
            className="aura-body-md mt-2"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Ingen venner ennå. Søk etter folk over for å sende din første
            venneforespørsel.
          </p>
        </div>
      )}
    </div>
  );
}
