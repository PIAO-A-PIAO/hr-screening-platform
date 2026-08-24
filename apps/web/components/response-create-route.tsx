"use client";

import { FormEvent, useState } from "react";
import { getQuestion, type QuestionResponse } from "../lib/question-api";
import {
  createResponse,
  getResponse,
  uploadResponseVideo,
  type ResponseRecord,
} from "../lib/response-api";
import { VideoRecordingRoute } from "./video-recording-route";

type ChoiceOption = {
  id: string;
  label: string;
  value: string;
  order: number;
};

export function ResponseCreateRoute() {
  const [userId, setUserId] = useState("");
  const [testId, setTestId] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [textValue, setTextValue] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [created, setCreated] = useState<ResponseRecord | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQuestion() {
    if (!questionId.trim()) {
      setError("Question ID is required.");
      return;
    }
    setLoadingQuestion(true);
    setError(null);
    setCreated(null);
    setUploadPending(false);
    try {
      const loaded = await getQuestion(questionId.trim());
      setQuestion(loaded);
      setTextValue("");
      setSelectedOptionIds([]);
      setRecordingFile(null);
    } catch (caught) {
      setQuestion(null);
      setError(caught instanceof Error ? caught.message : "Failed to load question");
    } finally {
      setLoadingQuestion(false);
    }
  }

  function toggleOption(optionId: string, checked: boolean, allowMultiple: boolean) {
    setSelectedOptionIds((current) => {
      if (!allowMultiple) return checked ? [optionId] : [];
      return checked
        ? [...new Set([...current, optionId])]
        : current.filter((currentId) => currentId !== optionId);
    });
  }

  async function retryVideoUpload() {
    if (!created || !recordingFile) return;
    setSubmitting(true);
    setError(null);
    try {
      await uploadResponseVideo(created.id, recordingFile, inviteToken.trim());
      setUploadPending(false);
      setCreated(await getResponse(created.id, inviteToken.trim()));
    } catch (caught) {
      setUploadPending(true);
      setError(caught instanceof Error ? caught.message : "Video upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question) {
      setError("Load a question before submitting a response.");
      return;
    }
    if (!userId.trim() || !testId.trim() || !inviteToken.trim()) {
      setError("Candidate ID, test ID, and invite token are required.");
      return;
    }
    if (question.type === "VIDEO" && !recordingFile) {
      setError("Record a video before creating this response.");
      return;
    }

    const item = question.type === "MULTIPLE_CHOICE"
      ? { selectedOptionIds }
      : question.type === "SHORT_ANSWER"
        ? { textValue }
        : {};

    setSubmitting(true);
    setError(null);
    setCreated(null);
    setUploadPending(false);
    try {
      const response = await createResponse({
        type: question.type,
        questionId: question.id,
        userId: userId.trim(),
        testId: testId.trim(),
        item,
      }, inviteToken.trim());
      setCreated(response);

      if (question.type === "VIDEO" && recordingFile) {
        try {
          await uploadResponseVideo(response.id, recordingFile, inviteToken.trim());
        } catch (caught) {
          setUploadPending(true);
          setError(
            `The response record was saved, but the video upload failed: ${caught instanceof Error ? caught.message : "unknown error"}`,
          );
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create response");
    } finally {
      setSubmitting(false);
    }
  }

  const choiceItem = question?.item as {
    allowMultipleSelection?: boolean;
    options?: ChoiceOption[];
  } | undefined;
  const shortItem = question?.item as { maxLength?: number | null; placeholder?: string | null } | undefined;
  const options = [...(choiceItem?.options ?? [])].sort((left, right) => left.order - right.order);

  return (
    <section className="panel candidateAnswerShell">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Milestone 5</span>
          <h2>Create a candidate response</h2>
        </div>
        <p>The API verifies the invitation, assignment, test, question, and response type before saving.</p>
      </div>

      <div className="formGrid">
        <label className="field">
          <span>Candidate user ID</span>
          <input value={userId} onChange={(event) => setUserId(event.target.value)} />
        </label>
        <label className="field">
          <span>Test ID</span>
          <input value={testId} onChange={(event) => setTestId(event.target.value)} />
        </label>
        <label className="field">
          <span>Question ID</span>
          <input value={questionId} onChange={(event) => setQuestionId(event.target.value)} />
        </label>
        <label className="field">
          <span>Invite token</span>
          <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} />
        </label>
      </div>

      <div className="actionsRow">
        <button className="ghostButton" type="button" onClick={() => void loadQuestion()} disabled={loadingQuestion}>
          {loadingQuestion ? "Loading..." : "Load question"}
        </button>
      </div>

      {question && (
        <form onSubmit={(event) => void submit(event)}>
          <div className="detailCard">
            <span className="pill">{question.type.replaceAll("_", " ")}</span>
            <h3>{question.title}</h3>
            <p>{question.description ?? "No additional description."}</p>
          </div>

          {question.type === "MULTIPLE_CHOICE" && (
            <div className="answerPanel answerOptionList">
              {options.map((option) => {
                const allowMultiple = choiceItem?.allowMultipleSelection === true;
                return (
                  <label className={selectedOptionIds.includes(option.id) ? "answerOption selected" : "answerOption"} key={option.id}>
                    <input
                      type={allowMultiple ? "checkbox" : "radio"}
                      name={allowMultiple ? undefined : "response-option"}
                      checked={selectedOptionIds.includes(option.id)}
                      onChange={(event) => toggleOption(option.id, event.target.checked, allowMultiple)}
                    />
                    <span><strong>{option.label}</strong><small>{option.value}</small></span>
                  </label>
                );
              })}
            </div>
          )}

          {question.type === "SHORT_ANSWER" && (
            <label className="field">
              <span>Your response</span>
              <textarea
                rows={7}
                value={textValue}
                maxLength={shortItem?.maxLength ?? undefined}
                placeholder={shortItem?.placeholder ?? "Type your response"}
                onChange={(event) => setTextValue(event.target.value)}
              />
            </label>
          )}

          {question.type === "VIDEO" && <VideoRecordingRoute onRecordingReady={setRecordingFile} />}

          <div className="actionsRow">
            <button className="primaryButton" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save response"}
            </button>
            {uploadPending && (
              <button className="ghostButton" type="button" onClick={() => void retryVideoUpload()} disabled={submitting}>
                Retry video upload
              </button>
            )}
          </div>
        </form>
      )}

      {error && <div className="stateCard errorState">{error}</div>}
      {created && (
        <div className={uploadPending ? "stateCard" : "stateCard successState"}>
          <strong>{uploadPending ? "Response saved; video upload pending" : "Response saved"}</strong>
          <span>Response ID: {created.id}</span>
        </div>
      )}
    </section>
  );
}