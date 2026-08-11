"use client";

import { useState } from "react";
import { QuestionCreator } from "./question-creator";
import { QuestionViewer } from "./question-viewer";
import type { QuestionResponse } from "../lib/question-api";

export function QuestionsWorkspace() {
  const [activeQuestionId, setActiveQuestionId] = useState("");

  function handleCreated(question: QuestionResponse) {
    setActiveQuestionId(question.id);
  }

  return (
    <div className="workspaceGrid">
      <QuestionCreator onCreated={handleCreated} />
      <QuestionViewer initialQuestionId={activeQuestionId} />
    </div>
  );
}
