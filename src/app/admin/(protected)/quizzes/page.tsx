import Link from "next/link";
import { db } from "@/db";
import { quizzes, questions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getQuizzesWithCounts() {
  const allQuizzes = db.select().from(quizzes).orderBy(desc(quizzes.createdAt)).all();
  return allQuizzes.map((quiz) => ({
    ...quiz,
    questionCount: db.select().from(questions).where(eq(questions.quizId, quiz.id)).all().length,
  }));
}

export default async function QuizzesPage() {
  const allQuizzes = await getQuizzesWithCounts();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Quizzes</h1>
        <Link
          href="/admin/quizzes/new"
          className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800"
        >
          + New Quiz
        </Link>
      </div>

      {allQuizzes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No quizzes yet.</p>
          <p className="mt-1 text-sm">Create your first quiz to get started.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {allQuizzes.map((quiz) => (
            <li key={quiz.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
              <div>
                <Link href={`/admin/quizzes/${quiz.id}/edit`} className="font-medium hover:underline">
                  {quiz.title}
                </Link>
                <p className="text-sm text-gray-500 mt-0.5">
                  {quiz.questionCount} question{quiz.questionCount !== 1 ? "s" : ""}
                  {quiz.description ? ` · ${quiz.description}` : ""}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <Link href={`/admin/quizzes/${quiz.id}/edit`} className="text-gray-600 hover:text-black">
                  Edit
                </Link>
                <Link href={`/admin/quizzes/${quiz.id}/sessions`} className="text-gray-600 hover:text-black">
                  Sessions
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
