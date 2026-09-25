"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuestionVideoBlob, getTest, type TestQuestionResponse, type TestResponse } from "../lib/question-api";
import { AttemptApiError, getAttempt, resolveInviteToken, saveAttemptResponse, startAttempt, submitAttempt, type AttemptDetailResponse } from "../lib/attempt-api";
import { uploadResponseVideo } from "../lib/response-api";
import "../styles/candidate-onair.css";

type Phase = "prompt" | "countdown" | "recording" | "uploading" | "retry";

function VideoAnswer({ question, busy, onSubmit }: {
  question: TestQuestionResponse;
  busy: boolean;
  onSubmit: (file: File) => Promise<void>;
}) {
  const promptRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef<File | null>(null);
  const stoppingRef = useRef(false);
  const interruptedRef = useRef(false);
  const activeRef = useRef(true);
  const sendingRef = useRef(false);
  const startingRef = useRef(false);
  const [promptUrl, setPromptUrl] = useState<string | null>(null);
  const [promptUnavailable, setPromptUnavailable] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [seconds, setSeconds] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  };

  useEffect(() => {
    if ((phase === "countdown" || phase === "recording") && previewRef.current && streamRef.current) {
      previewRef.current.srcObject = streamRef.current;
      void previewRef.current.play().catch(() => undefined);
    }
  }, [phase]);

  useEffect(() => {
    activeRef.current = true;
    let cancelled = false;
    let url: string | null = null;
    const hasVideo = Boolean((question.item as { video?: unknown }).video);
    if (!hasVideo) {
      setPromptUnavailable(true);
    } else {
      getQuestionVideoBlob(question.id).then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPromptUrl(url);
      }).catch(() => {
        if (!cancelled) setPromptUnavailable(true);
      });
    }
    return () => {
      cancelled = true;
      activeRef.current = false;
      interruptedRef.current = true;
      if (url) URL.revokeObjectURL(url);
      stopTimer();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
    };
  }, [question.id, question.item]);

  async function send(file: File) {
    if (!activeRef.current || sendingRef.current) return;
    sendingRef.current = true;
    pendingRef.current = file;
    setPhase("uploading");
    setError(null);
    try {
      await onSubmit(file);
      pendingRef.current = null;
    } catch (caught) {
      if (activeRef.current) {
        setPhase("retry");
        setError(caught instanceof Error ? caught.message : "Upload failed. Retry this recording.");
      }
    } finally {
      sendingRef.current = false;
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording" || stoppingRef.current) return;
    stoppingRef.current = true;
    stopTimer();
    recorder.stop();
  }

  async function beginRecording() {
    try {
      const stream = streamRef.current;
      if (!stream || typeof MediaRecorder === "undefined") throw new Error("Camera and microphone recording is unavailable.");
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      stoppingRef.current = false;
      interruptedRef.current = false;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { interruptedRef.current = true; setError("Recording was interrupted. Please try again."); stopRecording(); };
      stream.getTracks().forEach((track) => {
        track.onended = () => { interruptedRef.current = true; setError("Camera or microphone disconnected. Please record again."); stopRecording(); };
      });
      recorder.onstop = () => {
        stopStream();
        if (interruptedRef.current || !activeRef.current) { if (activeRef.current) setPhase("prompt"); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        if (!blob.size) { setPhase("prompt"); setError("No video was captured. Please try again."); return; }
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        void send(new File([blob], `answer.${extension}`, { type: blob.type }));
      };
      recorder.start(1000);
      setPhase("recording");
      setSeconds(60);
      let remaining = 60;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setSeconds(remaining);
        if (remaining <= 0) stopRecording();
      }, 1000);
    } catch (caught) {
      stopStream();
      setPhase("prompt");
      setError(caught instanceof Error ? caught.message : "Unable to start recording.");
    }
  }

  async function beginCountdown() {
    if (phase !== "prompt" || startingRef.current) return;
    startingRef.current = true;
    stopTimer();
    setPhase("countdown");
    setSeconds(3);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Camera and microphone recording requires a supported browser and HTTPS.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!activeRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        void previewRef.current.play().catch(() => undefined);
      }
    } catch (caught) {
      setPhase("prompt");
      setError(caught instanceof Error ? caught.message : "Unable to open camera and microphone.");
      startingRef.current = false;
      return;
    }
    let remaining = 3;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSeconds(remaining);
      if (remaining <= 0) { stopTimer(); startingRef.current = false; void beginRecording(); }
    }, 1000);
  }

  return <div className="onairVideo">
    {phase === "prompt" && <>
      {promptUnavailable ? <div className="onairFallback"><strong>Ready to answer</strong><p>The question video is unavailable or still processing. Read the question above, then start your video answer.</p><button type="button" className="primaryButton" onClick={() => { void beginCountdown(); }}>Start recording</button></div> : <>
        <p>Watch the question video. Recording starts after a three second countdown.</p>
        {promptUrl ? <div className="onairPromptPlayer">
          <video ref={promptRef} src={promptUrl} autoPlay playsInline onEnded={() => { void beginCountdown(); }} onError={() => setPromptUnavailable(true)} onCanPlay={() => { void promptRef.current?.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true)); }} />
          {playbackBlocked && <button type="button" className="onairPlaybackFallback" onClick={() => { void promptRef.current?.play().then(() => setPlaybackBlocked(false)).catch(() => setPromptUnavailable(true)); }}>Tap to play question video</button>}
        </div> : <p role="status">Loading question video…</p>}
        <button type="button" className="onairTextButton" onClick={() => setPromptUnavailable(true)}>Continue with the written question</button>
      </>}
    </>}
    {(phase === "countdown" || phase === "recording" || phase === "uploading") && <>
      <div className="onairAnswerPlayer">
        <video ref={previewRef} muted autoPlay playsInline className="onairPreview" />
        {phase === "countdown" && <div className="onairCountdown" aria-live="polite">Recording in {seconds}</div>}
      </div>
      {phase === "recording" && <>
        <div className="onairTimer" aria-live="off">Recording · {seconds}s remaining</div>
        <button type="button" className="primaryButton" onClick={stopRecording}>Submit recording</button>
      </>}
      {phase === "uploading" && <p role="status">Saving your recording…</p>}
    </>}
    {phase === "retry" && <div className="onairRetry"><p>Your recording is still in this tab. Keep it open and retry the save.</p><button type="button" className="primaryButton" disabled={busy} onClick={() => { if (pendingRef.current) void send(pendingRef.current); }}>Retry save</button></div>}
    {error && <p className="onairError" role="alert">{error}</p>}
  </div>;
}

