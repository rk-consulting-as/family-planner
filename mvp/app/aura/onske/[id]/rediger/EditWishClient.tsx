"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateAuraWish, deleteAuraWish } from "@/lib/actions/aura";

type Wish = {
  id: string;
  list_id: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  hero_image_url: string | null;
  price: number | null;
  original_price: number | null;
  product_url: string | null;
  notes: string | null;
  priority: string;
  status: string;
};

export default function EditWishClient({
  wish,
  lists,
}: {
  wish: Wish;
  lists: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(wish.hero_image_url);
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File) {
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Ikke innlogget");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Bildet er for stort (maks 5 MB)");
        return;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/aura-wishes/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError("Opplasting feilet: " + upErr.message);
        return;
      }
      const { data: pub } = supabase.storage
        .from("attachments")
        .getPublicUrl(path);
      setHeroUrl(pub.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feil ved opplasting");
    } finally {
      setUploading(false);
    }
  }

  function handleSave(formData: FormData) {
    setError(null);
    if (heroUrl !== wish.hero_image_url) {
      formData.set("hero_image_url", heroUrl || "");
    }
    startTransition(async () => {
      const res = await updateAuraWish(wish.id, formData);
      if (!res.ok) {
        setError(res.error || "Feil");
        return;
      }
      router.push(`/aura/onske/${wish.id}`);
    });
  }

  function handleDelete() {
    if (!confirm("Slette dette ønsket?")) return;
    startTransition(async () => {
      const res = await deleteAuraWish(wish.id);
      if (res.ok) router.push("/aura");
    });
  }

  return (
    <div className="py-3 space-y-4">
      <Link
        href={`/aura/onske/${wish.id}`}
        className="aura-label-lg"
        style={{ color: "var(--aura-primary-container)" }}
      >
        ← Tilbake
      </Link>
      <h1 className="aura-headline-lg">Rediger ønske</h1>

      <form action={handleSave} className="space-y-3">
        {/* Bildevelger */}
        <div>
          <label
            className="aura-label-lg block mb-1.5"
            style={{ color: "var(--aura-on-surface)" }}
          >
            Bilde
          </label>
          {heroUrl ? (
            <div className="relative group rounded-2xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroUrl}
                alt=""
                className="w-full aspect-square object-cover"
              />
              <div
                className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition"
                style={{ background: "rgba(0,0,0,0.4)" }}
              >
                <label
                  className="aura-label-lg px-3 py-2 rounded-full cursor-pointer"
                  style={{
                    background: "var(--aura-primary-container)",
                    color: "var(--aura-on-primary-container)",
                  }}
                >
                  Bytt bilde
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setHeroUrl(null)}
                  className="aura-label-lg px-3 py-2 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    color: "var(--aura-on-surface)",
                  }}
                >
                  Fjern
                </button>
              </div>
            </div>
          ) : (
            <label
              className="block aspect-[4/3] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition"
              style={{
                background: "var(--aura-surface-low)",
                border: "2px dashed var(--aura-outline-variant)",
              }}
            >
              {uploading ? (
                <span
                  className="aura-body-md"
                  style={{ color: "var(--aura-on-surface-variant)" }}
                >
                  Laster opp…
                </span>
              ) : (
                <>
                  <Camera
                    className="w-8 h-8 mb-2"
                    style={{ color: "var(--aura-on-surface-variant)" }}
                  />
                  <span
                    className="aura-label-lg"
                    style={{ color: "var(--aura-on-surface)" }}
                  >
                    Last opp bilde
                  </span>
                  <span
                    className="aura-label-sm mt-1"
                    style={{ color: "var(--aura-on-surface-variant)" }}
                  >
                    JPG, PNG eller WEBP — maks 5 MB
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <p
            className="aura-label-sm mt-2"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Eller lim inn en bilde-URL:
          </p>
          <input
            value={heroUrl || ""}
            onChange={(e) => setHeroUrl(e.target.value || null)}
            placeholder="https://..."
            className="aura-input mt-1"
          />
        </div>

        <Field label="Tittel">
          <input
            name="title"
            required
            defaultValue={wish.title}
            className="aura-input"
          />
        </Field>
        <Field label="Beskrivelse">
          <textarea
            name="description"
            rows={2}
            defaultValue={wish.description || ""}
            className="aura-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Merke">
            <input
              name="brand"
              defaultValue={wish.brand || ""}
              className="aura-input"
            />
          </Field>
          <Field label="Kategori">
            <input
              name="category"
              defaultValue={wish.category || ""}
              className="aura-input"
            />
          </Field>
          <Field label="Pris (kr)">
            <input
              name="price"
              type="number"
              step="0.01"
              defaultValue={wish.price || ""}
              className="aura-input"
            />
          </Field>
          <Field label="Originalpris (kr)">
            <input
              name="original_price"
              type="number"
              step="0.01"
              defaultValue={wish.original_price || ""}
              className="aura-input"
            />
          </Field>
        </div>
        <Field label="Lenke til produkt">
          <input
            name="product_url"
            type="url"
            defaultValue={wish.product_url || ""}
            placeholder="https://..."
            className="aura-input"
          />
        </Field>
        <Field label="Notat">
          <textarea
            name="notes"
            rows={2}
            defaultValue={wish.notes || ""}
            placeholder="F.eks. helst i blå, str. 42"
            className="aura-input"
          />
        </Field>
        <Field label="Prioritet">
          <select
            name="priority"
            defaultValue={wish.priority}
            className="aura-input"
          >
            <option value="low">Kanskje</option>
            <option value="normal">Ønske</option>
            <option value="high">Høyt ønske</option>
            <option value="must_have">Må ha! ⭐</option>
          </select>
        </Field>
        {lists.length > 0 && (
          <Field label="Ønskeliste">
            <select
              name="list_id"
              defaultValue={wish.list_id || ""}
              className="aura-input"
            >
              <option value="">— Ingen —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && (
          <div
            className="aura-body-md p-3 rounded-xl"
            style={{
              background: "var(--aura-error-container, #ffdad6)",
              color: "var(--aura-on-error-container, #93000a)",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 py-3 aura-label-lg rounded-full disabled:opacity-50"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            {pending ? "Lagrer…" : "Lagre"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="aura-label-lg px-5 py-3 rounded-full"
            style={{
              background: "var(--aura-surface-low)",
              color: "var(--aura-error)",
            }}
          >
            Slett
          </button>
        </div>
      </form>

      <style>{`
        .aura-input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--aura-surface-low);
          border: 2px solid transparent;
          font-size: 16px;
          font-family: inherit;
          color: var(--aura-on-surface);
          outline: none;
          transition: all 0.15s;
        }
        .aura-input:focus {
          background: var(--aura-surface);
          border-color: var(--aura-primary-container);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="aura-label-lg block mb-1.5"
        style={{ color: "var(--aura-on-surface)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
