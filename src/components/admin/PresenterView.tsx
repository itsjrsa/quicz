"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSocket } from "@/lib/socket/client";
import type { AdminStatePayload, ScoreboardPayload } from "@/lib/socket/events";

interface Props {
  sessionId: string;
}

export default function PresenterView({ sessionId }: Props) {
  const { socket, connected } = useSocket();
  const [state, setState] = useState<AdminStatePayload | null>(null);
  const [sessionCode, setSessionCode] = useState<string>("");
  const [scoreboard, setScoreboard] = useState<ScoreboardPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string>("");

  useEffect(() => {
    if (!sessionCode) return;
    setJoinUrl(`${window.location.origin}/join?code=${sessionCode}`);
  }, [sessionCode]);

  async function copyCode() {
    if (!sessionCode) return;
    try {
      await navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  useEffect(() => {
    if (!socket) return;

    socket.emit("admin:join", { sessionId });

    const onAdminState = (payload: AdminStatePayload) => {
      setState(payload);
    };

    const onResponseCount = (payload: { questionId: string; count: number; total: number }) => {
      setState((prev) =>
        prev ? { ...prev, responseCount: payload.count, totalParticipants: payload.total } : prev
      );
    };

    const onParticipantJoined = () => {
      setState((prev) => (prev ? { ...prev, participantCount: prev.participantCount + 1 } : prev));
    };

    const onScoreboard = (payload: ScoreboardPayload) => {
      setScoreboard(payload);
    };

    socket.on("admin:state", onAdminState);
    socket.on("admin:response-count", onResponseCount);
    socket.on("admin:participant-joined", onParticipantJoined);
    socket.on("session:scoreboard", onScoreboard);

    return () => {
      socket.off("admin:state", onAdminState);
      socket.off("admin:response-count", onResponseCount);
      socket.off("admin:participant-joined", onParticipantJoined);
      socket.off("session:scoreboard", onScoreboard);
    };
  }, [socket, sessionId]);

  // Fetch session code for display
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data: { code?: string }) => {
        if (data.code) setSessionCode(data.code);
      })
      .catch(() => {});
  }, [sessionId]);

  function emit(event: string) {
    socket?.emit(event, { sessionId });
  }

  // Primary action derived from the current phase — used by the keyboard shortcut
  function primaryEvent(s: AdminStatePayload | null): string | null {
    if (!s) return null;
    if (s.phase === "lobby") return "admin:next";
    if (s.phase === "question_open") return "admin:lock-voting";
    if (s.phase === "question_locked") return "admin:show-results";
    if (s.phase === "results") {
      if (!s.correctRevealed) return "admin:show-correct";
      // On the last question, advancing means showing the final scoreboard
      const isLast = s.totalQuestions > 0 && s.currentQuestionIndex >= s.totalQuestions - 1;
      return isLast ? "admin:show-scoreboard" : "admin:next";
    }
    return null;
  }

  // Keep a ref so the keydown listener always sees the latest state
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const current = stateRef.current;
      if (!current) return;

      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        const evt = primaryEvent(current);
        if (evt) {
          e.preventDefault();
          socket?.emit(evt, { sessionId });
        }
      } else if ((e.key === "l" || e.key === "L") && current.phase === "question_open") {
        e.preventDefault();
        socket?.emit("admin:lock-voting", { sessionId });
      } else if ((e.key === "r" || e.key === "R") && current.phase === "results" && !current.correctRevealed) {
        e.preventDefault();
        socket?.emit("admin:show-correct", { sessionId });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [socket, sessionId]);

  // Countdown tick for timed questions
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state || state.timeLimit == null || state.questionOpenedAt == null) return;
    if (state.phase !== "question_open") return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state?.phase, state?.timeLimit, state?.questionOpenedAt]);

  const remainingSeconds =
    state && state.timeLimit != null && state.questionOpenedAt != null
      ? Math.max(
          0,
          Math.ceil((state.questionOpenedAt + state.timeLimit * 1000 - now) / 1000)
        )
      : null;

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400">Connecting…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400">Loading session…</p>
      </div>
    );
  }

  const phase = state.phase;

  const showJoinPanel = phase === "lobby";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Join panel (lobby) — big QR for scanning */}
      {showJoinPanel && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 flex gap-6 items-center">
          <div className="shrink-0 rounded-xl bg-white p-3 ring-1 ring-gray-100">
            {joinUrl ? (
              <QRCodeSVG value={joinUrl} size={160} level="M" />
            ) : (
              <div className="w-[160px] h-[160px] bg-gray-50" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Scan or join at</p>
            <p className="text-sm font-mono text-gray-700 truncate">{joinUrl || "…"}</p>
            <div className="mt-4 flex items-end gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400">Code</p>
                <p className="font-mono text-4xl font-bold tracking-[0.25em] leading-none">{sessionCode}</p>
              </div>
              {sessionCode && (
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={copied ? "Copied session code" : "Copy session code"}
                  title={copied ? "Copied" : "Copy code"}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-black hover:bg-gray-100 transition"
                >
                  {copied ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,8.5 6.5,12 13,5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
                      <path d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">Participants</p>
              <p className="text-2xl font-bold">{state.participantCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Compact info bar (during quiz) */}
      {!showJoinPanel && (
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div>
            <span className="text-sm text-gray-500">Session code</span>
            <div className="flex items-center gap-2">
              <p className="font-mono text-3xl font-bold tracking-widest">{sessionCode}</p>
              {sessionCode && (
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={copied ? "Copied session code" : "Copy session code"}
                  title={copied ? "Copied" : "Copy code"}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-black hover:bg-gray-100 transition"
                >
                  {copied ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,8.5 6.5,12 13,5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
                      <path d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Participants</p>
            <p className="text-3xl font-bold">{state.participantCount}</p>
          </div>
        </div>
      )}

      {/* Phase indicator */}
      <div className="mb-6">
        <span
          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
            phase === "question_open"
              ? "bg-green-100 text-green-700"
              : phase === "question_locked"
                ? "bg-yellow-100 text-yellow-700"
                : phase === "results"
                  ? "bg-blue-100 text-blue-700"
                  : phase === "final"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600"
          }`}
        >
          {phase.replace(/_/g, " ")}
        </span>
      </div>

      {/* Current question */}
      {state.question && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-gray-500 mb-1">
              Question {state.currentQuestionIndex + 1}
              {state.totalQuestions ? ` of ${state.totalQuestions}` : ""} · {state.question.type} ·{" "}
              {state.question.points} pt{state.question.points !== 1 ? "s" : ""}
            </p>
            {remainingSeconds != null && phase === "question_open" && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                  remainingSeconds <= 5
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-200 text-gray-700"
                }`}
                aria-live="polite"
              >
                {remainingSeconds}s
              </span>
            )}
          </div>
          <p className="font-semibold text-lg">{state.question.title}</p>
          {phase === "question_open" && (
            <p className="mt-2 text-sm text-gray-500">
              Responses: {state.responseCount} / {state.totalParticipants}
            </p>
          )}
        </div>
      )}

      {/* Scoreboard (final phase) */}
      {phase === "final" && scoreboard && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Final Scoreboard</h2>
          <ul className="space-y-2">
            {scoreboard.rankings.slice(0, 10).map((r) => (
              <li key={r.participantId} className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-400 w-4">{r.rank}</span>
                <span className="flex-1 text-sm">{r.displayName}</span>
                <span className="font-semibold text-sm">{r.score} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Lobby controls */}
        {phase === "lobby" && (
          <button
            onClick={() => emit("admin:next")}
            className="col-span-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800"
          >
            Start Quiz →
          </button>
        )}

        {/* Question open controls */}
        {phase === "question_open" && (
          <button
            onClick={() => emit("admin:lock-voting")}
            className="col-span-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800"
          >
            Lock Voting
          </button>
        )}

        {/* Question locked controls */}
        {phase === "question_locked" && (
          <button
            onClick={() => emit("admin:show-results")}
            className="col-span-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800"
          >
            Show Results
          </button>
        )}

        {/* Results controls */}
        {phase === "results" && (() => {
          const isLast =
            state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
          return (
            <>
              {!state.correctRevealed && (
                <button
                  onClick={() => emit("admin:show-correct")}
                  className={`py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 ${
                    isLast ? "col-span-2" : ""
                  }`}
                >
                  Reveal Answer
                </button>
              )}
              {!isLast && (
                <button
                  onClick={() => emit("admin:next")}
                  className="py-3 border border-black font-semibold rounded-lg hover:bg-gray-50"
                >
                  Next Question →
                </button>
              )}
              <button
                onClick={() => emit("admin:show-scoreboard")}
                className={`py-3 font-semibold rounded-lg col-span-2 ${
                  isLast && state.correctRevealed
                    ? "bg-black text-white hover:bg-gray-800"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Show Final Scoreboard
              </button>
            </>
          );
        })()}

        {/* Final controls */}
        {phase === "final" && (
          <>
            <a
              href={`/admin/sessions/${sessionId}/results`}
              className="py-3 border border-black text-center font-semibold rounded-lg hover:bg-gray-50"
            >
              View Results
            </a>
            <button
              onClick={() => emit("admin:end-session")}
              className="py-3 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50"
            >
              End Session
            </button>
          </>
        )}
      </div>

      {/* Join link + keyboard hint */}
      <div className="mt-8 text-xs text-gray-400 flex items-center justify-between gap-4">
        <span>
          Participants join at <span className="font-mono">/join</span> with code{" "}
          <span className="font-mono font-bold text-black">{sessionCode}</span>
        </span>
        {primaryEvent(state) && (
          <span className="shrink-0">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">Space</kbd> to advance
          </span>
        )}
      </div>
    </div>
  );
}
