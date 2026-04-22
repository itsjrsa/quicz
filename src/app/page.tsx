import Link from "next/link";
import { buttonClass, ThemeToggle } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex flex-col bg-surface">
      <div
        aria-hidden
        className="quicz-grid-bg absolute inset-0 opacity-70 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      />

      <header className="relative z-10 flex justify-end px-6 pt-6">
        <Link
          href="/admin"
          className="text-sm font-bold text-ink hover:text-ink-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-2 py-1"
        >
          Admin
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-24">
        <div className="text-center max-w-md w-full quicz-fade-in">
          <h1 className="text-7xl font-bold tracking-tight leading-none">
            Quicz
          </h1>
          <p className="mt-4 text-xs font-mono uppercase tracking-[0.35em] text-ink-subtle">
            Quick <span className="text-ink-faint">·</span> Quiz
          </p>
          <div className="mt-10">
            <Link
              href="/join"
              className={buttonClass("primary", "lg", "w-full")}
            >
              Join a Quiz
            </Link>
          </div>

          <p className="mt-6 text-xs text-ink-faint">
            Have a session code? Enter it above after tapping Join.
          </p>
        </div>
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-4 px-6 pb-6 text-center text-xs text-ink-faint">
        <span>Quicz · One quiz, one room, one code.</span>
        <ThemeToggle />
      </footer>
    </main>
  );
}
