export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext } from '@/lib/queries';
import Anthropic from '@anthropic-ai/sdk';
import { revalidatePath } from 'next/cache';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LEVEL_INSTRUCTIONS: Record<string, Record<string, string>> = {
  norsk: {
    lett:      'Spørsmålene skal være enkle og grunnleggende. Bruk enkelt språk. Svarene skal være tydelige. Passer for elever som akkurat har lært emnet.',
    middels:   'Spørsmålene skal kreve at eleven forstår sammenhengen, ikke bare husker fakta. Moderat vanskelighetsgrad.',
    vanskelig: 'Spørsmålene skal utfordre og kreve inngående forståelse, analyse eller vurdering. Distraktorer i flervalg skal være plausible.',
  },
  engelsk: {
    lett:      'Questions should be simple and factual. Use clear, straightforward language suitable for students who have just learned the topic.',
    middels:   'Questions should require understanding of context and connections, not just memorised facts. Moderate difficulty.',
    vanskelig: 'Questions should challenge deeper understanding, analysis or evaluation. Distractors (wrong answers) should be plausible.',
  },
};

function buildPrompt(subject: string, topic: string, level: string, questionCount: number, language: string): string {
  const lang = language === 'engelsk' ? 'engelsk' : 'norsk';
  const lvlInstructions = (LEVEL_INSTRUCTIONS[lang] ?? LEVEL_INSTRUCTIONS.norsk)[level] ?? '';

  if (lang === 'engelsk') {
    return `You are a teacher creating a quiz for students.

Subject: ${subject}
Topic: ${topic}
Difficulty: ${level} — ${lvlInstructions}
Number of questions: ${questionCount}

Create ${questionCount} multiple-choice questions IN ENGLISH. Each question must have exactly 4 answer options, with only one correct answer.

Return ONLY valid JSON in this exact format (no explanation outside the JSON):
{
  "questions": [
    {
      "question_text": "Question text here?",
      "options": [
        { "text": "Option A", "is_correct": false },
        { "text": "Option B", "is_correct": true },
        { "text": "Option C", "is_correct": false },
        { "text": "Option D", "is_correct": false }
      ],
      "explanation": "Short explanation of why the answer is correct (1–2 sentences)."
    }
  ]
}

Requirements:
- ALL questions, answers and explanations must be in English
- Exactly ONE correct answer per question
- Wrong answers (distractors) should be realistic and plausible
- The explanation should help the student learn something
- Do not use "All/None of the above" as an option`;
  }

  return `Du er en lærer som lager en quiz for norske skoleelever.

Fag: ${subject}
Emne/tema: ${topic}
Nivå: ${level} — ${lvlInstructions}
Antall spørsmål: ${questionCount}

Lag ${questionCount} flervalgsspørsmål PÅ NORSK. Hvert spørsmål skal ha nøyaktig 4 svaralternativer, kun ett riktig.

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
- Spørsmål og svar PÅ NORSK
- Kun ETT riktig svaralternativ per spørsmål
- Distraktorene (gale svar) skal være realistiske og plausible
- Forklaringen skal hjelpe eleven lære noe nytt
- Ikke bruk "Alle/ingen av de ovennevnte" som alternativ`;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Ikke innlogget' }, { status: 401 });

    const body = await request.json();
    const { subject, topic, level, questionCount, language = 'norsk' } = body as {
      subject: string;
      topic: string;
      level: 'lett' | 'middels' | 'vanskelig';
      questionCount: number;
      language?: 'norsk' | 'engelsk';
    };

    if (!subject || !topic || !level || !questionCount) {
      return NextResponse.json({ ok: false, error: 'Manglende felter' }, { status: 400 });
    }

    const prompt = buildPrompt(subject, topic, level, questionCount, language);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
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

    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .insert({
        group_id: ctx.group.id,
        subject,
        topic,
        level,
        language,
        question_count: parsed.questions.length,
        created_by: ctx.user.id,
      })
      .select('id')
      .single();

    if (quizErr || !quiz) {
      return NextResponse.json({ ok: false, error: 'Feil ved lagring av quiz' });
    }

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
