"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket/client";
import type {
  SessionStatePayload,
  ResultsPayload,
  CorrectPayload,
  ScoreboardPayload,
} from "@/lib/socket/events";

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
  const [ended, setEnded] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Resolve session and get participantId from localStorage
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

  // Join session when socket is ready
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
      // Restore submission from server state
      if (payload.mySubmission) {
        setSelectedChoices(payload.mySubmission);
        setSubmitted(true);
      } else {
        // Reset on new question
        setSelectedChoices([]);
        setSubmitted(false);
      }
      // Clear results/correct on new question
      if (payload.phase === "question_open") {
        setResults(null);
        setCorrect(null);
      }
    };

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

    return () => {
      socket.off("participant:confirmed", handleConfirmed);
      socket.off("session:state", handleState);
      socket.off("session:results", handleResults);
      socket.off("session:correct", handleCorrect);
      socket.off("session:scoreboard", handleScoreboard);
      socket.off("session:ended", handleEnded);
    };
  }, [socket, connected, sessionCode]);

  function toggleChoice(choiceId: string) {
    if (!state || state.phase !== "question_open" || submitted) return;

    if (state.question?.type === "multi") {
      setSelectedChoices((prev) =>
        prev.includes(choiceId) ? prev.filter((id) => id !== choiceId) : [...prev, choiceId]
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

  // ── Render states ─────────────────────────────────────────────────────────

  if (!connected) {
    return (
      <Screen>
        <p className="text-gray-400 text-lg">Connecting…</p>
      </Screen>
    );
  }

  if (ended) {
    return (
      <Screen>
        <p className="text-3xl font-bold mb-2">Thanks for playing!</p>
        <p className="text-gray-500">The session has ended.</p>
      </Screen>
    );
  }

  if (!state) {
    return (
      <Screen>
        <p className="text-gray-400">Waiting for session…</p>
      </Screen>
    );
  }

  if (state.phase === "lobby") {
    return (
      <Screen>
        <p className="text-4xl font-bold mb-4">You&apos;re in!</p>
        <p className="text-gray-500 text-lg">Waiting for the quiz to start…</p>
        <div className="mt-8 flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </Screen>
    );
  }

  if (state.phase === "final" || scoreboard) {
    return (
      <Screen>
        <p className="text-3xl font-bold mb-6">Final Scores</p>
        {scoreboard ? (
          <ul className="w-full max-w-xs space-y-3">
            {scoreboard.rankings.slice(0, 10).map((r) => {
              const isMe = r.participantId === participantId;
              return (
                <li
                  key={r.participantId}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                    isMe ? "bg-black text-white" : "bg-gray-50"
                  }`}
                >
                  <span className={`text-sm font-mono w-5 ${isMe ? "text-gray-300" : "text-gray-400"}`}>
                    {r.rank}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">{r.displayName}</span>
                  <span className="font-bold text-sm">{r.score} pts</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-400">Calculating scores…</p>
        )}
      </Screen>
    );
  }

  // Question phases
  const question = state.question;
  if (!question) return <Screen><p className="text-gray-400">Loading question…</p></Screen>;

  const isLocked = state.phase === "question_locked" || state.phase === "results";

  // Suppress unused variable warning — sessionId is resolved for potential future use
  void sessionId;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className="h-1 bg-black" style={{ width: "100%" }} />
      </div>

      <div className="flex-1 flex flex-col px-4 py-8 max-w-lg mx-auto w-full">
        {/* Question */}
        <div className="mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            {question.type === "multi" ? "Select all that apply" : "Choose one"}
            {" · "}{question.points} pt{question.points !== 1 ? "s" : ""}
          </p>
          <h2 className="text-2xl font-bold leading-snug">{question.title}</h2>
        </div>

        {/* Personal result banner — shown above choices when revealed */}
        {state.phase === "results" && state.correctRevealed && correct?.participantResult && (
          <div
            className={`mb-6 flex items-center gap-3 p-4 rounded-xl border-2 ${
              correct.participantResult.isCorrect
                ? "bg-green-50 border-green-400"
                : "bg-red-50 border-red-400"
            }`}
          >
            <div
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                correct.participantResult.isCorrect ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {correct.participantResult.isCorrect ? (
                <svg viewBox="0 0 20 20" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4,10.5 8.5,15 16,6" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="5" x2="15" y2="15" />
                  <line x1="15" y1="5" x2="5" y2="15" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              {correct.participantResult.isCorrect ? (
                <>
                  <p className="font-bold text-lg text-green-800 leading-tight">Correct!</p>
                  <p className="text-sm text-green-700">+{correct.participantResult.pointsEarned} points</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-lg text-red-800 leading-tight">Incorrect</p>
                  <p className="text-sm text-red-700">No points this round</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Choices */}
        <div className="space-y-3 flex-1">
          {(() => {
            const showBars = state.phase === "results" && state.answersVisible && results;
            const totalVotes = showBars
              ? results.distribution.reduce((s, d) => s + d.count, 0)
              : 0;

            return state.choices.map((choice) => {
              const isSelected = selectedChoices.includes(choice.id);
              const distribution = results?.distribution.find((d) => d.choiceId === choice.id);
              const isCorrectChoice = correct?.correctChoiceIds.includes(choice.id);
              const count = distribution?.count ?? 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

              if (showBars) {
                // Bar-chart style card
                let borderColor = "border-gray-200";
                let barColor = "bg-gray-200";
                let textColor = "text-gray-800";

                if (state.correctRevealed) {
                  if (isCorrectChoice) {
                    borderColor = "border-green-500";
                    barColor = "bg-green-400";
                    textColor = "text-green-800";
                  } else if (isSelected) {
                    borderColor = "border-red-500";
                    barColor = "bg-red-300";
                    textColor = "text-red-800";
                  } else {
                    borderColor = "border-gray-100";
                    textColor = "text-gray-400";
                  }
                } else if (isSelected) {
                  borderColor = "border-black";
                  barColor = "bg-gray-800";
                }

                return (
                  <div
                    key={choice.id}
                    className={`relative w-full rounded-xl border-2 overflow-hidden ${borderColor}`}
                  >
                    {/* Bar fill */}
                    <div
                      className={`absolute inset-y-0 left-0 ${barColor} opacity-25 transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                    {/* Content */}
                    <div className={`relative flex items-center justify-between px-5 py-4 font-medium ${textColor}`}>
                      <span className="flex items-center gap-2">
                        {state.correctRevealed && isCorrectChoice && (
                          <span className="text-green-600 font-bold">✓</span>
                        )}
                        {state.correctRevealed && isSelected && !isCorrectChoice && (
                          <span className="text-red-500 font-bold">✗</span>
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

              // Normal clickable button (voting phase)
              let choiceClass = "w-full px-5 py-4 rounded-xl border-2 text-left font-medium transition-colors ";
              if (isSelected) {
                choiceClass += "border-black bg-black text-white";
              } else {
                choiceClass += "border-gray-200 hover:border-gray-400";
              }

              return (
                <button
                  key={choice.id}
                  onClick={() => toggleChoice(choice.id)}
                  disabled={isLocked || submitted}
                  className={choiceClass}
                >
                  {choice.text}
                </button>
              );
            });
          })()}
        </div>

        {/* Submit button */}
        {state.phase === "question_open" && (
          <div className="mt-6">
            {submitted ? (
              <div className="text-center py-4 text-gray-500">
                <p className="font-medium">Answer submitted ✓</p>
                <p className="text-sm mt-1">Waiting for others…</p>
              </div>
            ) : (
              <button
                onClick={submitAnswer}
                disabled={selectedChoices.length === 0}
                className="w-full py-4 bg-black text-white font-semibold text-lg rounded-xl hover:bg-gray-800 disabled:opacity-30"
              >
                Submit Answer
              </button>
            )}
          </div>
        )}

        {/* Locked state */}
        {state.phase === "question_locked" && (
          <div className="mt-6 text-center text-gray-500">
            <p className="font-medium">Voting locked</p>
            <p className="text-sm mt-1">Waiting for results…</p>
          </div>
        )}

        {/* Results state */}
        {state.phase === "results" && !state.correctRevealed && (
          <div className="mt-6 text-center text-gray-500">
            <p className="text-sm">Correct answer will be revealed shortly</p>
          </div>
        )}

      </div>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white text-center">
      {children}
    </div>
  );
}
