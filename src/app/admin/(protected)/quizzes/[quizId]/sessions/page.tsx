import { db } from "@/db";
import { liveSessions, quizzes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

type Params = { params: Promise<{ quizId: string }> };

export default async function QuizSessionsPage({ params }: Params) {
  const { quizId } = await params;

  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) notFound();

  const sessions = db
    .select()
    .from(liveSessions)
    .where(eq(liveSessions.quizId, quizId))
    .orderBy(desc(liveSessions.createdAt))
    .all();

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link href="/admin/quizzes" className="text-sm text-gray-500 hover:text-black">
          ← Quizzes
        </Link>
        <h1 className="text-3xl font-bold mt-2">{quiz.title} — Sessions</h1>
      </div>

      {sessions.length === 0 ? (
        <p className="text-gray-400">No sessions yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
              <div>
                <span className="font-mono font-bold text-lg">{s.code}</span>
                <p className="text-sm text-gray-500 mt-0.5">
                  {s.status === "active" ? (
                    <span className="text-green-600 font-medium">Active</span>
                  ) : (
                    <span className="text-gray-400">Finished</span>
                  )}
                  {" · "}
                  {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                {s.status === "active" && (
                  <Link href={`/admin/sessions/${s.id}/present`} className="text-black font-medium hover:underline">
                    Present
                  </Link>
                )}
                <Link href={`/admin/sessions/${s.id}/results`} className="text-gray-600 hover:text-black">
                  Results
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
