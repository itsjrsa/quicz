"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"code" | "name">("code");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const upper = code.toUpperCase().trim();
    if (!upper) return;
    setLoading(true);
    setError("");

    const res = await fetch(`/api/sessions/by-code/${upper}`);
    if (res.ok) {
      const data = await res.json() as { status: string };
      if (data.status === "finished") {
        setError("This session has already ended.");
      } else {
        setStep("name");
      }
    } else {
      setError("Session not found. Check the code and try again.");
    }
    setLoading(false);
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setLoading(true);
    setError("");

    const codeUpper = code.toUpperCase().trim();

    // Look up session id by code
    const sessionRes = await fetch(`/api/sessions/by-code/${codeUpper}`);
    if (!sessionRes.ok) {
      setError("Session not found.");
      setLoading(false);
      return;
    }
    const sessionData = await sessionRes.json() as { id: string };

    // Check for existing participantId in localStorage
    const storedId = localStorage.getItem(`participant:${codeUpper}`);

    const joinRes = await fetch(`/api/sessions/${sessionData.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: trimmedName, participantId: storedId ?? undefined }),
    });

    if (joinRes.ok) {
      const { participantId } = await joinRes.json() as { participantId: string };
      localStorage.setItem(`participant:${codeUpper}`, participantId);
      localStorage.setItem(`name:${codeUpper}`, trimmedName);
      router.push(`/play/${codeUpper}`);
    } else {
      const err = await joinRes.json() as { error?: string };
      setError(err.error ?? "Could not join. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-8 text-center">Join Quiz</h1>

        {step === "code" ? (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-4 text-2xl font-mono text-center border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none tracking-widest uppercase"
                placeholder="XXXXXX"
                maxLength={6}
                autoFocus
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-4 bg-black text-white font-semibold text-lg rounded-xl hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Checking…" : "Continue →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <p className="text-center text-gray-500 text-sm mb-2">
              Joining session <span className="font-mono font-bold text-black">{code}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-4 text-xl border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none"
                placeholder="Display name"
                maxLength={40}
                autoFocus
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-4 bg-black text-white font-semibold text-lg rounded-xl hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Joining…" : "Join Quiz"}
            </button>
            <button
              type="button"
              onClick={() => setStep("code")}
              className="w-full py-2 text-sm text-gray-400 hover:text-black"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
