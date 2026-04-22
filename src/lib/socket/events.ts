export interface SessionStatePayload {
  phase: "lobby" | "question_open" | "question_locked" | "results" | "final";
  currentQuestionIndex: number;
  totalQuestions: number;
  answersVisible: boolean;
  correctRevealed: boolean;
  timeLimit: number | null;
  questionOpenedAt: number | null;
  question: {
    id: string;
    title: string;
    description: string | null;
    type: "binary" | "single" | "multi";
    points: number;
  } | null;
  choices: { id: string; text: string }[];
  mySubmission: string[] | null; // choiceIds submitted by this participant
}

export interface SubmitRejectedPayload {
  questionId: string;
  reason: "time_expired";
}

export interface ResultsPayload {
  questionId: string;
  distribution: { choiceId: string; count: number }[];
}

export interface ResponseCountPayload {
  questionId: string;
  count: number;
  total: number;
  correctCount?: number;
}

export interface CorrectPayload {
  questionId: string;
  correctChoiceIds: string[];
  participantResult: { isCorrect: boolean; pointsEarned: number } | null;
}

export interface ScoreboardPayload {
  rankings: {
    participantId: string;
    displayName: string;
    score: number;
    correctCount: number;
    rank: number;
  }[];
}

export interface AdminStatePayload {
  sessionId: string;
  phase: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  answersVisible: boolean;
  correctRevealed: boolean;
  status: string;
  participantCount: number;
  responseCount: number;
  totalParticipants: number;
  timeLimit: number | null;
  questionOpenedAt: number | null;
  question: {
    id: string;
    title: string;
    type: string;
    points: number;
  } | null;
  participantList?: { id: string; displayName: string }[];
  // Populated on question_locked / results phases so the admin presenter can
  // render the per-choice distribution and discuss it with the room.
  choices?: { id: string; text: string; isCorrect: boolean }[];
  distribution?: { choiceId: string; count: number }[];
  correctResponseCount?: number;
}

// Client -> Server
export interface ParticipantJoinPayload {
  sessionCode: string;
  displayName: string;
  participantId?: string;
}

export interface ParticipantSubmitPayload {
  questionId: string;
  choiceIds: string[];
}

export interface AdminJoinPayload {
  sessionId: string;
}

export interface AdminActionPayload {
  sessionId: string;
}
