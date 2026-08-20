"use client";

import { useEffect, useState } from "react";
import { VideoRecordingRoute } from "./video-recording-route";
import {
  getQuestionThumbnailBlob,
  getQuestionVideoBlob,
  type QuestionAsset,
  type QuestionResponse,
} from "../lib/question-api";

export type CandidateAnswer = {
  text: string;
  selectedValues: string[];
};

type QuestionAnswererProps = {
  question: QuestionResponse;
  value: CandidateAnswer;
  onChange: (nextValue: CandidateAnswer) => void;
  compact?: boolean;
  videoMode?: "text" | "record";
  onVideoRecordingReady?: (file: File | null) => void;
};

type MediaState = {
  loading: boolean;
  error: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

type MultipleChoiceOption = {
  label: string;
  value: string;
  order: number;
};

function describeAsset(asset: QuestionAsset | null | undefined) {
  if (!asset) return "No asset uploaded yet";
  return `${asset.mimeType} - ${(asset.size / 1024 / 1024).toFixed(2)} MB`;
}

function stableRank(seed: string, value: string) {
  let hash = 2166136261;
  const input = `${seed}:${value}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function orderMultipleChoiceOptions(
  questionId: string,
  options: MultipleChoiceOption[],
  shuffleOptions: boolean,
) {
  const next = [...options].sort((left, right) => left.order - right.order);

  if (!shuffleOptions) {
    return next;
  }

  return next.sort((left, right) => {
    const leftRank = stableRank(questionId, left.value);
    const rightRank = stableRank(questionId, right.value);
    return leftRank - rightRank;
  });
}

export function createEmptyAnswer(): CandidateAnswer {
  return {
    text: "",
    selectedValues: [],
  };
}

export function QuestionAnswerer({
  question,
  value,
  onChange,
  compact = false,
  videoMode = "text",
  onVideoRecordingReady,
}: QuestionAnswererProps) {
  const [media, setMedia] = useState<MediaState>({
    loading: false,
    error: null,
    videoUrl: null,
    thumbnailUrl: null,
  });

  useEffect(() => {
    if (question.type !== "VIDEO") {
      setMedia({
        loading: false,
        error: null,
        videoUrl: null,
        thumbnailUrl: null,
      });
      return;
    }

    const assets = question.item as {
      video?: QuestionAsset | null;
      thumbnail?: QuestionAsset | null;
    };

    let cancelled = false;
    const objectUrls: string[] = [];

    async function loadMedia() {
      setMedia((current) => ({ ...current, loading: true, error: null }));

      try {
        const next: MediaState = {
          loading: false,
          error: null,
          videoUrl: null,
          thumbnailUrl: null,
        };

        if (assets.thumbnail) {
          const thumbnailBlob = await getQuestionThumbnailBlob(question.id);
          next.thumbnailUrl = URL.createObjectURL(thumbnailBlob);
          objectUrls.push(next.thumbnailUrl);
        }

        if (assets.video) {
          const videoBlob = await getQuestionVideoBlob(question.id);
          next.videoUrl = URL.createObjectURL(videoBlob);
          objectUrls.push(next.videoUrl);
        }

        if (!cancelled) {
          setMedia(next);
        }
      } catch (caught) {
        if (!cancelled) {
          setMedia({
            loading: false,
            error: caught instanceof Error ? caught.message : "Failed to load media",
            videoUrl: null,
            thumbnailUrl: null,
          });
        }
      }
    }

    void loadMedia();

    return () => {
      cancelled = true;
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [question]);

  const multipleChoiceItem = question.item as {
    allowMultipleSelection?: boolean;
    shuffleOptions?: boolean;
    options?: MultipleChoiceOption[];
  };

  const shortAnswerItem = question.item as {
    placeholder?: string | null;
    maxLength?: number | null;
  };

  const videoItem = question.item as {
    video?: QuestionAsset | null;
    thumbnail?: QuestionAsset | null;
  };

  const orderedOptions = orderMultipleChoiceOptions(
    question.id,
    multipleChoiceItem.options ?? [],
    multipleChoiceItem.shuffleOptions === true,
  );

  function updateText(nextText: string) {
    onChange({
      ...value,
      text: nextText,
    });
  }

  function toggleOption(optionValue: string, checked: boolean) {
    if (multipleChoiceItem.allowMultipleSelection === true) {
      const nextValues = checked
        ? [...value.selectedValues, optionValue]
        : value.selectedValues.filter((currentValue) => currentValue !== optionValue);
      onChange({
        ...value,
        selectedValues: nextValues,
      });
      return;
    }

    onChange({
      ...value,
      selectedValues: checked ? [optionValue] : [],
    });
  }

  return (
    <section className={compact ? "candidateQuestion compactCandidateQuestion" : "candidateQuestion"}>
      <div className="questionPromptHeader">
        <div>
          <span className="sectionLabel">Candidate view</span>
          <h2>{question.title}</h2>
        </div>
        <span className="pill">
          {question.type === "VIDEO"
            ? "Watch and respond"
            : question.type === "MULTIPLE_CHOICE"
              ? "Choose your answer"
              : "Write your response"}
        </span>
      </div>

      {question.description ? (
        <p className="candidatePrompt">{question.description}</p>
      ) : (
        <p className="candidatePrompt mutedPrompt">No extra prompt was provided for this question.</p>
      )}

      {question.type === "VIDEO" && (
        <div className="answerPanel candidateMediaPanel">
          <strong>Prompt media</strong>
          <p>{describeAsset(videoItem.video)}</p>
          {media.error && <div className="inlineStatus errorText">Media error: {media.error}</div>}
          {media.loading && <div className="inlineStatus">Loading prompt media...</div>}
          {media.thumbnailUrl && (
            <img className="mediaFrame imageFrame" src={media.thumbnailUrl} alt="Question thumbnail" />
          )}
          {media.videoUrl ? (
            <video className="mediaFrame" controls playsInline src={media.videoUrl} />
          ) : (
            <div className="mediaEmpty">No video preview available.</div>
          )}
        </div>
      )}

      <div className="answerPanel">
        {question.type === "MULTIPLE_CHOICE" && (
          <>
            <strong>Choose one or more options</strong>
            <div className="optionSummary">
              <span>
                {multipleChoiceItem.allowMultipleSelection
                  ? "Multiple answers allowed"
                  : "Single answer only"}
              </span>
              <span>
                {multipleChoiceItem.shuffleOptions
                  ? "Options are presented in candidate order"
                  : "Options keep their authoring order"}
              </span>
            </div>
            <div className="answerOptionList">
              {orderedOptions.map((option) => {
                const selected = value.selectedValues.includes(option.value);
                const inputType = multipleChoiceItem.allowMultipleSelection ? "checkbox" : "radio";
                return (
                  <label
                    className={selected ? "answerOption selected" : "answerOption"}
                    key={`${option.order}-${option.value}`}
                  >
                    <input
                      type={inputType}
                      name={
                        multipleChoiceItem.allowMultipleSelection ? undefined : `question-${question.id}`
                      }
                      checked={selected}
                      onChange={(event) => toggleOption(option.value, event.target.checked)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.value}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {question.type !== "MULTIPLE_CHOICE" && question.type !== "VIDEO" && (
          <>
            <strong>Your response</strong>
            <textarea
              rows={compact ? 4 : 6}
              value={value.text}
              onChange={(event) => updateText(event.target.value)}
              placeholder={shortAnswerItem.placeholder ?? "Type your response here"}
              maxLength={shortAnswerItem.maxLength ?? undefined}
            />
            {question.type === "SHORT_ANSWER" && shortAnswerItem.maxLength ? (
              <div className="helperText">
                Maximum length: {shortAnswerItem.maxLength} characters.
              </div>
            ) : null}
          </>
        )}

        {question.type === "VIDEO" && videoMode === "record" && (
          <VideoRecordingRoute onRecordingReady={onVideoRecordingReady} />
        )}

        {question.type === "VIDEO" && videoMode === "text" && (
          <>
            <strong>Your response</strong>
            <textarea
              rows={compact ? 4 : 6}
              value={value.text}
              onChange={(event) => updateText(event.target.value)}
              placeholder="Summarize your response here."
            />
            <div className="helperText">
              This preview mode keeps the response local. The candidate attempt flow can record and upload video.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
