import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuraWishlist } from "@/lib/actions/aura";

export default function NyListePage() {
  async function handle(formData: FormData) {
    "use server";
    const res = await createAuraWishlist(formData);
    if (res.ok && res.id) redirect(`/aura/liste/${res.id}`);
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
      <h1 className="aura-headline-lg">Ny ønskeliste</h1>

      <form action={handle} className="space-y-4">
        <Field label="Tittel">
          <input
            name="title"
            required
            placeholder="F.eks. Bursdag 2024"
            className="aura-input"
          />
        </Field>
        <Field label="Beskrivelse">
          <textarea
            name="description"
            rows={2}
            placeholder="Valgfritt"
            className="aura-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Anledning">
            <select name="occasion" defaultValue="" className="aura-input">
              <option value="">— Velg —</option>
              <option value="birthday">🎂 Bursdag</option>
              <option value="christmas">🎄 Jul</option>
              <option value="wedding">💍 Bryllup</option>
              <option value="anniversary">🥂 Jubileum</option>
              <option value="other">🎁 Annet</option>
            </select>
          </Field>
          <Field label="Dato">
            <input type="date" name="occasion_date" className="aura-input" />
          </Field>
        </div>
        <Field label="Hvem kan se?">
          <select name="visibility" defaultValue="friends" className="aura-input">
            <option value="private">🔒 Bare meg</option>
            <option value="friends">👥 Venner</option>
            <option value="public">🌍 Offentlig</option>
          </select>
        </Field>
        <Field label="Cover-bilde URL (valgfri)">
          <input
            name="cover_image_url"
            placeholder="https://..."
            className="aura-input"
          />
        </Field>

        <button
          type="submit"
          className="w-full py-3 aura-label-lg rounded-full transition"
          style={{
            background: "var(--aura-primary-container)",
            color: "var(--aura-on-primary-container)",
          }}
        >
          Lag ønskeliste
        </button>
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
