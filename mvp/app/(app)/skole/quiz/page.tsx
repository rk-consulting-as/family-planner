import { getActiveContext } from "@/lib/queries";
import { getQuizzes, getQuizSessionsForQuiz } from "@/lib/actions/quiz";
import { redirect } from "next/navigation";
import QuizListClient from "./QuizListClient";

export default async function QuizPage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  const quizzes = await getQuizzes();

  // Fetch sessions for all quizzes so list can show completion status
  const sessionMap: Record<string, { score: number; total: number; completed_at: string | null }[]> = {};
  await Promise.all(
    quizzes.map(async (q) => {
      const sessions = await getQuizSessionsForQuiz(q.id);
      sessionMap[q.id] = sessions.map(s => ({
        score: s.score,
        total: s.total,
        completed_at: s.completed_at,
      }));
    })
  );

  return (
    <QuizListClient
      quizzes={quizzes}
      sessionMap={sessionMap}
      currentUserId={ctx.user.id}
    />
  );
}
