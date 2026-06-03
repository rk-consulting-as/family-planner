"use client";

import { useState, useTransition } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UserAvatar, AvatarStack } from "@/components/ui/Avatar";
import { uploadPhoto, deletePhoto, updatePhoto } from "@/lib/actions/photos";
import { Upload, X, Tag } from "lucide-react";

type Photo = {
  id: string;
  public_url: string | null;
  caption: string | null;
  tagged_profile_ids: string[];
  uploaded_by: string;
  created_at: string;
};

type Member = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  color_hex: string | null;
};

export default function PhotoGallery({
  groupId,
  currentUserId,
  members,
  photos,
}: {
  groupId: string;
  currentUserId: string;
  members: Member[];
  photos: Photo[];
}) {
  const [selected, setSelected] = useState<Photo | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const memberById = new Map(members.map((m) => [m.profile_id, m]));

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    startTransition(async () => {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", f);
        const res = await uploadPhoto(groupId, fd);
        if (!res.ok) {
          setError(res.error || "Opplasting feilet");
          return;
        }
      }
    });
  }

  return (
    <div className="space-y-md">
      {/* Upload */}
      <Card>
        <CardBody>
          <label className="flex flex-col items-center justify-center gap-2 py-md border-2 border-dashed border-outline-variant/50 rounded-xl cursor-pointer hover:bg-surface-container-low transition">
            <Upload className="w-8 h-8 text-on-surface-variant" />
            <span className="text-body-md text-on-surface">
              {pending ? "Laster opp…" : "Klikk eller dra bilder hit"}
            </span>
            <span className="text-label-sm text-on-surface-variant">
              JPG, PNG, WEBP eller GIF — maks 10 MB
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
          {error && (
            <p className="text-label-lg text-error bg-error-container/40 rounded-lg px-3 py-2 mt-3">
              {error}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Grid */}
      {photos.length === 0 ? (
        <Card>
          <CardBody className="text-center py-md">
            <p className="text-body-md text-on-surface-variant">
              Ingen bilder ennå. Last opp det første!
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="group aspect-square rounded-xl overflow-hidden bg-surface-container relative hover:ring-2 ring-primary transition"
            >
              {p.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.public_url}
                  alt={p.caption || ""}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-3xl text-on-surface-variant/40">
                  🖼️
                </div>
              )}
              {p.tagged_profile_ids.length > 0 && (
                <div className="absolute bottom-1.5 left-1.5">
                  <AvatarStack
                    members={p.tagged_profile_ids
                      .map((id) => memberById.get(id))
                      .filter((m): m is Member => !!m)
                      .map((m) => ({
                        display_name: m.display_name,
                        avatar_url: m.avatar_url,
                        color_hex: m.color_hex,
                      }))}
                    size="xs"
                    max={3}
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <Lightbox
          photo={selected}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Lightbox({
  photo,
  members,
  currentUserId,
  onClose,
}: {
  photo: Photo;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [tagged, setTagged] = useState<string[]>(photo.tagged_profile_ids);
  const [caption, setCaption] = useState(photo.caption || "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updatePhoto(photo.id, {
        caption,
        tagged_profile_ids: tagged,
      });
      if (!res.ok) setError(res.error || "Feil");
    });
  }

  function handleDelete() {
    if (!confirm("Slette dette bildet?")) return;
    startTransition(async () => {
      await deletePhoto(photo.id);
      onClose();
    });
  }

  function toggleTag(profileId: string) {
    setTagged((arr) =>
      arr.includes(profileId) ? arr.filter((id) => id !== profileId) : [...arr, profileId]
    );
  }

  const canDelete = photo.uploaded_by === currentUserId;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-on-surface/80 backdrop-blur flex items-center justify-center p-3"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-pop"
      >
        <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30">
          <h3 className="font-display text-headline-md">Bilde</h3>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid md:grid-cols-[2fr,1fr] gap-md p-md">
          <div className="bg-surface-container rounded-xl overflow-hidden">
            {photo.public_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.public_url}
                alt={caption}
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-label-lg font-bold mb-1.5">
                Tekst (valgfri)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Beskriv dette øyeblikket..."
                className="w-full rounded-lg bg-surface-container-low border-2 border-transparent focus:bg-surface-container-lowest focus:border-primary outline-none text-body-md p-3 transition-all"
              />
            </div>

            <div>
              <label className="block text-label-lg font-bold mb-1.5 flex items-center gap-1.5">
                <Tag className="w-4 h-4" /> Hvem er på bildet?
              </label>
              <div className="space-y-1.5">
                {members.map((m) => (
                  <label
                    key={m.profile_id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={tagged.includes(m.profile_id)}
                      onChange={() => toggleTag(m.profile_id)}
                    />
                    <UserAvatar
                      name={m.display_name}
                      avatarUrl={m.avatar_url}
                      colorHex={m.color_hex}
                      size="xs"
                    />
                    <span className="text-body-md">{m.display_name}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-label-lg text-error bg-error-container/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button onClick={save} disabled={pending}>
                {pending ? "Lagrer…" : "Lagre"}
              </Button>
              {canDelete && (
                <Button variant="ghost" onClick={handleDelete} disabled={pending}>
                  Slett bilde
                </Button>
              )}
            </div>

            {photo.public_url && (
              <a
                href={photo.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-label-sm text-primary hover:underline"
              >
                Åpne i nytt vindu
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
