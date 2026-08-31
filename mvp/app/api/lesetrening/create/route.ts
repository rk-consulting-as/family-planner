export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext } from '@/lib/queries';
import { extractTextFromImages, generateQuestionsFromText } from '@/lib/actions/school_reading';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Ikke innlogget' }, { status: 401 });

    const formData = await request.formData();
    const supabase = await createClient();

    const title     = formData.get('title') as string;
    const bookTitle = formData.get('book_title') as string | null;
    const subject   = (formData.get('subject') as string) || 'engelsk';
    const weekNum   = formData.get('week_number') ? Number(formData.get('week_number')) : null;
    const year      = formData.get('year') ? Number(formData.get('year')) : new Date().getFullYear();

    // Collect images (up to 8)
    const imageBase64s: string[] = [];
    const imageMimes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const file = formData.get(`image_${i}`) as File | null;
      if (!file || file.size === 0) continue;
      const bytes = await file.arrayBuffer();
      imageBase64s.push(Buffer.from(bytes).toString('base64'));
      imageMimes.push(file.type || 'image/jpeg');
    }

    if (imageBase64s.length === 0) {
      return NextResponse.json({ ok: false, error: 'Last opp minst ett bilde' });
    }

    // Step 1: OCR (Haiku — fast)
    const textContent = await extractTextFromImages(imageBase64s, imageMimes);
    if (!textContent || textContent.length < 50) {
      return NextResponse.json({ ok: false, error: 'Klarte ikke å lese tekst fra bildene. Prøv klarere bilder.' });
    }

    // Step 2: Generate questions (Sonnet — text only)
    const questions = await generateQuestionsFromText(textContent);
    if (!questions || questions.length === 0) {
      return NextResponse.json({ ok: false, error: 'AI klarte ikke å lage spørsmål. Prøv igjen.' });
    }

    // Store session
    const { data: session, error: sessErr } = await supabase
      .from('school_reading_sessions')
      .insert({
        group_id:     ctx.group.id,
        created_by:   ctx.user.id,
        subject,
        title,
        book_title:   bookTitle || null,
        text_content: textContent,
        week_number:  weekNum,
        year,
      })
      .select('id')
      .single();

    if (sessErr || !session) {
      console.error('Session insert error:', sessErr);
      return NextResponse.json({ ok: false, error: 'Feil ved lagring av økt' });
    }

    // Store questions
    const questionRows = questions.map(q => ({
      session_id:      session.id,
      question_number: q.question_number,
      level:           q.level,
      question_text:   q.question_text,
      answer_options:  q.answer_options ?? null,
      correct_answer:  q.correct_answer ?? null,
    }));

    const { error: qErr } = await supabase.from('school_reading_questions').insert(questionRows);
    if (qErr) {
      console.error('Questions insert error:', qErr);
      await supabase.from('school_reading_sessions').delete().eq('id', session.id);
      return NextResponse.json({ ok: false, error: `Feil ved lagring av spørsmål: ${qErr.message}` });
    }

    revalidatePath('/skole/lesetrening');
    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (err) {
    console.error('create lesetrening route error:', err);
    return NextResponse.json({ ok: false, error: `Serverfeil: ${err instanceof Error ? err.message : 'ukjent feil'}` }, { status: 500 });
  }
}
