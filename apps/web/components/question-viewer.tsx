"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getQuestion,
  getQuestionThumbnailBlob,
  getQuestionVideoBlob,
  type QuestionAsset,
  type QuestionResponse,
  type QuestionType,
  uploadQuestionThumbnail,
  uploadQuestionVideo,
} from "../lib/question-api";

type MediaState = {
  loading: boolean;
  error: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

type QuestionViewerProps = {
  initialQuestionId?: string;
};

function describeAsset(asset: QuestionAsset | null | undefined) {
  if (!asset) return "No asset uploaded yet";
  return `${asset.mimeType} - ${(asset.size / 1024 / 1024).toFixed(2)} MB`;
}

function sectionTitle(type: QuestionType) {
  if (type === "VIDEO") return "Video question";
  if (type === "MULTIPLE_CHOICE") return "Multiple choice question";
  return "Short answer question";
}

export function QuestionViewer({ initialQuestionId = "" }: QuestionViewerProps) {
  const [questionId, setQuestionId] = useState(initialQuestionId);
  const [submittedId, setSubmittedId] = useState(initialQuestionId);
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaState>({
    loading: false,
    error: null,
    videoUrl: null,
    thumbnailUrl: null,
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  useEffect(() => {
    setQuestionId(initialQuestionId);
    setSubmittedId(initialQuestionId);
  }, [initialQuestionId]);

  useEffect(() => {
    if (!submittedId) {
      setQuestion(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await getQuestion(submittedId);
        if (!cancelled) {
          setQuestion(loaded);
        }
      } catch (caught) {
        if (!cancelled) {
          setQuestion(null);
          setError(caught instanceof Error ? caught.message : "Failed to load question");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [submittedId]);

  useEffect(() => {
    if (!question) {
      setMedia({
        loading: false,
        error: null,
        videoUrl: null,
        thumbnailUrl: null,
      });
      return;
    }

    const currentQuestion = question;
    let cancelled = false;
    const objectUrls: string[] = [];
    const assets = currentQuestion.item as { video?: QuestionAsset | null; thumbnail?: QuestionAsset | null };

    async function loadMedia() {
      setMedia((current) => ({ ...current, loading: true, error: null }));
      try {
        const next: MediaState = {
          loading: false,
          error: null,
          videoUrl: null,
          thumbnailUrl: null,
        };

        if (currentQuestion.type === "VIDEO" && assets.video) {
          const videoBlob = await getQuestionVideoBlob(currentQuestion.id);
          next.videoUrl = URL.createObjectURL(videoBlob);
          objectUrls.push(next.videoUrl);
        }

        if (currentQuestion.type === "VIDEO" && assets.thumbnail) {
          const thumbnailBlob = await getQuestionThumbnailBlob(currentQuestion.id);
          next.thumbnailUrl = URL.createObjectURL(thumbnailBlob);
          objectUrls.push(next.thumbnailUrl);
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

  const questionSummary = useMemo(() => {
    if (!question) return null;
    return sectionTitle(question.type);
  }, [question]);

  async function handleVideoUpload(file: File | null) {
    if (!question || !file) return;
    setUploadingVideo(true);
    try {
      await uploadQuestionVideo(question.id, file);
      const refreshed = await getQuestion(question.id);
      setQuestion(refreshed);
      setSubmittedId(refreshed.id);
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleThumbnailUpload(file: File | null) {
    if (!question || !file) return;
    setUploadingThumbnail(true);
    try {
      await uploadQuestionThumbnail(question.id, file);
      const refreshed = await getQuestion(question.id);
      setQuestion(refreshed);
      setSubmittedId(refreshed.id);
    } finally {
      setUploadingThumbnail(false);
    }
  }

  const currentQuestion = question;

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">View question</span>
          <h2>Lookup by question ID</h2>
        </div>
        <p>
          Load one question at a time, inspect its data, and upload or preview media for video questions.
        </p>
      </div>

      <form
        className="lookupBar"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedId(questionId.trim());
        }}
      >
        <input
          value={questionId}
          onChange={(event) => setQuestionId(event.target.value)}
          placeholder="Paste a questionId here"
        />
        <button className="primaryButton" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Load question"}
        </button>
      </form>

      <div className="feedbackArea">
        {!submittedId && <div className="stateCard emptyStateInline">Enter a question ID to load a record.</div>}
        {loading && <div className="stateCard">Loading question...</div>}
        {error && <div className="stateCard errorState">Error: {error}</div>}
        {!loading && !error && !question && submittedId && (
          <div className="stateCard emptyStateInline">No question returned for that ID.</div>
        )}
      </div>

      {currentQuestion && (
        <div className="questionDetail">
          <div className="detailHeader">
            <div>
              <span className="sectionLabel">{questionSummary}</span>
              <h3>{currentQuestion.title}</h3>
            </div>
            <div className="pillRow">
              <span className="pill">{currentQuestion.type}</span>
            </div>
          </div>

          <div className="detailGrid">
            <div className="detailCard">
              <strong>Core fields</strong>
              <dl>
                <div><dt>ID</dt><dd>{currentQuestion.id}</dd></div>
                <div><dt>Description</dt><dd>{currentQuestion.description ?? "No description"}</dd></div>
                <div><dt>Created</dt><dd>{new Date(currentQuestion.createdAt).toLocaleString()}</dd></div>
                <div><dt>Updated</dt><dd>{new Date(currentQuestion.updatedAt).toLocaleString()}</dd></div>
              </dl>
            </div>

            <div className="detailCard">
              <strong>Item payload</strong>
              <pre>{JSON.stringify(currentQuestion.item, null, 2)}</pre>
            </div>
          </div>

          {currentQuestion.type === "VIDEO" && (
            <div className="mediaGrid">
              <div className="detailCard">
                <strong>Video</strong>
                <p>{describeAsset((currentQuestion.item as { video?: QuestionAsset | null }).video)}</p>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  onChange={(event) => void handleVideoUpload(event.target.files?.[0] ?? null)}
                />
                {uploadingVideo && <div className="inlineStatus">Uploading video...</div>}
                {media.error && <div className="inlineStatus errorText">Media error: {media.error}</div>}
                {media.videoUrl ? (
                  <video className="mediaFrame" controls src={media.videoUrl} />
                ) : (
                  <div className="mediaEmpty">No video preview available.</div>
                )}
              </div>

              <div className="detailCard">
                <strong>Thumbnail</strong>
                <p>{describeAsset((currentQuestion.item as { thumbnail?: QuestionAsset | null }).thumbnail)}</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void handleThumbnailUpload(event.target.files?.[0] ?? null)}
                />
                {uploadingThumbnail && <div className="inlineStatus">Uploading thumbnail...</div>}
                {media.thumbnailUrl ? (
                  <img className="mediaFrame imageFrame" src={media.thumbnailUrl} alt="Question thumbnail" />
                ) : (
                  <div className="mediaEmpty">No thumbnail preview available.</div>
                )}
              </div>
            </div>
          )}

          {currentQuestion.type === "MULTIPLE_CHOICE" && (
            <div className="detailCard">
              <strong>Options</strong>
              <div className="optionSummary">
                <span>
                  Multiple selection: {(currentQuestion.item as { allowMultipleSelection?: boolean }).allowMultipleSelection ? "Yes" : "No"}
                </span>
                <span>
                  Shuffle: {(currentQuestion.item as { shuffleOptions?: boolean }).shuffleOptions ? "Yes" : "No"}
                </span>
              </div>
              <ul className="dataList">
                {((currentQuestion.item as { options?: Array<{ label: string; value: string; order: number; isCorrect: boolean }> }).options ?? []).map((option) => (
                  <li key={`${option.order}-${option.value}`}>
                    <strong>{option.label}</strong>
                    <span>{option.value}</span>
                    <small>Order {option.order} - {option.isCorrect ? "Correct" : "Incorrect"}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentQuestion.type === "SHORT_ANSWER" && (
            <div className="detailCard">
              <strong>Short answer settings</strong>
              <dl>
                <div><dt>Placeholder</dt><dd>{(currentQuestion.item as { placeholder?: string | null }).placeholder ?? "None"}</dd></div>
                <div><dt>Max length</dt><dd>{(currentQuestion.item as { maxLength?: number | null }).maxLength ?? "Unlimited"}</dd></div>
                <div><dt>Answer hint</dt><dd>{(currentQuestion.item as { answerHint?: string | null }).answerHint ?? "None"}</dd></div>
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
