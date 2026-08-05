import { z } from "zod";

export const questionTypes = [
  "SINGLE_CHOICE",
  "MULTI_SELECT",
  "TEXT",
  "FILL_BLANK",
  "VIDEO",
] as const;

export const createJobSchema = z.object({
  title: z.string().min(2).max(150),
  department: z.string().min(2).max(100),
  location: z.string().max(150).optional(),
  description: z.string().min(10),
});

export const createQuestionSchema = z.object({
  type: z.enum(questionTypes),
  prompt: z.string().min(3),
  helpText: z.string().optional(),
  promptMediaUrl: z.string().url().optional().or(z.literal("")),
  promptMediaType: z.enum(["IMAGE", "VIDEO"]).optional(),
  options: z.array(z.string().min(1)).optional(),
  weight: z.number().positive().max(100),
  required: z.boolean().default(true),
  preparationSeconds: z.number().int().min(0).max(600).optional(),
  answerSeconds: z.number().int().min(5).max(1800).optional(),
  maxRetries: z.number().int().min(0).max(10).default(0),
});

export const ratingSchema = z.object({
  answerId: z.string().min(1),
  questionId: z.string().min(1),
  rating: z.number().min(0).max(5).refine((value) => value * 2 === Math.round(value * 2), {
    message: "Rating must use 0.5 increments",
  }),
  note: z.string().max(5000).optional(),
  transcript: z.string().max(20000).optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type RatingInput = z.infer<typeof ratingSchema>;
