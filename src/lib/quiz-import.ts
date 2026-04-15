export interface ImportedChoice {
  text: string;
  isCorrect: boolean;
}

export interface ImportedQuestion {
  title: string;
  description?: string;
  type: "binary" | "single" | "multi";
  points?: number;
  choices: ImportedChoice[];
}

export interface ImportedQuiz {
  title: string;
  description?: string;
  questions: ImportedQuestion[];
}

export function validateImportedQuiz(data: unknown): ImportedQuiz {
  if (typeof data !== "object" || data === null) {
    throw new Error("Quiz must be an object");
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== "string" || obj.title.trim() === "") {
    throw new Error("Quiz title is required");
  }

  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    throw new Error("Quiz must have at least one question");
  }

  const questions: ImportedQuestion[] = obj.questions.map((q: unknown, qi: number) => {
    if (typeof q !== "object" || q === null) throw new Error(`Question ${qi} must be an object`);
    const qObj = q as Record<string, unknown>;

    if (typeof qObj.title !== "string" || qObj.title.trim() === "") {
      throw new Error(`Question ${qi} title is required`);
    }
    if (!["binary", "single", "multi"].includes(qObj.type as string)) {
      throw new Error(`Question ${qi} type must be binary, single, or multi`);
    }
    if (!Array.isArray(qObj.choices) || qObj.choices.length < 2) {
      throw new Error(`Question ${qi} must have at least 2 choices`);
    }

    const choices: ImportedChoice[] = qObj.choices.map((c: unknown, ci: number) => {
      if (typeof c !== "object" || c === null) throw new Error(`Choice ${qi}.${ci} must be an object`);
      const cObj = c as Record<string, unknown>;
      if (typeof cObj.text !== "string" || cObj.text.trim() === "") {
        throw new Error(`Choice ${qi}.${ci} text is required`);
      }
      return { text: cObj.text, isCorrect: Boolean(cObj.isCorrect) };
    });

    return {
      title: qObj.title as string,
      description: typeof qObj.description === "string" ? qObj.description : undefined,
      type: qObj.type as "binary" | "single" | "multi",
      points: typeof qObj.points === "number" ? qObj.points : 1,
      choices,
    };
  });

  return {
    title: obj.title as string,
    description: typeof obj.description === "string" ? obj.description : undefined,
    questions,
  };
}
