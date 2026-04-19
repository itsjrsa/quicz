"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSocket } from "@/lib/socket/client";
import type { AdminStatePayload, ScoreboardPayload } from "@/lib/socket/events";
import { buttonClass } from "@/components/ui";

interface Props {
  sessionId: string;
}

const PHASE_STYLES: Record<string, { label: string; className: string }> = {
  lobby: { label: "Lobby", className: "bg-surface-muted text-ink-muted" },
  question_open: { label: "Voting open", className: "bg-success-soft text-success" },
  question_locked: { label: "Voting locked", className: "bg-warning-soft text-warning" },
  results: { label: "Results", className: "bg-surface-sunken text-ink" },
  final: { label: "Final", className: "bg-ink-strong text-surface" },
};

export default function PresenterView({ sessionId }: Props) {
  const { socket, connected } = useSocket();
  const [state, setState] = useState<AdminStatePayload | null>(null);
  const [sessionCode, setSessionCode] = useState<string>("");
  const [scoreboard, setScoreboard] = useState<ScoreboardPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [lobbyParticipants, setLobbyParticipants] = useState<{ id: string; displayName: string }[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

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
      if (payload.phase === "lobby" && payload.participantList) {
        setLobbyParticipants(payload.participantList);
      }
    };

    const onResponseCount = (payload: { questionId: string; count: number; total: number }) => {
      setState((prev) =>
        prev ? { ...prev, responseCount: payload.count, totalParticipants: payload.total } : prev
      );
    };

    const onParticipantJoined = (payload: { participantId: string; displayName: string }) => {
      setLobbyParticipants((prev) => {
        if (prev.some((p) => p.id === payload.participantId)) return prev;
        setState((s) => (s ? { ...s, participantCount: s.participantCount + 1 } : s));
        return [...prev, { id: payload.participantId, displayName: payload.displayName }];
      });
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

  function backEvent(s: AdminStatePayload | null): string | null {
    if (!s) return null;
    if (s.phase === "question_open") return "admin:back";
    if (s.phase === "question_locked") return "admin:open-voting";
    if (s.phase === "results") return "admin:back";
    return null;
  }

  function primaryEvent(s: AdminStatePayload | null): string | null {
    if (!s) return null;
    if (s.phase === "lobby") return "admin:next";
    if (s.phase === "question_open") return "admin:lock-voting";
    if (s.phase === "question_locked") return "admin:show-results";
    if (s.phase === "results") {
      if (!s.correctRevealed) return "admin:show-correct";
      const isLast = s.totalQuestions > 0 && s.currentQuestionIndex >= s.totalQuestions - 1;
      return isLast ? "admin:show-scoreboard" : "admin:next";
    }
    return null;
  }

  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const current = stateRef.current;
      if (!current) return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (showShortcuts) {
          e.preventDefault();
          setShowShortcuts(false);
        }
        return;
      }

      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        const evt = primaryEvent(current);
        if (evt) {
          e.preventDefault();
          socket?.emit(evt, { sessionId });
        }
      } else if (e.key === "ArrowLeft") {
        const evt = backEvent(current);
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
  }, [socket, sessionId, showShortcuts]);

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
        <p className="text-ink-faint">Connecting…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-ink-faint">Loading session…</p>
      </div>
    );
  }

  const phase = state.phase;
  const phaseStyle = PHASE_STYLES[phase] ?? PHASE_STYLES.lobby;
  const showJoinPanel = phase === "lobby";

  return (
    <div className="max-w-4xl mx-auto">
      {showJoinPanel && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-6 flex flex-col sm:flex-row gap-6 items-center">
          <div className="shrink-0 rounded-xl bg-surface p-3 ring-1 ring-line">
            {joinUrl ? (
              <QRCodeSVG value={joinUrl} size={180} level="M" />
            ) : (
              <div className="w-[180px] h-[180px] bg-surface-muted" />
            )}
          </div>
          <div className="flex-1 min-w-0 w-full">
            <p className="text-xs uppercase tracking-wider text-ink-faint mb-1 font-mono">Scan or join at</p>
            <p className="text-sm font-mono text-ink-muted truncate">{joinUrl || "…"}</p>
            <div className="mt-4 flex items-end gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-faint font-mono">Code</p>
                <p className="font-mono text-5xl font-bold tracking-[0.25em] leading-none">{sessionCode}</p>
              </div>
              {sessionCode && (
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={copied ? "Copied session code" : "Copy session code"}
                  title={copied ? "Copied" : "Copy code"}
                  className="w-9 h-9 flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-surface-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  {copied ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              <p className="text-xs uppercase tracking-wider text-ink-faint font-mono">Participants</p>
              <p className="text-3xl font-bold tabular-nums">{state.participantCount}</p>
            </div>
          </div>
        </div>
      )}

      {showJoinPanel && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-ink-faint font-mono">
              Currently in lobby
            </p>
            <span
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
              aria-live="polite"
            >
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              live
            </span>
          </div>
          {lobbyParticipants.length === 0 ? (
            <p className="text-sm text-ink-faint italic">
              Waiting for participants to join…
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {lobbyParticipants.map((p) => (
                <li
                  key={p.id}
                  className="quicz-pop-in inline-flex px-3 py-1 rounded-full bg-surface-muted text-sm text-ink max-w-full truncate"
                >
                  {p.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!showJoinPanel && (
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
          <div>
            <span className="text-xs uppercase tracking-wider text-ink-faint font-mono">Session code</span>
            <div className="flex items-center gap-2">
              <p className="font-mono text-4xl font-bold tracking-widest">{sessionCode}</p>
              {sessionCode && (
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={copied ? "Copied session code" : "Copy session code"}
                  title={copied ? "Copied" : "Copy code"}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-surface-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  {copied ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            <p className="text-xs uppercase tracking-wider text-ink-faint font-mono">Participants</p>
            <p className="text-4xl font-bold tabular-nums">{state.participantCount}</p>
          </div>
        </div>
      )}

      {phase !== "lobby" && (
        <div className="mb-6 flex items-center gap-2">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${phaseStyle.className}`}
          >
            {phaseStyle.label}
          </span>
        </div>
      )}

      {state.question && (
        <div
          key={`${state.question.id}-${phase}`}
          className="mb-6 p-6 sm:p-8 bg-surface-muted rounded-2xl quicz-fade-in"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-3">
              Q{state.currentQuestionIndex + 1}
              {state.totalQuestions ? ` / ${state.totalQuestions}` : ""}
              <span className="text-ink-faint/60"> · </span>
              {state.question.type}
              <span className="text-ink-faint/60"> · </span>
              {state.question.points} pt{state.question.points !== 1 ? "s" : ""}
            </p>
            {remainingSeconds != null && phase === "question_open" && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium tabular-nums ${
                  remainingSeconds <= 5
                    ? "bg-danger-soft text-danger"
                    : "bg-surface text-ink border border-line"
                }`}
                aria-live="polite"
              >
                {remainingSeconds}s
              </span>
            )}
          </div>
          <p className="font-bold text-3xl sm:text-4xl leading-tight tracking-tight text-ink">
            {state.question.title}
          </p>
          {phase === "question_open" && (
            <div className="mt-6 flex items-end gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-faint font-mono">
                  Responses
                </p>
                <p className="text-3xl font-bold tabular-nums">
                  {state.responseCount}
                  <span className="text-ink-faint font-normal"> / {state.totalParticipants}</span>
                </p>
              </div>
              <div className="flex-1 h-2 rounded-full bg-line overflow-hidden mb-1">
                <div
                  className="h-2 bg-ink-strong transition-all duration-500"
                  style={{
                    width:
                      state.totalParticipants > 0
                        ? `${Math.round(
                            (state.responseCount / state.totalParticipants) * 100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "final" && scoreboard && (
        <div className="mb-6">
          <h2 className="font-bold text-2xl mb-3 tracking-tight">Final scoreboard</h2>
          <ul className="space-y-2">
            {scoreboard.rankings.slice(0, 10).map((r) => (
              <li
                key={r.participantId}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-muted"
              >
                <span className="text-sm font-mono text-ink-faint w-5 tabular-nums">{r.rank}</span>
                <span className="flex-1 text-sm font-medium truncate">{r.displayName}</span>
                <span className="font-bold text-sm tabular-nums">{r.score} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {phase === "lobby" && (
          <button
            onClick={() => emit("admin:next")}
            className={buttonClass("primary", "lg", "col-span-2")}
          >
            Start Quiz →
          </button>
        )}

        {phase === "question_open" && (
          <>
            <button
              onClick={() => emit("admin:back")}
              className={buttonClass("secondary", "md")}
            >
              ← Back
            </button>
            <button
              onClick={() => emit("admin:lock-voting")}
              className={buttonClass("primary", "md")}
            >
              Lock voting
            </button>
          </>
        )}

        {phase === "question_locked" && (
          <>
            <button
              onClick={() => emit("admin:open-voting")}
              className={buttonClass("secondary", "md")}
            >
              Re-open voting
            </button>
            <button
              onClick={() => emit("admin:show-results")}
              className={buttonClass("primary", "md")}
            >
              Show results
            </button>
          </>
        )}

        {phase === "results" && (() => {
          const isLast =
            state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
          return (
            <>
              <button
                onClick={() => emit("admin:back")}
                className={buttonClass("secondary", "md", "col-span-2")}
              >
                ← Back
              </button>
              {!state.correctRevealed && (
                <button
                  onClick={() => emit("admin:show-correct")}
                  className={buttonClass("primary", "md", isLast ? "col-span-2" : "")}
                >
                  Reveal answer
                </button>
              )}
              {!isLast && (
                <button
                  onClick={() => emit("admin:next")}
                  className={buttonClass("secondary", "md")}
                >
                  Next question →
                </button>
              )}
              <button
                onClick={() => emit("admin:show-scoreboard")}
                className={buttonClass(
                  isLast && state.correctRevealed ? "primary" : "secondary",
                  "md",
                  "col-span-2"
                )}
              >
                Show final scoreboard
              </button>
            </>
          );
        })()}

        {phase === "final" && (
          <>
            <a
              href={`/admin/sessions/${sessionId}/results`}
              className={buttonClass("secondary", "md", "col-span-1")}
            >
              View results
            </a>
            <button
              onClick={() => emit("admin:end-session")}
              className={buttonClass("ghost", "md")}
            >
              End session
            </button>
          </>
        )}
      </div>

      <div className="mt-8 text-xs text-ink-faint flex items-center justify-between gap-4 flex-wrap">
        <span>
          Participants join at <span className="font-mono">/join</span> with code{" "}
          <span className="font-mono font-bold text-ink">{sessionCode}</span>
        </span>
        <span className="shrink-0 flex items-center gap-3">
          {backEvent(state) && (
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-muted text-ink-muted font-mono">←</kbd> back
            </span>
          )}
          {primaryEvent(state) && (
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-muted text-ink-muted font-mono">Space</kbd> advance
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="inline-flex items-center gap-1 text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded px-1"
            title="Keyboard shortcuts (?)"
          >
            <kbd className="px-1.5 py-0.5 rounded bg-surface-muted text-ink-muted font-mono">?</kbd> shortcuts
          </button>
        </span>
      </div>

      {showShortcuts && (
        <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface rounded-2xl shadow-xl border border-line p-6 quicz-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            ×
          </button>
        </div>
        <dl className="space-y-3 text-sm">
          <Shortcut keys={["Space", "Enter", "→"]} description="Advance to next phase / question" />
          <Shortcut keys={["←"]} description="Go back one phase (where allowed)" />
          <Shortcut keys={["L"]} description="Lock voting (when open)" />
          <Shortcut keys={["R"]} description="Reveal correct answer (on results)" />
          <Shortcut keys={["?"]} description="Show or hide this overlay" />
          <Shortcut keys={["Esc"]} description="Close this overlay" />
        </dl>
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-xs uppercase tracking-wider text-ink-faint font-mono mb-2">
            Phase colors
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PHASE_STYLES).map(([key, { label, className }]) => (
              <span
                key={key}
                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${className}`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Shortcut({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-ink-faint text-xs">or</span>}
            <kbd className="px-2 py-1 rounded bg-surface-muted text-ink-muted font-mono text-xs">
              {k}
            </kbd>
          </span>
        ))}
      </div>
      <p className="text-ink-muted text-right flex-1">{description}</p>
    </div>
  );
}
