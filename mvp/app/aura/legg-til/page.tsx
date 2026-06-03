import Link from "next/link";

export default function LeggTilPage() {
  return (
    <div className="py-3 space-y-4">
      <h1 className="aura-headline-lg">Add a New Wish</h1>
      <p
        className="aura-body-md"
        style={{ color: "var(--aura-on-surface-variant)" }}
      >
        Capture your daydreams instantly. Paste a link or snap a photo,
        and we&apos;ll handle the rest.
      </p>

      <div className="space-y-3">
        {/* URL-paste */}
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
            placeholder="https://amazon.com/product/..."
            className="w-full p-3 rounded-xl mb-2"
            style={{
              background: "var(--aura-surface-low)",
              border: "2px solid transparent",
              fontSize: "16px",
              color: "var(--aura-on-surface)",
            }}
          />
          <button
            className="w-full py-2.5 aura-label-lg rounded-full"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            Fetch Wish Details
          </button>
        </div>

        {/* Scan / upload */}
        <Link
          href="/aura/legg-til/manual"
          className="block rounded-2xl p-4 aura-shadow-1 text-center"
          style={{
            background: "var(--aura-surface)",
            border: "2px dashed var(--aura-outline-variant)",
          }}
        >
          <div className="text-3xl mb-1">📸</div>
          <div
            className="aura-headline-md"
            style={{ color: "var(--aura-on-surface)" }}
          >
            Scan or Upload
          </div>
          <div
            className="aura-body-md"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Analyze product photos
          </div>
        </Link>

        <Link
          href="/aura/legg-til/manual"
          className="block rounded-2xl p-4 aura-shadow-1 text-center"
          style={{
            background: "var(--aura-surface)",
            border: "2px dashed var(--aura-outline-variant)",
          }}
        >
          <div className="text-3xl mb-1">✏️</div>
          <div
            className="aura-headline-md"
            style={{ color: "var(--aura-on-surface)" }}
          >
            Manual Entry
          </div>
          <div
            className="aura-body-md"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Fill in details yourself
          </div>
        </Link>
      </div>

      <div
        className="rounded-2xl p-4 aura-shadow-1"
        style={{ background: "var(--aura-surface)" }}
      >
        <div className="aura-label-lg mb-3">How it works</div>
        {[
          "Find an item you love on any website or in a physical store.",
          "Use the URL paste or camera scan above to bring the item into Aura Wish.",
          "We'll automatically track price drops and organize it into your chosen wishlist.",
        ].map((line, i) => (
          <div key={i} className="flex gap-3 mb-2 last:mb-0">
            <span
              className="w-6 h-6 rounded-full grid place-items-center aura-label-sm flex-shrink-0"
              style={{
                background: "var(--aura-primary-container)",
                color: "var(--aura-on-primary-container)",
              }}
            >
              {i + 1}
            </span>
            <span
              className="aura-body-md"
              style={{ color: "var(--aura-on-surface-variant)" }}
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
