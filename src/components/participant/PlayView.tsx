"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/lib/socket/client";
import type {
  SessionStatePayload,
  ResultsPayload,
  CorrectPayload,
  ScoreboardPayload,
  ResponseCountPayload,
} from "@/lib/socket/events";
import { buttonClass, ChoiceMarker, QuestionTypeBadge, ThemeToggle } from "@/components/ui";

interface Props {
  sessionCode: string;
}

export default function PlayView({ sessionCode }: Props) {
  const { socket, connected } = useSocket();
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [correct, setCorrect] = useState<CorrectPayload | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardPayload | null>(null);
  const [responseCount, setResponseCount] = useState<ResponseCountPayload | null>(null);
  const [ended, setEnded] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rejected, setRejected] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const choiceRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    fetch(`/api/sessions/by-code/${sessionCode}`)
      .then((r) => r.json())
      .then((data: { id?: string }) => {
        if (data.id) setSessionId(data.id);
      })
      .catch(() => {});

    const stored = localStorage.getItem(`participant:${sessionCode}`);
    if (stored) setParticipantId(stored);
  }, [sessionCode]);

  useEffect(() => {
    if (!socket || !connected) return;

    const storedId = localStorage.getItem(`participant:${sessionCode}`);
    const storedName = localStorage.getItem(`name:${sessionCode}`) ?? "Participant";

    socket.emit("participant:join", {
      sessionCode,
      displayName: storedName,
      participantId: storedId ?? undefined,
    });

    const handleConfirmed = (payload: { participantId: string }) => {
      setParticipantId(payload.participantId);
      localStorage.setItem(`participant:${sessionCode}`, payload.participantId);
    };

    const handleState = (payload: SessionStatePayload) => {
      setState(payload);
      if (payload.mySubmission) {
        setSelectedChoices(payload.mySubmission);
        setSubmitted(true);
      } else {
        setSelectedChoices([]);
        setSubmitted(false);
      }
      if (payload.phase === "question_open") {
        setResults(null);
        setCorrect(null);
        setResponseCount(null);
        setRejected(false);
      }
    };

    const handleSubmitRejected = (_payload: { questionId: string; reason: string }) => {
      setRejected(true);
      setSubmitted(false);
    };

    const handleResponseCount = (payload: ResponseCountPayload) => setResponseCount(payload);

    const handleResults = (payload: ResultsPayload) => setResults(payload);
    const handleCorrect = (payload: CorrectPayload) => setCorrect(payload);
    const handleScoreboard = (payload: ScoreboardPayload) => setScoreboard(payload);
    const handleEnded = () => setEnded(true);

    socket.on("participant:confirmed", handleConfirmed);
    socket.on("session:state", handleState);
    socket.on("session:results", handleResults);
    socket.on("session:correct", handleCorrect);
    socket.on("session:scoreboard", handleScoreboard);
    socket.on("session:ended", handleEnded);
    socket.on("session:response-count", handleResponseCount);
    socket.on("session:submit-rejected", handleSubmitRejected);

    return () => {
      socket.off("participant:confirmed", handleConfirmed);
      socket.off("session:state", handleState);
      socket.off("session:results", handleResults);
      socket.off("session:correct", handleCorrect);
      socket.off("session:scoreboard", handleScoreboard);
      socket.off("session:ended", handleEnded);
      socket.off("session:response-count", handleResponseCount);
      socket.off("session:submit-rejected", handleSubmitRejected);
    };
  }, [socket, connected, sessionCode]);

  useEffect(() => {
    if (!state || state.timeLimit == null || state.questionOpenedAt == null) return;
    if (state.phase !== "question_open") return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state?.phase, state?.timeLimit, state?.questionOpenedAt]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [state?.question?.id]);

  useEffect(() => {
    if (!state || state.phase !== "question_open" || submitted) return;
    const btn = choiceRefs.current[focusedIndex];
    if (btn) btn.focus();
  }, [focusedIndex, state?.phase, state?.question?.id, submitted, state]);

  useEffect(() => {
    if (!state || state.phase !== "question_open" || submitted) return;
    const choices = state.choices;
    const question = state.question;
    if (!choices.length || !question) return;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % choices.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + choices.length) % choices.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const choice = choices[focusedIndex];
        if (!choice) return;
        if (question.type === "single") {
          if (selectedChoices[0] === choice.id) {
            submitAnswer();
          } else {
            setSelectedChoices([choice.id]);
          }
        } else {
          if (selectedChoices.length > 0) submitAnswer();
        }
      } else if (e.key === " " && question.type === "multi") {
        e.preventDefault();
        const choice = choices[focusedIndex];
        if (choice) toggleChoice(choice.id);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, submitted, focusedIndex, selectedChoices]);

  function toggleChoice(choiceId: string) {
    if (!state || state.phase !== "question_open" || submitted) return;

    if (state.question?.type === "multi") {
      setSelectedChoices((prev) =>
        prev.includes(choiceId) ? prev.filter((id) => id !== choiceId) : [...prev, choiceId],
      );
    } else {
      setSelectedChoices([choiceId]);
    }
  }

  function submitAnswer() {
    if (!socket || !state?.question || selectedChoices.length === 0) return;
    socket.emit("participant:submit", {
      questionId: state.question.id,
      choiceIds: selectedChoices,
    });
    setSubmitted(true);
  }

  if (!connected) {
    return (
      <Screen>
        <p className="text-ink-faint text-lg">Connecting…</p>
      </Screen>
    );
  }

  if (ended) {
    return (
      <Screen>
        <p className="text-3xl font-bold mb-2">Thanks for playing!</p>
        <p className="text-ink-muted">The session has ended.</p>
      </Screen>
    );
  }

  if (!state) {
    return (
      <Screen>
        <p className="text-ink-faint">Waiting for session…</p>
      </Screen>
    );
  }

  if (state.phase === "lobby") {
    const displayName =
      typeof window !== "undefined" ? localStorage.getItem(`name:${sessionCode}`) : null;
    return (
      <Screen>
        <div className="quicz-fade-in flex flex-col items-center">
          <p className="text-4xl font-bold mb-3">You&apos;re in!</p>
          {displayName && (
            <p className="text-sm font-mono uppercase tracking-widest text-ink-faint mb-5">
              {displayName}
            </p>
          )}
          <p className="text-ink-muted text-lg">Waiting for the quiz to start…</p>
          <div className="mt-8 flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-line-strong rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </Screen>
    );
  }

  if (state.phase === "final" || scoreboard) {
    const myRanking = scoreboard?.rankings.find((r) => r.participantId === participantId);
    const showMeBelowCut = scoreboard && myRanking && myRanking.rank > 10;
    return (
      <Screen>
        <div className="quicz-fade-in w-full max-w-xs">
          <p className="text-3xl font-bold mb-1 text-center">Final standings</p>
          <p className="text-sm text-ink-muted text-center mb-6">Thanks for playing.</p>
          {scoreboard ? (
            <>
              <ul className="space-y-2">
                {scoreboard.rankings.slice(0, 10).map((r) => {
                  const isMe = r.participantId === participantId;
                  return (
                    <li
                      key={r.participantId}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isMe ? "bg-ink-strong text-surface" : "bg-surface-muted text-ink"
                      }`}
                    >
                      <span
                        className={`text-sm font-mono w-6 ${
                          isMe ? "text-line-strong" : "text-ink-faint"
                        }`}
                      >
                        {r.rank}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">{r.displayName}</span>
                      <span className="font-bold text-sm tabular-nums">{r.score} pts</span>
                    </li>
                  );
                })}
              </ul>
              {showMeBelowCut && myRanking && (
                <>
                  <p className="text-center text-xs text-ink-faint mt-3 mb-2">· · ·</p>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-strong text-surface">
                    <span className="text-sm font-mono w-6 text-line-strong">{myRanking.rank}</span>
                    <span className="flex-1 text-sm font-medium truncate">
                      {myRanking.displayName}
                    </span>
                    <span className="font-bold text-sm tabular-nums">{myRanking.score} pts</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-ink-faint text-center">Calculating scores…</p>
          )}
        </div>
      </Screen>
    );
  }

  const question = state.question;
  if (!question)
    return (
      <Screen>
        <p className="text-ink-faint">Loading question…</p>
      </Screen>
    );

  const isLocked = state.phase === "question_locked" || state.phase === "results";

  void sessionId;

  const total = state.totalQuestions || 0;
  const current = state.currentQuestionIndex + 1;
  const progressPct = total > 0 ? Math.round((current / total) * 100) : 0;

  const remainingSeconds =
    state.timeLimit != null && state.questionOpenedAt != null
      ? Math.max(0, Math.ceil((state.questionOpenedAt + state.timeLimit * 1000 - now) / 1000))
      : null;
  const timeUp = remainingSeconds === 0 && state.phase === "question_open";

  return (
    <div className="relative min-h-screen flex flex-col bg-surface">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle showLabel={false} />
      </div>
      <div className="h-1 bg-surface-muted">
        <div
          className="h-1 bg-ink-strong transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div
        key={`${question.id}-${state.phase}`}
        className="flex-1 flex flex-col px-4 py-8 max-w-lg mx-auto w-full quicz-fade-in"
      >
        <div className="mb-8">
          <p className="mb-2 text-xs font-mono uppercase tracking-wider text-ink-faint">
            {total > 0 && (
              <>
                Q{current} / {total}
                <span className="text-ink-faint/60"> · </span>
              </>
            )}
            {question.points} pt{question.points !== 1 ? "s" : ""}
          </p>
          <h2 className="text-2xl font-bold leading-snug tracking-tight">{question.title}</h2>
          <div className="mt-3">
            <QuestionTypeBadge type={question.type} showHint />
          </div>
          {remainingSeconds != null && state.phase === "question_open" && (
            <p
              className={`mt-3 text-sm font-medium tabular-nums ${
                remainingSeconds <= 5 ? "text-danger" : "text-ink-muted"
              }`}
              aria-live="polite"
            >
              {remainingSeconds}s left
            </p>
          )}
        </div>

        {state.phase === "results" && state.correctRevealed && correct?.participantResult && (
          <div
            className={`mb-6 flex items-stretch rounded-xl overflow-hidden border border-line quicz-fade-in`}
          >
            <div
              className={`w-1.5 ${
                correct.participantResult.isCorrect ? "bg-success" : "bg-danger"
              }`}
              aria-hidden
            />
            <div className="flex-1 flex items-center gap-3 p-4 bg-surface-muted">
              <div
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  correct.participantResult.isCorrect
                    ? "bg-success-soft text-success"
                    : "bg-danger-soft text-danger"
                }`}
              >
                {correct.participantResult.isCorrect ? (
                  <svg
                    viewBox="0 0 20 20"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4,10.5 8.5,15 16,6" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 20 20"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="5" x2="15" y2="15" />
                    <line x1="15" y1="5" x2="5" y2="15" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                {correct.participantResult.isCorrect ? (
                  <>
                    <p className="font-semibold text-ink leading-tight">Correct</p>
                    <p className="text-sm text-ink-muted">
                      +{correct.participantResult.pointsEarned} points
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-ink leading-tight">See the correct answer</p>
                    <p className="text-sm text-ink-muted">No points this round — onwards.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 flex-1">
          {(() => {
            const showBars = state.phase === "results" && state.answersVisible && results;
            const totalVotes = showBars ? results.distribution.reduce((s, d) => s + d.count, 0) : 0;

            return state.choices.map((choice) => {
              const isSelected = selectedChoices.includes(choice.id);
              const distribution = results?.distribution.find((d) => d.choiceId === choice.id);
              const isCorrectChoice = correct?.correctChoiceIds.includes(choice.id);
              const count = distribution?.count ?? 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

              if (showBars) {
                let borderColor = "border-line";
                let barColor = "bg-line-strong";
                let textColor = "text-ink";

                if (state.correctRevealed) {
                  if (isCorrectChoice) {
                    borderColor = "border-success";
                    barColor = "bg-success";
                    textColor = "text-ink";
                  } else if (isSelected) {
                    borderColor = "border-danger/60";
                    barColor = "bg-danger";
                    textColor = "text-ink";
                  } else {
                    borderColor = "border-line";
                    textColor = "text-ink-faint";
                  }
                } else if (isSelected) {
                  borderColor = "border-ink-strong";
                  barColor = "bg-ink";
                }

                return (
                  <div
                    key={choice.id}
                    className={`relative w-full rounded-xl border-2 overflow-hidden ${borderColor}`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${barColor} opacity-20 transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className={`relative flex items-center justify-between px-5 py-4 font-medium ${textColor}`}
                    >
                      <span className="flex items-center gap-2">
                        {state.correctRevealed && isCorrectChoice && (
                          <span className="text-success font-bold" aria-label="Correct answer">
                            ✓
                          </span>
                        )}
                        {state.correctRevealed && isSelected && !isCorrectChoice && (
                          <span className="text-danger font-bold" aria-label="Your answer">
                            ✗
                          </span>
                        )}
                        {choice.text}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {count} <span className="font-normal opacity-60">({pct}%)</span>
                      </span>
                    </div>
                  </div>
                );
              }

              let choiceClass =
                "w-full px-5 py-4 rounded-xl border-2 text-left font-medium transition-all duration-150 " +
                "flex items-center gap-3 " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ";
              if (isSelected) {
                choiceClass += "border-ink-strong bg-ink-strong text-surface";
              } else if (isLocked || submitted) {
                choiceClass += "border-line text-ink-muted";
              } else {
                choiceClass += "border-line hover:border-ink-strong";
              }

              const choiceIndex = state.choices.indexOf(choice);
              return (
                <button
                  key={choice.id}
                  ref={(el) => {
                    choiceRefs.current[choiceIndex] = el;
                  }}
                  onClick={() => {
                    setFocusedIndex(choiceIndex);
                    toggleChoice(choice.id);
                  }}
                  disabled={isLocked || submitted}
                  className={choiceClass}
                >
                  <ChoiceMarker type={question.type} selected={isSelected} />
                  <span className="flex-1">{choice.text}</span>
                </button>
              );
            });
          })()}
        </div>

        {state.phase === "question_open" && (
          <div className="mt-6">
            {submitted ? (
              <div className="text-center py-4 text-ink-muted">
                <p className="font-medium text-ink">Answer submitted ✓</p>
                {responseCount && responseCount.total > 0 ? (
                  <p className="text-sm mt-1">
                    {responseCount.count} of {responseCount.total} answered
                  </p>
                ) : (
                  <p className="text-sm mt-1">Waiting for others…</p>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={submitAnswer}
                  disabled={selectedChoices.length === 0 || timeUp}
                  className={buttonClass("primary", "lg", "w-full")}
                >
                  {timeUp ? "Time's up" : "Submit Answer"}
                </button>
                {selectedChoices.length === 0 && !timeUp && (
                  <p className="mt-2 text-xs text-center text-ink-faint">
                    Select an answer to submit
                  </p>
                )}
                {rejected && (
                  <p className="mt-2 text-xs text-center text-danger">
                    Time&apos;s up — your answer was not accepted.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {state.phase === "question_locked" && (
          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted text-ink-muted text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse" aria-hidden />
              Answer locked · awaiting reveal
            </span>
          </div>
        )}

        {state.phase === "results" && !state.correctRevealed && (
          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted text-ink-muted text-sm">
              Correct answer will be revealed shortly
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 bg-surface text-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle showLabel={false} />
      </div>
      {children}
    </div>
  );
}
