import * as React from "react";

const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;

/**
 * Renderer tekst med URL-er gjort om til klikkbare lenker.
 * Trygt: bruker tekstnoder, ingen dangerouslySetInnerHTML.
 */
export function Linkify({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;
  const parts: Array<string | { href: string; label: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push({ href: match[0], label: match[0] });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <React.Fragment key={i}>{p}</React.Fragment>
        ) : (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 underline hover:text-brand-800 break-all"
          >
            {p.label}
          </a>
        )
      )}
    </span>
  );
}
