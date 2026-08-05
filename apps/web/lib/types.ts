export type QuestionType = "SINGLE_CHOICE" | "MULTI_SELECT" | "TEXT" | "FILL_BLANK" | "VIDEO";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  helpText?: string | null;
  promptMediaUrl?: string | null;
  promptMediaType?: "IMAGE" | "VIDEO" | null;
  options?: string[] | null;
  weight: number;
  required: boolean;
  preparationSeconds?: number | null;
  answerSeconds?: number | null;
  maxRetries: number;
  sortOrder: number;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location?: string | null;
  description: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  candidateCount?: number;
  questionCount?: number;
  template?: { id: string; title: string; welcomeText: string; isPublished: boolean; questions: Question[] } | null;
  applications?: Application[];
}

export interface Answer {
  id: string;
  questionId: string;
  question: Question;
  textValue?: string | null;
  jsonValue?: string[] | null;
  mediaUrl?: string | null;
  transcript?: string | null;
  ratings?: Array<{ rating: number; note?: string; review: { reviewer: { name: string } } }>;
}

export interface Application {
  id: string;
  status: string;
  inviteToken: string;
  expiresAt: string;
  submittedAt?: string | null;
  collectiveScore?: number | null;
  candidate: { id: string; firstName: string; lastName: string; email: string };
  job?: Job;
  answers?: Answer[];
  currentReview?: { id: string; overallNotes?: string; ratings: Array<{ answerId: string; rating: number; note?: string }> } | null;
}
