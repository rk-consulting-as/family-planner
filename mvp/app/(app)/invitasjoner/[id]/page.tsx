import { notFound } from "next/navigation";
import { getActiveContext, requireModule } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import InvitationEditor, { Invitation, Asset } from "./InvitationEditor";

export default async function InvitationEditPage({
  params,
}: {
  params: { id: string };
}) {
  await requireModule("invitations");
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("event_invitations")
    .select(
      "id, group_id, title, occasion, theme, format, image_mode, host_name, host_age, " +
        "event_date, event_time, location, location_details, dress_code, gift_info, " +
        "rsvp_deadline, rsvp_contact, extra_notes, generated_text, generated_image_url, status"
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!inv) notFound();

  const { data: assets } = await supabase
    .from("event_invitation_attachments")
    .select("id, kind, public_url, caption")
    .eq("invitation_id", params.id)
    .order("position");

  return (
    <InvitationEditor
      invitation={inv as Invitation}
      assets={(assets || []) as Asset[]}
      groupMembers={ctx.members.map((m) => ({
        profile_id: m.profile_id,
        display_name: m.display_name,
        color_hex: m.color_hex,
      }))}
      currentUserId={ctx.user.id}
    />
  );
}
