import { requireModule, getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Camera } from "lucide-react";
import PhotoGallery from "./PhotoGallery";

export default async function BilderPage() {
  await requireModule("photos");
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("family_photos")
    .select(
      "id, public_url, thumbnail_url, caption, taken_at, tagged_profile_ids, uploaded_by, created_at, album_id"
    )
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(120);

  type Photo = {
    id: string;
    public_url: string | null;
    thumbnail_url: string | null;
    caption: string | null;
    taken_at: string | null;
    tagged_profile_ids: string[];
    uploaded_by: string;
    created_at: string;
    album_id: string | null;
  };
  const list = (photos || []) as Photo[];

  return (
    <div className="space-y-md max-w-6xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
            <Camera className="w-7 h-7 text-primary" />
            Fotobibliotek
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Familiens delte bilder. Tagg deltakere og bruk dem som hero på ønsker og oppskrifter.
          </p>
        </div>
      </header>

      <PhotoGallery
        groupId={ctx.group.id}
        currentUserId={ctx.user.id}
        members={ctx.members.map((m) => ({
          profile_id: m.profile_id,
          display_name: m.display_name,
          avatar_url: m.avatar_url,
          color_hex: m.color_hex,
        }))}
        photos={list}
      />
    </div>
  );
}
