export default function InspirasjonPage() {
  return (
    <div className="py-3 space-y-4">
      <h1 className="aura-headline-lg">Inspirasjon</h1>
      <p
        className="aura-body-md"
        style={{ color: "var(--aura-on-surface-variant)" }}
      >
        Trending wishes og populære merker.
      </p>
      <div
        className="rounded-3xl p-6 text-center aura-shadow-1"
        style={{ background: "var(--aura-surface)" }}
      >
        <div className="text-4xl mb-2">✨</div>
        <p
          className="aura-body-md"
          style={{ color: "var(--aura-on-surface-variant)" }}
        >
          Inspirasjons-feed kommer snart med kategorier og trending wishes.
        </p>
      </div>
    </div>
  );
}
