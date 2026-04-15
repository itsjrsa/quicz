import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-bold tracking-tight mb-4">Quicz</h1>
        <p className="text-gray-500 text-lg mb-10">
          Live quizzes for training sessions and workshops.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/join"
            className="w-full py-4 bg-black text-white font-semibold text-lg rounded-xl hover:bg-gray-800"
          >
            Join a Quiz
          </Link>
          <Link
            href="/admin"
            className="w-full py-4 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50"
          >
            Admin
          </Link>
        </div>
      </div>
    </main>
  );
}
