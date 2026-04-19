import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  timeLimit: integer("time_limit"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["binary", "single", "multi"] }).notNull(),
  points: integer("points").notNull().default(1),
  order: integer("order").notNull(),
});

export const choices = sqliteTable("choices", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: integer("is_correct").notNull().default(0),
  order: integer("order").notNull(),
});

export const liveSessions = sqliteTable("live_sessions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id),
  code: text("code").notNull().unique(),
  status: text("status", { enum: ["active", "finished"] })
    .notNull()
    .default("active"),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  phase: text("phase", {
    enum: ["lobby", "question_open", "question_locked", "results", "final"],
  })
    .notNull()
    .default("lobby"),
  answersVisible: integer("answers_visible").notNull().default(0),
  correctRevealed: integer("correct_revealed").notNull().default(0),
  questionOpenedAt: integer("question_opened_at"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  finishedAt: integer("finished_at"),
});

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => liveSessions.id),
  displayName: text("display_name").notNull(),
  joinedAt: integer("joined_at").notNull().$defaultFn(() => Date.now()),
});

export const responses = sqliteTable(
  "responses",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => liveSessions.id),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id),
    choiceIds: text("choice_ids").notNull(),
    isCorrect: integer("is_correct"),
    pointsEarned: integer("points_earned"),
    submittedAt: integer("submitted_at").notNull().$defaultFn(() => Date.now()),
  },
  (t) => [
    uniqueIndex("responses_participant_session_question_idx").on(
      t.participantId,
      t.sessionId,
      t.questionId
    ),
  ]
);

// Inferred TypeScript types
export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export type Choice = typeof choices.$inferSelect;
export type NewChoice = typeof choices.$inferInsert;

export type LiveSession = typeof liveSessions.$inferSelect;
export type NewLiveSession = typeof liveSessions.$inferInsert;

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;

export type Response = typeof responses.$inferSelect;
export type NewResponse = typeof responses.$inferInsert;
