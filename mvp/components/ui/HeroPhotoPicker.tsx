"use client";

import { useEffect, useState } from "react";
import { Camera, X, Upload, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// Lar brukeren velge et bilde fra familiens fotobibliotek ELLER laste opp et nytt
// rett inn i biblioteket.
// onChange returnerer URL-en når bruker har valgt.

export type HeroPhotoPickerProps = {
  groupId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
};

export default function HeroPhotoPicker({
  groupId,
  value,
  onChange,
  label = "Hovedbilde",
}: HeroPhotoPickerProps) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; public_url: string | null; caption: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("family_photos")
        .select("id, public_url, caption")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(60);
      setPhotos((data as typeof photos) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste bilder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open, groupId]);

  async function handleUpload(file: File) {
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke innlogget");

      const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_");
      const path = `${user.id}/family-photos/${groupId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);

      const { data: inserted, error: insErr } = await supabase
        .from("family_photos")
        .insert({
          group_id: groupId,
          uploaded_by: user.id,
          storage_path: path,
          public_url: pub.publicUrl,
          mime_type: file.type,
          size_bytes: file.size,
        })
        .select("id, public_url")
        .single();
      if (insErr || !inserted) throw new Error(insErr?.message || "DB-feil");

      onChange(pub.publicUrl);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opplasting feilet");
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-label-lg font-bold text-on-surface">{label}</label>

      {value ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="w-full aspect-[16/9] object-cover rounded-xl"
          />
          <div className="absolute inset-0 bg-on-surface/0 group-hover:bg-on-surface/40 transition rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <Button size="sm" variant="tonal" onClick={() => setOpen(true)}>
                Bytt
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                Fjern
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full aspect-[16/9] rounded-xl bg-surface-container-low border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:bg-surface-container transition"
        >
          <Camera className="w-8 h-8" />
          <span className="text-body-md font-bold">Velg eller last opp bilde</span>
          <span className="text-label-sm">Fra familiens fotobibliotek</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-on-surface/70 backdrop-blur flex items-center justify-center p-3">
          <div className="bg-surface-container-lowest rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-pop">
            <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30">
              <h3 className="font-display text-headline-md">Velg bilde</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-md space-y-3">
              <label className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary-container text-on-primary-container cursor-pointer hover:bg-primary-container/80 font-bold">
                <Upload className="w-5 h-5" />
                Last opp nytt bilde
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>

              {error && (
                <p className="text-label-lg text-error bg-error-container/40 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div>
                <h4 className="text-label-lg font-bold mb-2">
                  Eller velg fra biblioteket
                </h4>
                {loading ? (
                  <p className="text-body-md text-on-surface-variant py-md text-center">
                    Laster bilder…
                  </p>
                ) : photos.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant py-md text-center">
                    Ingen bilder i fotobiblioteket ennå. Last opp ditt første!
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
                    {photos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onChange(p.public_url);
                          setOpen(false);
                        }}
                        className="aspect-square rounded-lg overflow-hidden bg-surface-container relative hover:ring-2 ring-primary transition"
                      >
                        {p.public_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.public_url}
                            alt={p.caption || ""}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {value === p.public_url && (
                          <span className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                            <Check className="w-6 h-6 text-on-primary" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