export function CandidateOnAir({ testId, inviteToken }: { testId: string; inviteToken: string }) {
  const router = useRouter();
  const [test, setTest] = useState<TestResponse | null>(null);
  const [attempt, setAttempt] = useState<AttemptDetailResponse | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const invitation = await resolveInviteToken(inviteToken);
      if (invitation.testId !== testId) throw new Error("This invitation does not belong to this interview.");
      const loadedTest = await getTest(testId);
      let detail: AttemptDetailResponse;
      try {
        const started = await startAttempt({ userId: invitation.userId, testId }, inviteToken);
        detail = await getAttempt(started.id, inviteToken);
      } catch (caught) {
        if (caught instanceof AttemptApiError && caught.status === 409 && caught.message === "Attempt already submitted") {
          router.replace(`/interview/${encodeURIComponent(inviteToken)}`);
          return;
        }
        throw caught;
      }
      if (cancelled) return;
      const saved = new Set(detail.responses
        .filter((response) => response.type !== "VIDEO" || Boolean(response.item.video))
        .map((response) => response.questionId));
      setTest(loadedTest);
      setAttempt(detail);
      setAnswered(saved);
      setShowIntro(saved.size === 0);
      const next = loadedTest.questions.findIndex((question) => !saved.has(question.id));
      setIndex(next < 0 ? loadedTest.questions.length : next);
    })().catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to open interview."); });
    return () => { cancelled = true; };
  }, [testId, inviteToken, router]);

  const finish = useCallback(async (attemptId: string) => {
    try {
      await submitAttempt(attemptId, inviteToken);
    } catch (caught) {
      if (!(caught instanceof AttemptApiError && caught.status === 409 && caught.message === "Attempt already submitted")) throw caught;
    }
    router.replace(`/interview/${encodeURIComponent(inviteToken)}`);
  }, [inviteToken, router]);

  async function save(question: TestQuestionResponse, item: Record<string, unknown>, file?: File) {
    if (!attempt || !test || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await saveAttemptResponse(attempt.id, {
        type: question.type, questionId: question.id, userId: attempt.userId, testId: attempt.testId, item,
      }, inviteToken);
      if (file) await uploadResponseVideo(response.id, file, inviteToken);
      setAnswered((current) => new Set(current).add(question.id));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save this answer.";
      setError(message);
      throw caught;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (!test || !attempt) return <main className="onairShell"><div className={error ? "onairError" : ""} role={error ? "alert" : "status"}>{error ?? "Loading your interview…"}</div></main>;
  const configuredTime = test.estimatedDurationMinutes;
  const estimatedTime = Math.max(1, Math.ceil(test.questions.reduce((seconds, entry) => {
    if (entry.type === "SHORT_ANSWER") return seconds + 120;
    if (entry.type === "MULTIPLE_CHOICE") return seconds + 60;
    const video = (entry.item as { video?: { durationSeconds?: number | null } }).video;
    return seconds + 63 + (video?.durationSeconds ?? 0);
  }, 0) / 60));
  const displayMinutes = configuredTime && configuredTime > 0 ? configuredTime : estimatedTime;
  if (showIntro) return <main className="onairShell">
    <header className="onairHeader"><span>Digital Shovel · Interview</span><strong>{test.name}</strong></header>
    <section className="onairCard onairIntroduction">
      <span className="onairEyebrow">Before you begin</span>
      <h1>What to expect in this interview</h1>
      <div className="onairIntroStats"><div><strong>{test.questions.length}</strong><span>Total questions</span></div><div><strong>{displayMinutes} min</strong><span>{configuredTime ? "Expected total time" : "Estimated total time"}</span></div></div>
      <p>You will answer each question in order. Submit an answer to unlock the next question.</p>
      <div className="onairRuleGrid">
        <article><span aria-hidden="true">A</span><h2>Multiple choice</h2><p>Choose one of four options and submit your selection.</p></article>
        <article><span aria-hidden="true">✎</span><h2>Short answer</h2><p>Type your response within the character limit shown for that question.</p></article>
        <article><span aria-hidden="true">●</span><h2>Video answer</h2><p>Watch the prompt if one is available. After a three-second countdown, recording starts automatically and lasts up to 60 seconds. You can submit early.</p></article>
      </div>
      <p className="onairIntroNote">If you cheat, your application will be cancelled. Keep this tab open while answers save. Refreshing resumes at the first unsaved question.</p>
      {!configuredTime && <small>The total time is an estimate. Only video recording has a 60-second limit per answer.</small>}
      <button type="button" className="primaryButton" onClick={() => setShowIntro(false)}>Start interview</button>
    </section>
  </main>;
  const question = test.questions[index];
  const options = question?.type === "MULTIPLE_CHOICE" ? (question.item as {
    options?: { id: string; label: string; value: string; order: number }[];
  }) : null;
  const maxLength = question?.type === "SHORT_ANSWER" ? (question.item as { maxLength?: number }).maxLength : undefined;
  const currentSaved = Boolean(question && answered.has(question.id));
  const nextIndex = test.questions.findIndex((entry, at) => at > index && !answered.has(entry.id));

  return <main className="onairShell">
    <header className="onairHeader"><span>Digital Shovel · Interview</span><strong>{test.name}</strong></header>
    <div className="onairProgress"><span>{answered.size} of {test.questions.length} saved</span><progress max={test.questions.length || 1} value={answered.size} /></div>
    {error && <p className="onairError" role="alert">{error}</p>}
    {question ? <section className="onairCard" key={question.id}>
      <span className="onairEyebrow">Question {index + 1} of {test.questions.length}</span>
      <h1 className="onairQuestionTitle">{question.title}</h1>
      <div className="onairMainQuestion"><span>Main question</span><p>{question.description?.trim() || question.title}</p></div>
      {currentSaved ? <div className="onairSavedStep" role="status"><strong>Answer saved</strong><p>Your response is saved. Continue when you are ready.</p><button type="button" className="primaryButton" disabled={busy} onClick={() => {
        if (nextIndex >= 0) { setIndex(nextIndex); setSelected([]); setText(""); setError(null); }
        else { setBusy(true); void finish(attempt.id).catch((caught: unknown) => { setError(caught instanceof Error ? caught.message : "Unable to submit interview."); setBusy(false); }); }
      }}>{nextIndex >= 0 ? "Next question" : busy ? "Submitting…" : "Finish interview"}</button></div> : <>
      {question.type === "VIDEO" && <VideoAnswer question={question} busy={busy} onSubmit={(file) => save(question, {}, file)} />}
      {question.type === "MULTIPLE_CHOICE" && <>
        {(options?.options?.length ?? 0) !== 4 && <p className="onairError" role="alert">This question is not configured with four options. Please contact the interview organizer.</p>}
        <div className="onairChoiceHeading"><h2>Choose one answer</h2><span>Select the best option below.</span></div>
        <div className="onairOptions" role="radiogroup" aria-label="Answer choices">{[...(options?.options ?? [])].sort((a, b) => a.order - b.order).map((option, choiceIndex) =>
          <label key={option.id} className={selected.includes(option.id) ? "onairOption chosen" : "onairOption"}>
            <input type="radio" name="answer" checked={selected.includes(option.id)} onChange={() => setSelected([option.id])} />
            <span className="onairOptionLetter" aria-hidden="true">{String.fromCharCode(65 + choiceIndex)}</span>
            <span className="onairOptionText">{option.label || option.value}</span>
            <span className="onairOptionMark" aria-hidden="true" />
          </label>)}</div>
        <button type="button" className="primaryButton" disabled={!selected.length || (options?.options?.length ?? 0) !== 4 || busy} onClick={() => { void save(question, { selectedOptionIds: selected }).catch(() => undefined); }}>{busy ? "Saving…" : "Submit answer"}</button>
      </>}
      {question.type === "SHORT_ANSWER" && <>
        <textarea rows={7} value={text} maxLength={maxLength} onChange={(event) => setText(event.target.value)} placeholder="Type your answer" />
        {maxLength && <small>{text.length} / {maxLength}</small>}
        <button type="button" className="primaryButton" disabled={!text.trim() || busy} onClick={() => { void save(question, { textValue: text }).catch(() => undefined); }}>{busy ? "Saving…" : "Submit answer"}</button>
      </>}
      </>}
    </section> : <section className="onairCard"><h1>Answers saved</h1><p>Submit your interview to finish.</p><button type="button" className="primaryButton" disabled={busy} onClick={() => { setBusy(true); void finish(attempt.id).catch((caught: unknown) => { setError(caught instanceof Error ? caught.message : "Unable to submit interview."); setBusy(false); }); }}>Submit interview</button></section>}
  </main>;
}
