// Server-side Anthropic-klient. Krever ANTHROPIC_API_KEY i env.
// Aldri eksponer denne fra klient-kode.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5"; // raskt + billig — passer for ekstraksjon

export type ClaudeBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeBlock[];
};

export async function callClaude({
  system,
  messages,
  max_tokens = 4096,
}: {
  system: string;
  messages: ClaudeMessage[];
  max_tokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY mangler i env. Legg den til i .env.local og Vercel."
    );
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API feil ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("\n");
  return text;
}

// Sikker JSON-parse fra Claude (kan ha kodebloker rundt)
export function safeParseJson<T = unknown>(text: string): T | null {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
