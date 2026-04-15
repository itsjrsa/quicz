import { notFound } from "next/navigation";
import { db } from "@/db";
import { quizzes, questions, choices } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import QuizEditor from "@/components/admin/QuizEditor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ quizId: string }> };

export default async function EditQuizPage({ params }: Params) {
  const { quizId } = await params;

  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) notFound();

  const quizQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(questions.order)
    .all();

  const questionIds = quizQuestions.map((q) => q.id);
  const allChoices =
    questionIds.length > 0
      ? db.select().from(choices).where(inArray(choices.questionId, questionIds)).orderBy(choices.order).all()
      : [];

  const initialData = {
    ...quiz,
    questions: quizQuestions.map((q) => ({
      ...q,
      choices: allChoices.filter((c) => c.questionId === q.id),
    })),
  };

  return <QuizEditor initialData={initialData} quizId={quizId} />;
}
