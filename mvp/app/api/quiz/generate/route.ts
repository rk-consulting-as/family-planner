export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext } from '@/lib/queries';
import Anthropic from '@anthropic-ai/sdk';
import { revalidatePath } from 'next/cache';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LEVEL_INSTRUCTIONS: Record<string, string> = {
  lett: 'Spørsmålene skal være enkle og grunnleggende. Bruk enkelt språk. Svarene skal være tydelige. Passer for elever som akkurat har lært emnet.',
  middels: 'Spørsmålene skal kreve at eleven forstår sammenhengen, ikke bare husker fakta. Moderat vanskelighetsgrad.',
  vanskelig: 'Spørsmålene skal utfordre og kreve inngående forståelse, analyse eller vurdering. Distraktorer i flervalg skal være plausible.',
};

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Ikke innlogget' }, { status: 401 });

    const body = await request.json();
    const { subject, topic, level, questionCount } = body as {
      subject: string;
      topic: string;
      level: 'lett' | 'middels' | 'vanskelig';
      questionCount: number;
    };

    if (!subject || !topic || !level || !questionCount) {
      return NextResponse.json({ ok: false, error: 'Manglende felter' }, { status: 400 });
    }

    const levelText = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.middels;

    const prompt = `Du er en lærer som lager en quiz for norske skoleelever.

Fag: ${subject}
Emne/tema: ${topic}
Nivå: ${level} — ${levelText}
Antall spørsmål: ${questionCount}

Lag ${questionCount} flervalgsspørsmål på norsk. Hvert spørsmål skal ha nøyaktig 4 svaralternativer, kun ett riktig.

Returner KUN gyldig JSON i dette formatet (ingen forklaring utenfor JSON):
{
  "questions": [
    {
      "question_text": "Spørsmålstekst her?",
      "options": [
        { "text": "Alternativ A", "is_correct": false },
        { "text": "Alternativ B", "is_correct": true },
        { "text": "Alternativ C", "is_correct": false },
        { "text": "Alternativ D", "is_correct": false }
      ],
      "explanation": "Kort forklaring på hvorfor svaret er riktig (1–2 setninger)."
    }
  ]
}

Krav:
- Spørsmål og svar på norsk
- Kun ETT riktig svaralternativ per spørsmål
- Distraktorene (gale svar) skal være realistiske og plausible
- Forklaringen skal hjelpe eleven lære noe nytt
- Ikke bruk "Alle/ingen av de ovennevnte" som alternativ`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, error: 'AI returnerte ugyldig format. Prøv igjen.' });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      questions: Array<{
        question_text: string;
        options: Array<{ text: string; is_correct: boolean }>;
        explanation: string;
      }>;
    };

    if (!parsed.questions || parsed.questions.length === 0) {
      return NextResponse.json({ ok: false, error: 'Ingen spørsmål generert. Prøv igjen.' });
    }

    const supabase = await createClient();

    // Insert quiz
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .insert({
        group_id: ctx.group.id,
        subject,
        topic,
        level,
        question_count: parsed.questions.length,
        created_by: ctx.user.id,
      })
      .select('id')
      .single();

    if (quizErr || !quiz) {
      return NextResponse.json({ ok: false, error: 'Feil ved lagring av quiz' });
    }

    // Insert questions
    const questionRows = parsed.questions.map((q, i) => ({
      quiz_id: quiz.id,
      question_order: i + 1,
      question_text: q.question_text,
      options: q.options,
      explanation: q.explanation ?? null,
    }));

    const { error: qErr } = await supabase.from('quiz_questions').insert(questionRows);
    if (qErr) {
      await supabase.from('quizzes').update({ deleted_at: new Date().toISOString() }).eq('id', quiz.id);
      return NextResponse.json({ ok: false, error: `Feil ved lagring av spørsmål: ${qErr.message}` });
    }

    revalidatePath('/skole/quiz');
    return NextResponse.json({ ok: true, quizId: quiz.id });
  } catch (err) {
    console.error('quiz generate error:', err);
    return NextResponse.json(
      { ok: false, error: `Serverfeil: ${err instanceof Error ? err.message : 'ukjent feil'}` },
      { status: 500 }
    );
  }
}
