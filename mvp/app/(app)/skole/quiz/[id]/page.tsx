import { notFound, redirect } from "next/navigation";
import { getActiveContext } from "@/lib/queries";
import { getQuiz, getQuizQuestions, getQuizSessionsForQuiz } from "@/lib/actions/quiz";
import QuizClient from "./QuizClient";

export default async function QuizDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  const [quiz, questions, sessions] = await Promise.all([
    getQuiz(params.id),
    getQuizQuestions(params.id),
    getQuizSessionsForQuiz(params.id),
  ]);

  if (!quiz || questions.length === 0) notFound();

  const myBest = sessions
    .filter(s => s.profile_id === ctx.user.id && s.completed_at && s.total > 0)
    .sort((a, b) => (b.score / b.total) - (a.score / a.total))[0] ?? null;

  return (
    <QuizClient
      quiz={quiz}
      questions={questions}
      currentUserId={ctx.user.id}
      myBestSession={myBest ? { score: myBest.score, total: myBest.total } : null}
    />
  );
}
