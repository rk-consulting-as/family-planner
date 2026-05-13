// Server-side OpenAI image-klient (DALL-E 3).
// Valgfri — bare brukt av invitasjons-modulen for AI-genererte bilder.
// Hvis OPENAI_API_KEY ikke er satt, returnerer feilmelding som UI håndterer.

const API_URL = "https://api.openai.com/v1/images/generations";

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

export async function generateImage({
  prompt,
  size = "1024x1024",
  quality = "standard",
}: {
  prompt: string;
  size?: ImageSize;
  quality?: "standard" | "hd";
}): Promise<{ url: string; revised_prompt?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY mangler. AI-tegnet bilde krever en OpenAI-nøkkel i env. " +
        "Legg den til i Vercel-prosjektet eller bruk mal-baserte invitasjoner i stedet."
    );
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality,
      response_format: "url",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI image-feil ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    data: Array<{ url: string; revised_prompt?: string }>;
  };
  if (!data.data || data.data.length === 0) {
    throw new Error("OpenAI returnerte ingen bilder");
  }
  return data.data[0];
}

// Konverter en URL fra OpenAI (midlertidig, ~1 time) til base64 så vi kan
// lagre i Supabase Storage.
export async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klarte ikke hente bildet fra OpenAI: ${res.status}`);
  const mime = res.headers.get("content-type") || "image/png";
  const buf = await res.arrayBuffer();
  const base64 = Buffer.from(buf).toString("base64");
  return { base64, mime };
}
