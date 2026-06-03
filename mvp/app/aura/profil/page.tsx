import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserAvatar } from "@/components/ui/Avatar";

export default async function AuraProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, color_hex")
    .eq("id", user.id)
    .single();
  type P = { display_name: string; avatar_url: string | null; color_hex: string | null };
  const p = (profile || { display_name: "Du", avatar_url: null, color_hex: null }) as P;

  const { data: ap } = await supabase
    .from("aura_profiles")
    .select("username, bio, follower_count, following_count, wish_count")
    .eq("profile_id", user.id)
    .maybeSingle();
  const ap2 = (ap || {
    username: null,
    bio: null,
    follower_count: 0,
    following_count: 0,
    wish_count: 0,
  }) as {
    username: string | null;
    bio: string | null;
    follower_count: number;
    following_count: number;
    wish_count: number;
  };

  return (
    <div className="py-3 space-y-4">
      <div className="flex flex-col items-center gap-2 pt-4">
        <UserAvatar
          name={p.display_name}
          avatarUrl={p.avatar_url}
          colorHex={p.color_hex}
          size="xl"
          ring
        />
        <h1 className="aura-headline-lg">{p.display_name}</h1>
        {ap2.username && (
          <p
            className="aura-body-md"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            @{ap2.username}
          </p>
        )}
      </div>

      <div className="flex justify-around py-3">
        <Stat label="ØNSKER" value={ap2.wish_count} />
        <Stat label="FØLGERE" value={ap2.follower_count} />
        <Stat label="FØLGER" value={ap2.following_count} />
      </div>

      <Link
        href="/profil"
        className="block text-center py-3 aura-label-lg rounded-full"
        style={{
          background: "var(--aura-surface-low)",
          color: "var(--aura-on-surface)",
        }}
      >
        ✎ Rediger profil
      </Link>

      <Link
        href="/dashboard"
        className="block text-center py-3 aura-label-lg rounded-full"
        style={{
          background: "var(--aura-surface-low)",
          color: "var(--aura-on-surface-variant)",
        }}
      >
        ← Tilbake til Kinship
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="aura-headline-md">{value}</div>
      <div
        className="aura-label-sm uppercase mt-0.5"
        style={{ color: "var(--aura-on-surface-variant)" }}
      >
        {label}
      </div>
    </div>
  );
}
