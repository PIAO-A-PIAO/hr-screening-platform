"use client";

import { useRouter } from "next/navigation";
import { QuestionCreator } from "./question-creator";
import type { QuestionResponse } from "../lib/question-api";

export function QuestionCreateRoute() {
  const router = useRouter();

  function handleCreated(question: QuestionResponse) {
    router.push(`/questions/view?questionId=${encodeURIComponent(question.id)}`);
  }

  return (
    <QuestionCreator onCreated={handleCreated} />
  );
}
