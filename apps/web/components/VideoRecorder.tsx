"use client";

import { useEffect, useRef, useState } from "react";
import { browserApiUrl } from "../lib/api";

export function VideoRecorder({ answerSeconds = 120, preparationSeconds = 30, maxRetries = 0, onUploaded }: {
  answerSeconds?: number;
  preparationSeconds?: number;
  maxRetries?: number;
  onUploaded: (url: string) => void;
}) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [phase, setPhase] = useState<"ready" | "preparing" | "countdown" | "recording" | "uploading" | "done">("ready");
  const [remaining, setRemaining] = useState(preparationSeconds);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  }, [playbackUrl]);

  async function prepare() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (previewRef.current) previewRef.current.srcObject = stream;
      setPhase("preparing");
      let value = preparationSeconds;
      setRemaining(value);
      const prepTimer = window.setInterval(() => {
        value -= 1; setRemaining(value);
        if (value <= 0) {
          window.clearInterval(prepTimer);
          countdown(3);
        }
      }, 1000);
    } catch {
      setError("Camera and microphone access is required. Check browser permissions and try again.");
    }
  }

  function countdown(value: number) {
    setPhase("countdown"); setRemaining(value);
    if (value <= 0) { beginRecording(); return; }
    window.setTimeout(() => countdown(value - 1), 1000);
  }

  function beginRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });
      const localUrl = URL.createObjectURL(blob);
      setPlaybackUrl(localUrl);
      stream.getTracks().forEach((track) => track.stop());
      setPhase("uploading");
      const data = new FormData();
      data.append("file", blob, "answer.webm");
      try {
        const response = await fetch(`${browserApiUrl}/media/upload`, { method: "POST", body: data });
        if (!response.ok) throw new Error("Upload failed");
        const uploaded = await response.json() as { url: string };
        onUploaded(uploaded.url);
        setPhase("done");
      } catch {
        setError("The recording could not be uploaded. Keep this page open and record again.");
        setPhase("ready");
      }
    };
    recorder.start(1000);
    setAttempts((current) => current + 1);
    setPhase("recording");
    let value = answerSeconds;
    setRemaining(value);
    const timer = window.setInterval(() => {
      value -= 1; setRemaining(value);
      if (value <= 0 || recorder.state === "inactive") window.clearInterval(timer);
      if (value <= 0 && recorder.state === "recording") recorder.stop();
    }, 1000);
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  return (
    <div className="recorder">
      {playbackUrl && phase === "done" ? <video src={playbackUrl} controls /> : <video ref={previewRef} autoPlay muted playsInline />}
      <div className="recorderControls">
        {phase === "ready" && <button type="button" className="button" onClick={prepare}>Check camera and begin</button>}
        {phase === "preparing" && <strong>Preparation: {remaining}s</strong>}
        {phase === "countdown" && <strong>Recording starts in {remaining}</strong>}
        {phase === "recording" && <><span className="recording">● Recording · {remaining}s</span><button type="button" className="button secondary" onClick={stop}>Stop</button></>}
        {phase === "recording" && remaining <= 10 && <strong className="recording">10-second warning</strong>}
        {phase === "uploading" && <strong>Uploading recording…</strong>}
        {phase === "done" && <><span className="success">Recording uploaded</span>{attempts <= maxRetries && <button type="button" className="button secondary" onClick={() => { setPlaybackUrl(""); setPhase("ready"); }}>Record again ({maxRetries - attempts + 1} left)</button>}</>}
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
