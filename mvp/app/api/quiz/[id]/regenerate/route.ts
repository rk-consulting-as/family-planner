export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext } from '@/lib/queries';
import { getQuiz } from '@/lib/actions/quiz';
import Anthropic from '@anthropic-ai/sdk';
import { revalidatePath } from 'next/cache';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LEVEL_INSTRUCTIONS: Record<string, Record<string, string>> = {
  norsk: {
    lett:      'Enkle og grunnleggende spørsmål. Enkelt språk.',
    middels:   'Krever forståelse av sammenhenger, ikke bare fakta.',
    vanskelig: 'Dyp forståelse, analyse og vurdering. Plausible distraktorer.',
  },
  engelsk: {
    lett:      'Simple and factual questions. Clear, straightforward language.',
    middels:   'Require understanding of context, not just memorised facts.',
    vanskelig: 'Challenge deeper understanding, analysis or evaluation. Plausible distractors.',
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getActiveContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Ikke innlogget' }, { status: 401 });

    const { language } = (await request.json()) as { language: 'norsk' | 'engelsk' };
    if (!language) return NextResponse.json({ ok: false, error: 'Mangler språk' }, { status: 400 });

    const quiz = await getQuiz(params.id);
    if (!quiz) return NextResponse.json({ ok: false, error: 'Quiz ikke funnet' }, { status: 404 });

    const lvlText = (LEVEL_INSTRUCTIONS[language] ?? LEVEL_INSTRUCTIONS.norsk)[quiz.level] ?? '';
    const isEn = language === 'engelsk';

    const prompt = isEn
      ? `You are a teacher creating a quiz for students.

Subject: ${quiz.subject}
Topic: ${quiz.topic}
Difficulty: ${quiz.level} — ${lvlText}
Number of questions: ${quiz.question_count}

Create ${quiz.question_count} multiple-choice questions IN ENGLISH. Each question must have exactly 4 answer options, only one correct.

Return ONLY valid JSON:
{
  "questions": [
    {
      "question_text": "Question?",
      "options": [
        { "text": "A", "is_correct": false },
        { "text": "B", "is_correct": true },
        { "text": "C", "is_correct": false },
        { "text": "D", "is_correct": false }
      ],
      "explanation": "Short explanation (1–2 sentences)."
    }
  ]
}

All questions, answers and explanations must be in English. Do not use "All/None of the above".`
      : `Du er en lærer som lager en quiz for norske skoleelever.

Fag: ${quiz.subject}
Emne/tema: ${quiz.topic}
Nivå: ${quiz.level} — ${lvlText}
Antall spørsmål: ${quiz.question_count}

Lag ${quiz.question_count} flervalgsspørsmål PÅ NORSK. Hvert spørsmål skal ha nøyaktig 4 svaralternativer, kun ett riktig.

Returner KUN gyldig JSON:
{
  "questions": [
    {
      "question_text": "Spørsmål?",
      "options": [
        { "text": "A", "is_correct": false },
        { "text": "B", "is_correct": true },
        { "text": "C", "is_correct": false },
        { "text": "D", "is_correct": false }
      ],
      "explanation": "Kort forklaring (1–2 setninger)."
    }
  ]
}

Alle spørsmål og svar PÅ NORSK. Ikke bruk "Alle/ingen av de ovennevnte".`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ ok: false, error: 'AI returnerte ugyldig format.' });

    const parsed = JSON.parse(jsonMatch[0]) as {
      questions: Array<{ question_text: string; options: Array<{ text: string; is_correct: boolean }>; explanation: string }>;
    };
    if (!parsed.questions?.length) return NextResponse.json({ ok: false, error: 'Ingen spørsmål generert.' });

    const supabase = await createClient();

    // Delete old questions, update quiz language, insert new questions
    await supabase.from('quiz_questions').delete().eq('quiz_id', quiz.id);
    await supabase.from('quizzes').update({ language, question_count: parsed.questions.length }).eq('id', quiz.id);

    const rows = parsed.questions.map((q, i) => ({
      quiz_id: quiz.id,
      question_order: i + 1,
      question_text: q.question_text,
      options: q.options,
      explanation: q.explanation ?? null,
    }));
    await supabase.from('quiz_questions').insert(rows);

    revalidatePath('/skole/quiz');
    revalidatePath(`/skole/quiz/${quiz.id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('regenerate error:', err);
    return NextResponse.json({ ok: false, error: `Serverfeil: ${err instanceof Error ? err.message : 'ukjent'}` }, { status: 500 });
  }
}
