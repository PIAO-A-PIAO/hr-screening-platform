"use client";

import { useEffect, useRef, useState } from "react";

type BrowserSupport = {
  mediaDevices: boolean;
  mediaRecorder: boolean;
  secureContext: boolean;
};

type RecordingStatus = "idle" | "recording" | "processing" | "ready";

type CompressionReport = {
  compressionPercentage: number | null;
  sourceSize: number;
  preparedSize: number;
  sourceMimeType: string;
  preparedMimeType: string;
  sourceCodec: string;
  preparedCodec: string;
  sourceDurationSeconds: number | null;
  preparedDurationSeconds: number | null;
};

const MIME_TYPE_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];

function getBrowserSupport(): BrowserSupport {
  return {
    mediaDevices: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    mediaRecorder: typeof MediaRecorder !== "undefined",
    secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
  };
}

function chooseMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  return MIME_TYPE_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function fileExtensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  return "webm";
}

function extractCodecSummary(mimeType: string) {
  const codecs = mimeType
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("codecs="));

  if (!codecs) {
    return "browser default";
  }

  return codecs.slice("codecs=".length).replace(/^"|"$/g, "");
}

function readErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "Permission denied: camera and microphone access was blocked.";
      case "NotFoundError":
        return "No camera or microphone was found.";
      case "NotReadableError":
        return "The camera or microphone is in use or unavailable.";
      case "AbortError":
        return "Recording was interrupted by the browser or device.";
      case "SecurityError":
        return "Recording requires a secure browser context.";
      default:
        return `${error.name}: ${error.message || "Recording failed."}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Recording failed.";
}

type VideoRecordingRouteProps = {
  onRecordingReady?: (file: File | null) => void;
  previewBelowControls?: boolean;
};

export function VideoRecordingRoute({
  onRecordingReady,
  previewBelowControls = false,
}: VideoRecordingRouteProps = {}) {
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const mimeTypeRef = useRef<string>("");

  const [support, setSupport] = useState<BrowserSupport | null>(null);
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcodeError, setTranscodeError] = useState<string | null>(null);
  const [transcoding, setTranscoding] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingMimeType, setRecordingMimeType] = useState<string>("");
  const [recordingCodec, setRecordingCodec] = useState<string>("browser default");
  const [downloadName, setDownloadName] = useState("recording.webm");
  const [compressionReport, setCompressionReport] = useState<CompressionReport | null>(null);

  useEffect(() => {
    setSupport(getBrowserSupport());
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // Ignore stop errors during teardown.
        }
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      recordedBlobRef.current = null;

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload() {
      if (recorderRef.current?.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // Ignore.
        }
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) {
      return;
    }

    if (status === "recording" && streamRef.current) {
      video.srcObject = streamRef.current;
      video.muted = true;
      video.autoplay = true;
      video.controls = false;
      void video.play().catch(() => undefined);
      return;
    }

    video.srcObject = null;
    video.muted = false;
    video.autoplay = false;
    video.controls = Boolean(previewUrl);

    if (previewUrl) {
      video.src = previewUrl;
    } else {
      video.removeAttribute("src");
    }
  }, [previewUrl, status]);

  function clearPreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setPreviewUrl(null);
    setRecordingMimeType("");
    setRecordingCodec("browser default");
    setDownloadName("recording.webm");
    setCompressionReport(null);
    setTranscodeError(null);
    recordedBlobRef.current = null;
    onRecordingReady?.(null);

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  }

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function startRecording() {
    setError(null);

    const nextSupport = support ?? getBrowserSupport();
    if (!nextSupport.secureContext || !nextSupport.mediaDevices || !nextSupport.mediaRecorder) {
      setSupport(nextSupport);
      setError("This browser does not support camera/microphone recording in the current context.");
      return;
    }

    clearPreview();
    setError(null);
    setTranscodeError(null);
    setCompressionReport(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      const mimeType = chooseMimeType();
      mimeTypeRef.current = mimeType ?? "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      const stopIfTrackEnds = () => {
        if (recorder.state === "recording") {
          setError("Recording interrupted: a camera or microphone track stopped unexpectedly.");
          try {
            recorder.stop();
          } catch {
            // Ignore.
          }
        }
      };

      for (const track of stream.getTracks()) {
        track.onended = stopIfTrackEnds;
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Recording interrupted by the browser.");
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeTypeRef.current || "video/webm",
        });
        recordedBlobRef.current = blob;
        const objectUrl = URL.createObjectURL(blob);

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        objectUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);

        const finalMimeType = blob.type || recorder.mimeType || mimeTypeRef.current || "video/webm";
        const finalDownloadName = `recording.${fileExtensionForMimeType(finalMimeType)}`;
        setRecordingMimeType(finalMimeType);
        setRecordingCodec(extractCodecSummary(finalMimeType));
        setDownloadName(finalDownloadName);
        onRecordingReady?.(new File([blob], finalDownloadName, { type: finalMimeType }));
        setStatus("ready");

        cleanupStream();
      };

      recorder.start();
      setStatus("recording");
    } catch (caught) {
      cleanupStream();
      setError(readErrorMessage(caught));
      setStatus("idle");
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return;
    }

    setStatus("processing");
    try {
      recorderRef.current.stop();
    } catch (caught) {
      setError(readErrorMessage(caught));
      setStatus("idle");
      cleanupStream();
    }
  }

  async function transcodeRecording() {
    if (!recordedBlobRef.current || !recordingStopped) {
      return;
    }

    setTranscodeError(null);
    setCompressionReport(null);
    setTranscoding(true);

    try {
      const formData = new FormData();
      const recordingFile = new File(
        [recordedBlobRef.current],
        downloadName,
        { type: recordingMimeType || recordedBlobRef.current.type || "video/webm" },
      );
      formData.append("file", recordingFile);

      const response = await fetch("/api/questions/video/transcode", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as CompressionReport | { message?: string } | null;

      if (!response.ok) {
        const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Video transcode request failed.";
        throw new Error(message);
      }

      setCompressionReport(payload as CompressionReport);
    } catch (caught) {
      setTranscodeError(readErrorMessage(caught));
    } finally {
      setTranscoding(false);
    }
  }

  const recordingActive = status === "recording";
  const recordingStopped = status === "ready";
  const compressionPercentage = compressionReport?.compressionPercentage;
  const compressionText = compressionPercentage === null
    ? "Compression unavailable"
    : typeof compressionPercentage === "number"
      ? compressionPercentage >= 0
        ? `Compressed by ${compressionPercentage.toFixed(1)}%`
        : `Expanded by ${Math.abs(compressionPercentage).toFixed(1)}%`
      : "No compression report yet";

  return (
    <section className="panel videoRecorderShell">
      <div className="panelHeader">
        <div>
          <span className="sectionLabel">Browser video</span>
          <h2>Record a candidate response locally</h2>
        </div>
        <p>
          {onRecordingReady
            ? "Start, stop, and preview a recording before attaching it to the response."
            : "Start, stop, preview, and download a browser recording without saving a response."}
        </p>
      </div>

      <div className={previewBelowControls ? "videoRecorderLayout stackedVideoRecorderLayout" : "videoRecorderLayout"}>
        <div className="videoRecorderControls">
          <div className="actionsRow recorderActions">
            <button className="primaryButton" type="button" onClick={() => void startRecording()} disabled={recordingActive}>
              {recordingActive ? "Recording..." : "Start Recording"}
            </button>
            <button className="ghostButton" type="button" onClick={stopRecording} disabled={!recordingActive}>
              Stop Recording
            </button>
            <button
              className="ghostButton"
              type="button"
              onClick={() => void transcodeRecording()}
              disabled={!recordingStopped || transcoding || !recordedBlobRef.current}
            >
              {transcoding ? "Transcoding..." : "Transcode recording"}
            </button>
            <a
              className="ghostButton recorderDownloadButton"
              href={previewUrl ?? undefined}
              download={downloadName}
              aria-disabled={!recordingStopped}
              onClick={(event) => {
                if (!recordingStopped || !previewUrl) {
                  event.preventDefault();
                }
              }}
            >
              Download recording
            </a>
          </div>

          {previewBelowControls && (
            <div className="videoRecorderPreview">
              <div className="stateCard recorderPreviewCard">
                <strong>{recordingActive ? "Monitoring" : "Preview"}</strong>
                <span className="inlineStatus">
                  {recordingActive
                    ? "Live camera and microphone feed is visible here while recording."
                    : "The recorded file appears here after you stop."}
                </span>
                {error && <div className="stateCard errorState recorderError">Error: {error}</div>}
                <video
                  ref={previewVideoRef}
                  className="mediaFrame recorderVideo"
                  controls={recordingStopped}
                  playsInline
                  muted={recordingActive}
                  autoPlay={recordingActive}
                />
                {!recordingActive && !previewUrl && <div className="mediaEmpty recorderEmpty">No recording preview yet.</div>}
              </div>
            </div>
          )}

          <div className="stateCard recorderMetaCard">
            <strong>Recording metadata</strong>
            <div className="recorderMetaGrid">
              <div>
                <span>Support</span>
                <small>
                  {support === null
                    ? "Checking browser support..."
                    : !support.secureContext
                      ? "Secure context required"
                      : !support.mediaDevices || !support.mediaRecorder
                        ? "Unsupported browser"
                        : "Ready"}
                </small>
              </div>
              <div>
                <span>Mime type</span>
                <small>{recordingMimeType || "Will be detected after stop"}</small>
              </div>
              <div>
                <span>Codec</span>
                <small>{recordingCodec}</small>
              </div>
              <div>
                <span>Compression</span>
                <small>{compressionText}</small>
              </div>
              <div>
                <span>Transcode mime</span>
                <small>{compressionReport?.preparedMimeType ?? "Awaiting transcode request"}</small>
              </div>
            </div>
            {transcodeError && <div className="stateCard errorState recorderError">Transcode error: {transcodeError}</div>}
          </div>
        </div>

        {!previewBelowControls && (
          <div className="videoRecorderPreview">
            <div className="stateCard recorderPreviewCard">
              <strong>{recordingActive ? "Monitoring" : "Preview"}</strong>
              <span className="inlineStatus">
                {recordingActive
                  ? "Live camera and microphone feed is visible here while recording."
                  : "The recorded file appears here after you stop."}
              </span>
              {error && <div className="stateCard errorState recorderError">Error: {error}</div>}
              <video
                ref={previewVideoRef}
                className="mediaFrame recorderVideo"
                controls={recordingStopped}
                playsInline
                muted={recordingActive}
                autoPlay={recordingActive}
              />
              {!recordingActive && !previewUrl && <div className="mediaEmpty recorderEmpty">No recording preview yet.</div>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
