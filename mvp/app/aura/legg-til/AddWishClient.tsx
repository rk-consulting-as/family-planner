"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Sparkles, Pencil, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchWishFromUrl, createAuraWish } from "@/lib/actions/aura";

type List = { id: string; title: string };

export default function AddWishClient({
  lists,
}: {
  lists: List[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{
    title: string;
    description?: string;
    brand?: string;
    category?: string;
    hero_image_url?: string;
    price?: number;
    original_price?: number;
  } | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File) {
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke innlogget");
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Bildet er for stort (maks 5 MB)");
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/aura-wishes/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage
        .from("attachments")
        .getPublicUrl(path);
      setUploadedImage(pub.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opplasting feilet");
    } finally {
      setUploading(false);
    }
  }

  function handleFetch() {
    setError(null);
    setFetched(null);
    startTransition(async () => {
      const res = await fetchWishFromUrl(sourceUrl);
      if (!res.ok) {
        setError(res.error || "Kunne ikke hente");
        // Hvis siden blokkerer oss, gå direkte til manuelt skjema
        // med URL bevart + det vi klarte å gjette fra slug
        if (res.fallback_url) {
          if (res.partial) {
            setFetched({
              title: res.partial.title || "",
              brand: res.partial.brand,
              category: res.partial.category,
              hero_image_url: res.partial.hero_image_url,
              price: res.partial.price,
            });
          }
          setMode("manual");
        }
        return;
      }
      if (res.data) setFetched(res.data);
    });
  }

  function handleSave(formData: FormData) {
    setError(null);
    if (fetched) {
      if (fetched.price !== undefined)
        formData.set("price", String(fetched.price));
      if (fetched.original_price !== undefined)
        formData.set("original_price", String(fetched.original_price));
      if (fetched.brand) formData.set("brand", fetched.brand);
      if (fetched.category) formData.set("category", fetched.category);
    }
    // Bilde-prioritet: opplastet > AI-fetched > tom
    const finalImage = uploadedImage || fetched?.hero_image_url || "";
    if (finalImage) formData.set("hero_image_url", finalImage);
    // Bevar URL også når brukeren fyller inn manuelt etter en mislykket fetch
    if (sourceUrl) formData.set("product_url", sourceUrl);
    startTransition(async () => {
      const res = await createAuraWish(formData);
      if (!res.ok) {
        setError(res.error || "Klarte ikke lagre");
        return;
      }
      router.push("/aura");
    });
  }

  return (
    <div className="space-y-4 py-3">
      <h1 className="aura-headline-lg">Nytt ønske</h1>

      {/* Mode toggle */}
      <div
        className="flex gap-1 p-1 rounded-full"
        style={{ background: "var(--aura-surface-low)" }}
      >
        <button
          onClick={() => setMode("url")}
          className="flex-1 py-2 aura-label-lg rounded-full flex items-center justify-center gap-1.5 transition"
          style={{
            background:
              mode === "url"
                ? "var(--aura-primary-container)"
                : "transparent",
            color:
              mode === "url"
                ? "var(--aura-on-primary-container)"
                : "var(--aura-on-surface-variant)",
          }}
        >
          <LinkIcon className="w-4 h-4" /> Lim inn URL
        </button>
        <button
          onClick={() => setMode("manual")}
          className="flex-1 py-2 aura-label-lg rounded-full flex items-center justify-center gap-1.5 transition"
          style={{
            background:
              mode === "manual"
                ? "var(--aura-primary-container)"
                : "transparent",
            color:
              mode === "manual"
                ? "var(--aura-on-primary-container)"
                : "var(--aura-on-surface-variant)",
          }}
        >
          <Pencil className="w-4 h-4" /> Manuell
        </button>
      </div>

      {/* URL mode */}
      {mode === "url" && !fetched && (
        <div
          className="rounded-2xl p-4 aura-shadow-1"
          style={{ background: "var(--aura-surface)" }}
        >
          <label
            className="aura-label-sm uppercase block mb-2"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            PASTE A PRODUCT LINK
          </label>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://amazon.com/product/..."
            className="w-full p-3 rounded-xl mb-2 aura-input"
          />
          <button
            onClick={handleFetch}
            disabled={!sourceUrl || pending}
            className="w-full py-2.5 aura-label-lg rounded-full flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            <Sparkles className="w-4 h-4" />
            {pending ? "Henter…" : "Fetch Wish Details"}
          </button>
        </div>
      )}

      {/* Form (vises både for manual og etter URL-fetch) */}
      {(mode === "manual" || fetched) && (
        <form action={handleSave} className="space-y-3">
          {/* Bilde-velger / opplaster */}
          <div>
            {uploadedImage || fetched?.hero_image_url ? (
              <div className="relative group rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedImage || fetched?.hero_image_url || ""}
                  alt=""
                  className="w-full aspect-[4/3] object-cover"
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
                    Bytt
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
                </div>
              </div>
            ) : (
              <label
                className="block aspect-[4/3] rounded-2xl flex flex-col items-center justify-center cursor-pointer"
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
          </div>
          {fetched && (
            <div
              className="aura-body-md p-2 rounded-xl text-center"
              style={{
                background: "var(--aura-primary-fixed)",
                color: "var(--aura-on-primary-fixed, #001f23)",
              }}
            >
              {error
                ? "💡 Sjekk og fyll ut det som mangler"
                : "✨ AI hentet detaljene. Sjekk og lagre."}
            </div>
          )}
          <Field label="Tittel">
            <input
              name="title"
              required
              defaultValue={fetched?.title || ""}
              placeholder="F.eks. Handball Spezial sneakers"
              className="aura-input"
            />
          </Field>
          <Field label="Beskrivelse">
            <textarea
              name="description"
              rows={2}
              defaultValue={fetched?.description || ""}
              className="aura-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Merke">
              <input
                name="brand"
                defaultValue={fetched?.brand || ""}
                placeholder="Adidas"
                className="aura-input"
              />
            </Field>
            <Field label="Kategori">
              <input
                name="category"
                defaultValue={fetched?.category || ""}
                placeholder="Sneakers"
                className="aura-input"
              />
            </Field>
            <Field label="Pris (kr)">
              <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={fetched?.price || ""}
                className="aura-input"
              />
            </Field>
            <Field label="Originalpris (kr)">
              <input
                name="original_price"
                type="number"
                step="0.01"
                defaultValue={fetched?.original_price || ""}
                className="aura-input"
              />
            </Field>
          </div>
          <Field label="Notat">
            <textarea
              name="notes"
              rows={2}
              placeholder="F.eks. helst i blå, str. 42"
              className="aura-input"
            />
          </Field>
          <Field label="Prioritet">
            <select name="priority" defaultValue="normal" className="aura-input">
              <option value="low">Kanskje</option>
              <option value="normal">Ønske</option>
              <option value="high">Høyt ønske</option>
              <option value="must_have">Må ha! ⭐</option>
            </select>
          </Field>
          {lists.length > 0 && (
            <Field label="Legg til i ønskeliste (valgfri)">
              <select name="list_id" defaultValue="" className="aura-input">
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

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 aura-label-lg rounded-full disabled:opacity-50"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            {pending ? "Lagrer…" : "Legg til ønske"}
          </button>
        </form>
      )}

      {error && !fetched && mode === "url" && (
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
