import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: prof } = await supabase
    .from("profiles")
    .select("is_system_admin, display_name")
    .eq("id", user.id)
    .single();
  type R = { is_system_admin?: boolean | null } | null;
  if (!(prof as R)?.is_system_admin) return new NextResponse("Forbidden", { status: 403 });

  const groupId = req.nextUrl.searchParams.get("group");
  if (!groupId) return new NextResponse("Missing 'group' query param", { status: 400 });

  const { data, error } = await supabase.rpc("admin_export_group", { p_group: groupId });
  if (error) return new NextResponse(error.message, { status: 500 });

  const groupRow = (data as { group?: { name?: string } } | null)?.group;
  const safeName = (groupRow?.name || "group").replace(/[^a-z0-9-_]+/gi, "_");
  const filename = `${safeName}_${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
