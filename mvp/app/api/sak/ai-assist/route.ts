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
      field: 'description' | 'outcome' | 'violation_notes' | 'follow_up_notes';
      current_text: string;
      context: {
        title: string;
        event_date: string;
        institution: string;
        event_type: string;
        attendees?: string;
        responsible_party?: string;
      };
      history: Array<{
        event_date: string;
        event_type: string;
        institution: string;
        title: string;
        description?: string;
        outcome?: string;
        follow_up_notes?: string;
        is_rights_violation?: boolean;
      }>;
    };

    const { field, current_text, context, history } = body;

    // Build a brief summary of recent history (last 12 events, newest first)
    const historyText = history.slice(0, 12).map(e =>
      `- ${e.event_date} | ${e.institution} | ${e.event_type}: ${e.title}${e.description ? ` — ${e.description.slice(0, 120)}` : ''}${e.outcome ? ` | Resultat: ${e.outcome.slice(0, 80)}` : ''}${e.is_rights_violation ? ' [RETTIGHETSBR.]' : ''}`
    ).join('\n');

    const fieldLabels: Record<string, string> = {
      description:     'Utfyllende beskrivelse',
      outcome:         'Resultat / vedtak',
      violation_notes: 'Brudd-notat (rettighetsbrudd)',
      follow_up_notes: 'Oppfølgingspunkter',
    };

    const prompt = `Du er juridisk dokumentasjonsassistent for en norsk familie i en pågående sak om barns opplæringsrettigheter. Familien har en datter som heter Rakel (ca. 14 år, 9. trinn). Saken dreier seg om manglende spesialundervisning, skolemiljø og utredning over flere år, med involvering av BUP, PPT, HABU, skole og NAV.

Familien er i gang med å registrere en hendelse i journalsystemet sitt. Din oppgave er å hjelpe dem å formulere teksten i feltet «${fieldLabels[field] ?? field}» på en måte som:
- Er presis, faktabasert og juridisk brukbar
- Dokumenterer hva som faktisk skjedde
- Er skrevet i jeg-/vi-form fra foreldrenes perspektiv
- Er på norsk, klar og profesjonell
- Maks 4–6 setninger (med mindre innholdet krever mer)

Kontekst for denne hendelsen:
Dato: ${context.event_date}
Type: ${context.event_type}
Instans: ${context.institution}
Tittel: ${context.title}${context.attendees ? `\nTilstede: ${context.attendees}` : ''}${context.responsible_party ? `\nAnsvarlig: ${context.responsible_party}` : ''}

Sakshistorikk (nyeste hendelser):
${historyText || '(Ingen tidligere hendelser registrert)'}

Nåværende tekst i feltet (fra brukeren):
${current_text.trim() || '(Tomt — brukeren ønsker hjelp til å starte)'}

${current_text.trim()
  ? 'Oppgave: Forbedre teksten. Behold alle faktaopplysninger, men gjør formuleringen mer presis, komplett og juridisk nyttig. Ikke legg til spekulasjoner eller ukjente fakta.'
  : 'Oppgave: Lag et utkast basert på tittelen, typen hendelse og instansen. Hold deg til det som er kjent fra konteksten. Bruk [FYLL INN]-markering der brukeren selv må legge til spesifikke detaljer.'
}

${field === 'follow_up_notes' ? '\nHusk: Oppfølgingsteksten skal beskrive konkret hva som MÅ gjøres, av hvem og innen hvilken frist — ikke bare hva som skjedde.' : ''}
${field === 'violation_notes' ? '\nHusk: Brudd-notatet skal konkret beskrive HVILKEN rettighet som ble brutt, HVILKEN paragraf, og hva konsekvensen var for Rakel.' : ''}

Returner KUN et JSON-objekt slik:
{
  "improved": "Den forbedrede teksten her",
  "follow_up_suggestions": ["Punkt 1 som bør følges opp", "Punkt 2"]
}

follow_up_suggestions er en liste med 2–4 korte, konkrete oppfølgingspunkter som familien bør huske på etter denne hendelsen. Disse er alltid relevante uavhengig av felt.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, error: 'AI returnerte ugyldig format. Prøv igjen.' });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      improved: string;
      follow_up_suggestions: string[];
    };

    return NextResponse.json({
      ok: true,
      improved: parsed.improved ?? '',
      follow_up_suggestions: parsed.follow_up_suggestions ?? [],
    });
  } catch (err) {
    console.error('sak ai-assist error:', err);
    return NextResponse.json(
      { ok: false, error: `Serverfeil: ${err instanceof Error ? err.message : 'ukjent'}` },
      { status: 500 }
    );
  }
}
