export default function AktivitetPage() {
  return (
    <div className="py-3 space-y-4">
      <h1 className="aura-headline-lg">Aktivitet</h1>
      <p
        className="aura-body-md"
        style={{ color: "var(--aura-on-surface-variant)" }}
      >
        Dine siste oppdateringer fra venner.
      </p>
      <div
        className="rounded-3xl p-6 text-center aura-shadow-1"
        style={{ background: "var(--aura-surface)" }}
      >
        <div className="text-4xl mb-2">🔔</div>
        <p
          className="aura-body-md"
          style={{ color: "var(--aura-on-surface-variant)" }}
        >
          Ingen aktivitet ennå. Legg til venner for å se det de ønsker seg!
        </p>
      </div>
    </div>
  );
}
