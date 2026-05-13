"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function InvitasjonerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logg til console også
    // eslint-disable-next-line no-console
    console.error("Invitasjoner-feil:", error);
  }, [error]);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">⚠️ Noe gikk galt i invitasjons-modulen</h1>
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-red-800">Feilmelding:</p>
        <pre className="text-xs whitespace-pre-wrap text-red-900 font-mono bg-white p-3 rounded border border-red-100">
          {error.message || "Ukjent feil"}
        </pre>
        {error.digest && (
          <p className="text-xs text-red-700">
            Server-ref: <code>{error.digest}</code>
          </p>
        )}
        {error.stack && (
          <details className="text-xs">
            <summary className="cursor-pointer text-red-700 hover:underline">
              Vis full stacktrace
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-[10px] text-red-800 font-mono bg-white p-3 rounded border border-red-100 max-h-80 overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700"
        >
          Prøv på nytt
        </button>
        <Link
          href="/invitasjoner"
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
        >
          Tilbake til lista
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        Kopier feilmeldingen over og send den til utvikleren, så blir det lettere å rette.
      </p>
    </div>
  );
}
