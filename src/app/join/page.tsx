"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}

function JoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"code" | "name">("code");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const autoTriedRef = useRef(false);

  const validateCode = useCallback(async (rawCode: string): Promise<"ok" | "finished" | "notfound"> => {
    const res = await fetch(`/api/sessions/by-code/${rawCode}`);
    if (!res.ok) return "notfound";
    const data = (await res.json()) as { status: string };
    return data.status === "finished" ? "finished" : "ok";
  }, []);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const upper = code.toUpperCase().trim();
    if (upper.length !== 6) return;
    setLoading(true);
    setError("");

    const result = await validateCode(upper);
    if (result === "ok") {
      // If we already have a name stored for this code, skip straight to join
      const storedName = localStorage.getItem(`name:${upper}`);
      const storedId = localStorage.getItem(`participant:${upper}`);
      if (storedName && storedId) {
        setName(storedName);
        await joinWithName(upper, storedName);
        return;
      }
      setStep("name");
    } else if (result === "finished") {
      setError("This session has already ended.");
    } else {
      setError("Session not found. Check the code and try again.");
    }
    setLoading(false);
  }

  // Accept ?code=XXXXXX from a QR code — the auto-advance effect takes it from there
  useEffect(() => {
    if (autoTriedRef.current) return;
    const param = searchParams?.get("code");
    if (!param) return;
    const upper = param.toUpperCase().slice(0, 6);
    if (upper.length !== 6) return;
    autoTriedRef.current = true;
    setCode(upper);
  }, [searchParams]);

  // Auto-advance once the user types 6 characters
  useEffect(() => {
    if (step !== "code") return;
    if (code.length !== 6 || loading) return;
    const upper = code.toUpperCase();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const result = await validateCode(upper);
      if (cancelled) return;
      if (result === "ok") {
        const storedName = localStorage.getItem(`name:${upper}`);
        const storedId = localStorage.getItem(`participant:${upper}`);
        if (storedName && storedId) {
          setName(storedName);
          await joinWithName(upper, storedName);
          return;
        }
        setStep("name");
      } else if (result === "finished") {
        setError("This session has already ended.");
      } else {
        setError("Session not found. Check the code and try again.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  async function joinWithName(codeUpper: string, displayName: string) {
    const sessionRes = await fetch(`/api/sessions/by-code/${codeUpper}`);
    if (!sessionRes.ok) {
      setError("Session not found.");
      setLoading(false);
      return;
    }
    const sessionData = (await sessionRes.json()) as { id: string };
    const storedId = localStorage.getItem(`participant:${codeUpper}`);
    const joinRes = await fetch(`/api/sessions/${sessionData.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, participantId: storedId ?? undefined }),
    });
    if (joinRes.ok) {
      const { participantId } = (await joinRes.json()) as { participantId: string };
      localStorage.setItem(`participant:${codeUpper}`, participantId);
      localStorage.setItem(`name:${codeUpper}`, displayName);
      router.push(`/play/${codeUpper}`);
    } else {
      const err = (await joinRes.json()) as { error?: string };
      setError(err.error ?? "Could not join. Try again.");
      setLoading(false);
    }
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setLoading(true);
    setError("");
    await joinWithName(code.toUpperCase().trim(), trimmedName);
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
              onClick={() => {
                setCode("");
                setStep("code");
                setError("");
              }}
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
