export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext } from '@/lib/queries';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Ikke innlogget' }, { status: 401 });

    const body = await request.json() as {
      milestone_title: string;
      milestone_description: string | null;
      milestone_kind: string;
      milestone_date: string | null;
      current_text: string;
      existing_comments: Array<{ body: string; author: string; created_at: string }>;
    };

    const { milestone_title, milestone_description, milestone_kind, milestone_date, current_text, existing_comments } = body;

    const kindLabels: Record<string, string> = {
      meeting: 'Møte', deadline: 'Frist', action_item: 'Oppgave',
      past_event: 'Hendelse', document: 'Dokument', decision: 'Beslutning', note: 'Notat',
    };

    const commentsText = existing_comments.length > 0
      ? existing_comments.map(c => `[${c.author}, ${c.created_at.slice(0, 10)}]: ${c.body}`).join('\n')
      : '(Ingen tidligere kommentarer)';

    const prompt = `Du er assistent for en norsk familie som følger opp en sak om barns opplæringsrettigheter. Datteren heter Rakel (ca. 14 år). Familien bruker et digitalt journalsystem for å dokumentere hendelser, møter og oppfølging relatert til Rakels utredning og skole.

De er i gang med å skrive en kommentar til en hendelse i tidslinjen. Din oppgave er å hjelpe dem formulere en god, konkret og nyttig kommentar.

Hendelsen det gjelder:
Type: ${kindLabels[milestone_kind] ?? milestone_kind}
Tittel: ${milestone_title}${milestone_date ? `\nDato: ${milestone_date}` : ''}${milestone_description ? `\nBeskrivelse: ${milestone_description}` : ''}

Eksisterende kommentarer på denne hendelsen:
${commentsText}

Nåværende utkast fra brukeren:
${current_text.trim() || '(Ingen tekst skrevet ennå — brukeren ønsker hjelp til å starte)'}

${current_text.trim()
  ? 'Oppgave: Forbedre og ferdigstill kommentaren. Behold alle faktaopplysninger. Gjør den klar, presis og nyttig for dokumentasjonsformål.'
  : 'Oppgave: Hjelp dem å formulere en kommentar. Basert på hendelsestypen og tittelen: lag et godt utkast til oppfølgingskommentar, møtereferat, eller notater. Bruk [FYLL INN] der du mangler informasjon.'}

Kommentaren bør:
- Være kortfattet (2–5 setninger er ideelt)
- Dokumentere hva som skjedde, ble sagt, eller hva som må følges opp
- Bruke vi-/jeg-form fra foreldrenes perspektiv
- Være på norsk

Returner KUN et JSON-objekt:
{
  "improved": "Den ferdige kommentarteksten her",
  "follow_up_hints": ["Kort hint 1 om hva som bør følges opp", "Hint 2"]
}

follow_up_hints er 2–3 korte punkter om hva familien bør passe på eller følge opp etter denne hendelsen.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, error: 'AI returnerte ugyldig format. Prøv igjen.' });
    }

    const parsed = JSON.parse(jsonMatch[0]) as { improved: string; follow_up_hints: string[] };

    return NextResponse.json({
      ok: true,
      improved: parsed.improved ?? '',
      follow_up_hints: parsed.follow_up_hints ?? [],
    });
  } catch (err) {
    console.error('comment-assist error:', err);
    return NextResponse.json(
      { ok: false, error: `Serverfeil: ${err instanceof Error ? err.message : 'ukjent'}` },
      { status: 500 }
    );
  }
}
