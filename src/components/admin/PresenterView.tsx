"use client";

import { useEffect, useState } from "react";
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

  return (
    <div className="max-w-2xl">
      {/* Session info bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div>
          <span className="text-sm text-gray-500">Session code</span>
          <p className="font-mono text-3xl font-bold tracking-widest">{sessionCode}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Participants</p>
          <p className="text-3xl font-bold">{state.participantCount}</p>
        </div>
      </div>

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
          <p className="text-xs text-gray-500 mb-1">
            Question {state.currentQuestionIndex + 1} · {state.question.type} ·{" "}
            {state.question.points} pt{state.question.points !== 1 ? "s" : ""}
          </p>
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
        {phase === "results" && (
          <>
            {!state.correctRevealed && (
              <button
                onClick={() => emit("admin:show-correct")}
                className="py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800"
              >
                Reveal Answer
              </button>
            )}
            <button
              onClick={() => emit("admin:next")}
              className="py-3 border border-black font-semibold rounded-lg hover:bg-gray-50"
            >
              Next Question →
            </button>
            <button
              onClick={() => emit("admin:show-scoreboard")}
              className="col-span-2 py-3 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50"
            >
              Show Final Scoreboard
            </button>
          </>
        )}

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

      {/* Join link */}
      <div className="mt-8 text-sm text-gray-400">
        Participants join at <span className="font-mono">/join</span> with code{" "}
        <span className="font-mono font-bold text-black">{sessionCode}</span>
      </div>
    </div>
  );
}
