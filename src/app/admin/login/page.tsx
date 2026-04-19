"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, Input } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin/quizzes");
    } else {
      setError("Invalid password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm quicz-fade-in">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-block text-3xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
          >
            Quicz
          </Link>
          <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.35em] text-ink-faint">
            Admin
          </p>
        </div>
        <div className="p-8 bg-surface border border-line rounded-xl shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-ink mb-2"
              >
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                invalid={Boolean(error)}
              />
            </div>
            {error && (
              <p className="text-sm text-danger" aria-live="polite">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className={buttonClass("primary", "md", "w-full")}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
