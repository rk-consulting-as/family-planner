import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/queries";
import { notFound } from "next/navigation";
import QuestionClient from "./QuestionClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LesetreningSessionPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const sb = await createClient();

  const [{ data: session }, { data: questions }, { data: answers }] = await Promise.all([
    sb.from("school_reading_sessions")
      .select("id, title, text_content, subject, book_title, week_number, year")
      .eq("id", id)
      .eq("group_id", ctx.group.id)
      .single(),

    sb.from("school_reading_questions")
      .select("id, question_number, level, question_text, answer_options, correct_answer")
      .eq("session_id", id)
      .order("question_number"),

    sb.from("school_reading_answers")
      .select("question_id, answer_text, selected_option, is_correct")
      .eq("session_id", id)
      .eq("profile_id", ctx.user.id),
  ]);

  if (!session) notFound();

  return (
    <QuestionClient
      sessionId={session.id}
      sessionTitle={session.title}
      textContent={session.text_content ?? ""}
      questions={(questions ?? []) as any}
      existingAnswers={(answers ?? []) as any}
    />
  );
}
