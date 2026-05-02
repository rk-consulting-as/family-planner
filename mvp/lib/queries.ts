import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type ActiveContext = {
  user: { id: string; email: string | null };
  profile: {
    id: string;
    display_name: string;
    color_hex: string | null;
    avatar_url: string | null;
    is_system_admin: boolean;
  };
  group: {
    id: string;
    name: string;
    type: string;
    invite_code: string | null;
  };
  role: "owner" | "admin" | "member";
  members: Array<{
    profile_id: string;
    display_name: string;
    color_hex: string | null;
    avatar_url: string | null;
    role: "owner" | "admin" | "member";
  }>;
};

/**
 * Returns the user's active context, or null if user has no group yet.
 */
export async function getActiveContext(preferredGroupId?: string): Promise<ActiveContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("id, display_name, color_hex, avatar_url, is_system_admin")
    .eq("id", user.id)
    .single();
  if (!profileRaw) return null;
  type ProfileShape = {
    id: string;
    display_name: string;
    color_hex: string | null;
    avatar_url: string | null;
    is_system_admin?: boolean | null;
  };
  const p = profileRaw as ProfileShape;
  const profile = {
    id: p.id,
    display_name: p.display_name,
    color_hex: p.color_hex,
    avatar_url: p.avatar_url,
    is_system_admin: !!p.is_system_admin,
  };

  // Find groups
  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, group:groups(id, name, type, invite_code)")
    .eq("profile_id", user.id);

  if (!memberships || memberships.length === 0) return null;

  // Resolve preferred group from cookie or arg
  const cookieStore = cookies();
  const cookieGroupId = cookieStore.get("active_group")?.value;
  const targetId = preferredGroupId || cookieGroupId || memberships[0].group?.id;

  type Membership = {
    role: "owner" | "admin" | "member";
    group: { id: string; name: string; type: string; invite_code: string | null } | null;
  };
  const typed = memberships as Membership[];
  const found = typed.find((m) => m.group?.id === targetId) || typed[0];

  if (!found.group) return null;

  // Members of the active group
  const { data: members } = await supabase
    .from("group_members")
    .select("role, profile:profiles(id, display_name, color_hex, avatar_url)")
    .eq("group_id", found.group.id);

  type MemberRow = {
    role: "owner" | "admin" | "member";
    profile: { id: string; display_name: string; color_hex: string | null; avatar_url: string | null } | null;
  };
  const memberList = ((members as MemberRow[] | null) || [])
    .filter((m): m is MemberRow & { profile: NonNullable<MemberRow["profile"]> } => !!m.profile)
    .map((m) => ({
      profile_id: m.profile.id,
      display_name: m.profile.display_name,
      color_hex: m.profile.color_hex,
      avatar_url: m.profile.avatar_url,
      role: m.role,
    }));

  return {
    user: { id: user.id, email: user.email ?? null },
    profile,
    group: found.group,
    role: found.role,
    members: memberList,
  };
}
