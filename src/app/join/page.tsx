"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buttonClass, Input, ThemeToggle } from "@/components/ui";

const CODE_LENGTH = 6;

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

  const validateCode = useCallback(
    async (rawCode: string): Promise<"ok" | "finished" | "notfound"> => {
      const res = await fetch(`/api/sessions/by-code/${rawCode}`);
      if (!res.ok) return "notfound";
      const data = (await res.json()) as { status: string };
      return data.status === "finished" ? "finished" : "ok";
    },
    [],
  );

  useEffect(() => {
    if (autoTriedRef.current) return;
    const param = searchParams?.get("code");
    if (!param) return;
    const upper = param.toUpperCase().slice(0, CODE_LENGTH);
    if (upper.length !== CODE_LENGTH) return;
    autoTriedRef.current = true;
    setCode(upper);
  }, [searchParams]);

  useEffect(() => {
    if (step !== "code") return;
    if (code.length !== CODE_LENGTH || loading) return;
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
      // Name collision: drop the stale stored identity and put the user on
      // the name step so they can pick a different name.
      if (joinRes.status === 409) {
        localStorage.removeItem(`participant:${codeUpper}`);
        setStep("name");
      }
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
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 bg-surface">
      <div className="absolute top-4 right-4">
        <ThemeToggle showLabel={false} />
      </div>
      <div className="w-full max-w-sm quicz-fade-in">
        <div className="text-center mb-10">
          <Link
            href="/"
            className="inline-block text-3xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
          >
            Quicz
          </Link>
          <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.35em] text-ink-faint">
            Quick <span className="text-ink-faint/70">·</span> Quiz
          </p>
        </div>

        {step === "code" ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink mb-3 text-center">
                Session code
              </label>
              <CodeBoxes
                value={code}
                onChange={(v) => setCode(v)}
                disabled={loading}
                invalid={Boolean(error)}
              />
            </div>
            <p
              className={`text-sm text-center min-h-[1.25rem] ${
                error ? "text-danger" : "text-ink-muted"
              }`}
              aria-live="polite"
            >
              {error ? error : loading ? "Checking…" : " "}
            </p>
            {error && (
              <div className="text-center">
                <Link
                  href="/"
                  className="text-sm text-ink-muted hover:text-ink underline underline-offset-4"
                >
                  ← Back to home
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <p className="text-center text-sm text-ink-muted mb-2">
              Joining session <span className="font-mono font-bold text-ink">{code}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Your name</label>
              <Input
                fieldSize="lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
                maxLength={40}
                autoFocus
                autoComplete="off"
                invalid={Boolean(error)}
              />
            </div>
            {error && (
              <p className="text-sm text-danger text-center" aria-live="polite">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className={buttonClass("primary", "lg", "w-full")}
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
              className="w-full py-2 text-sm text-ink-faint hover:text-ink"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function CodeBoxes({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const chars = value.padEnd(CODE_LENGTH, " ").slice(0, CODE_LENGTH).split("");

  useEffect(() => {
    const firstEmpty = Math.min(value.length, CODE_LENGTH - 1);
    const el = inputsRef.current[firstEmpty];
    if (el && document.activeElement !== el && !disabled) {
      // Don't steal focus if another element has it purposely; only auto-focus on mount
      if (document.activeElement === document.body) el.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function writeAt(index: number, char: string) {
    const filtered = char.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!filtered) return;
    const next = (value + "").padEnd(CODE_LENGTH, " ").split("");
    next[index] = filtered[0];
    // If a longer string was typed/pasted, spill forward
    let cursor = index + 1;
    for (let i = 1; i < filtered.length && cursor < CODE_LENGTH; i++) {
      next[cursor] = filtered[i];
      cursor++;
    }
    const joined = next.join("").replace(/\s/g, "");
    onChange(joined);
    const focusTarget = Math.min(cursor, CODE_LENGTH - 1);
    requestAnimationFrame(() => inputsRef.current[focusTarget]?.focus());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = value.split("");
      if (next[index]) {
        next[index] = "";
      } else if (index > 0) {
        next[index - 1] = "";
        requestAnimationFrame(() => inputsRef.current[index - 1]?.focus());
      }
      onChange(next.join("").replace(/\s/g, ""));
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    writeAt(index, text);
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Six-character session code">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={1}
          value={c.trim() ? c : ""}
          disabled={disabled}
          aria-label={`Character ${i + 1} of ${CODE_LENGTH}`}
          onChange={(e) => writeAt(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={(e) => handlePaste(e, i)}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus={i === 0}
          className={[
            "w-12 h-14 text-center text-2xl font-mono font-semibold uppercase",
            "bg-surface rounded-lg border transition-colors",
            invalid ? "border-danger" : "border-line focus-visible:border-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/10",
            "disabled:bg-surface-muted disabled:text-ink-faint",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
