"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DeviceOption = {
  deviceId: string;
  label: string;
};

export function DeviceCheck({
  invitationToken,
}: {
  invitationToken: string;
}) {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const audioFrameRef = useRef<number | null>(null);
  const cameraFrameRef = useRef<number | null>(null);

  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<DeviceOption[]>([]);

  const [cameraId, setCameraId] = useState("");
  const [microphoneId, setMicrophoneId] = useState("");
  const [speakerId, setSpeakerId] = useState("");

  const [volume, setVolume] = useState(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraHasPicture, setCameraHasPicture] = useState(false);

  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [microphoneDetected, setMicrophoneDetected] = useState(false);

  const [error, setError] = useState<string | null>(null);

  function stop() {
    streamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    streamRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioFrameRef.current !== null) {
      cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }

    if (cameraFrameRef.current !== null) {
      cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    }

    setVolume(0);
  }

  /**
   * Checks whether the camera is producing a usable image,
   * rather than only an active video track.
   *
   * This intentionally uses a small canvas so the check is
   * inexpensive.
   */
  function cameraFrameHasPicture(
    video: HTMLVideoElement,
  ): boolean {
    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return false;
    }

    const canvas = document.createElement("canvas");

    canvas.width = 160;
    canvas.height = 90;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      return false;
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const pixels = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data;

    let brightnessSum = 0;
    let brightnessSquaredSum = 0;
    let brightPixels = 0;
    let pixelCount = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const brightness =
        0.299 * pixels[i] +
        0.587 * pixels[i + 1] +
        0.114 * pixels[i + 2];

      brightnessSum += brightness;
      brightnessSquaredSum +=
        brightness * brightness;

      if (brightness > 20) {
        brightPixels++;
      }

      pixelCount++;
    }

    if (pixelCount === 0) {
      return false;
    }

    const mean =
      brightnessSum / pixelCount;

    const variance =
      brightnessSquaredSum / pixelCount -
      mean * mean;

    const brightRatio =
      brightPixels / pixelCount;

    /*
     * Reject frames that are essentially black
     * or contain almost no visual information.
     *
     * The thresholds are intentionally lenient so
     * a dim room can still pass.
     */
    return (
      mean > 10 &&
      variance > 15 &&
      brightRatio > 0.03
    );
  }

  function startCameraMonitor(
    video: HTMLVideoElement,
  ) {
    let goodFrames = 0;
    let badFrames = 0;
    let lastCheck = 0;

    const tick = (time: number) => {
      /*
       * We do not need to analyze 60 frames per second.
       * Roughly four checks per second is enough.
       */
      if (time - lastCheck >= 250) {
        lastCheck = time;

        const hasPicture =
          cameraFrameHasPicture(video);

        if (hasPicture) {
          goodFrames++;
          badFrames = 0;

          /*
           * Require several consecutive good frames
           * before considering the camera usable.
           */
          if (goodFrames >= 3) {
            setCameraHasPicture(true);
          }
        } else {
          badFrames++;
          goodFrames = 0;

          /*
           * Likewise, don't fail because of one
           * temporary dark/corrupt frame.
           */
          if (badFrames >= 3) {
            setCameraHasPicture(false);
          }
        }
      }

      cameraFrameRef.current =
        requestAnimationFrame(tick);
    };

    cameraFrameRef.current =
      requestAnimationFrame(tick);
  }

  async function startPreview(
    videoDeviceId = cameraId,
    audioDeviceId = microphoneId,
    resetMicrophoneTest = false,
  ) {
    stop();

    setError(null);

    setCameraReady(false);
    setCameraHasPicture(false);
    setMicrophoneReady(false);

    if (resetMicrophoneTest) {
      setMicrophoneDetected(false);
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: videoDeviceId
            ? {
                deviceId: {
                  exact: videoDeviceId,
                },
              }
            : true,

          audio: audioDeviceId
            ? {
                deviceId: {
                  exact: audioDeviceId,
                },
              }
            : true,
        });

      streamRef.current = stream;

      /*
       * -------------------------
       * MICROPHONE STREAM
       * -------------------------
       */

      const audioTrackReady = stream
        .getAudioTracks()
        .some(
          (track) =>
            track.readyState === "live" &&
            track.enabled,
        );

      setMicrophoneReady(audioTrackReady);

      /*
       * -------------------------
       * CAMERA STREAM
       * -------------------------
       */

      const video = videoRef.current;

      if (video) {
        video.srcObject = stream;

        await video.play();

        if (
          video.readyState < 2 ||
          video.videoWidth === 0 ||
          video.videoHeight === 0
        ) {
          await new Promise<void>((resolve) => {
            video.addEventListener(
              "loadeddata",
              () => resolve(),
              { once: true },
            );
          });
        }

        const videoTrackReady = stream
          .getVideoTracks()
          .some(
            (track) =>
              track.readyState === "live" &&
              track.enabled,
          );

        const streamHasVideo =
          videoTrackReady &&
          video.videoWidth > 0 &&
          video.videoHeight > 0;

        setCameraReady(streamHasVideo);

        if (streamHasVideo) {
          startCameraMonitor(video);
        }
      }

      /*
       * -------------------------
       * DEVICE LIST
       * -------------------------
       */

      const devices =
        await navigator.mediaDevices.enumerateDevices();

      const mapDevices = (
        kind: MediaDeviceKind,
      ): DeviceOption[] =>
        devices
          .filter(
            (device) => device.kind === kind,
          )
          .map((device, index) => ({
            deviceId: device.deviceId,

            label:
              device.label ||
              `${kind} ${index + 1}`,
          }));

      const nextCameras =
        mapDevices("videoinput");

      const nextMicrophones =
        mapDevices("audioinput");

      const nextSpeakers =
        mapDevices("audiooutput");

      setCameras(nextCameras);
      setMicrophones(nextMicrophones);
      setSpeakers(nextSpeakers);

      setCameraId(
        videoDeviceId ||
          stream
            .getVideoTracks()[0]
            ?.getSettings().deviceId ||
          nextCameras[0]?.deviceId ||
          "",
      );

      setMicrophoneId(
        audioDeviceId ||
          stream
            .getAudioTracks()[0]
            ?.getSettings().deviceId ||
          nextMicrophones[0]?.deviceId ||
          "",
      );

      /*
       * -------------------------
       * MICROPHONE LEVEL
       * -------------------------
       */

      if (audioTrackReady) {
        const context = new AudioContext();

        await context.resume();

        const analyser =
          context.createAnalyser();

        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.15;

        const source =
          context.createMediaStreamSource(
            stream,
          );

        source.connect(analyser);

        audioContextRef.current = context;

        const values = new Uint8Array(
          analyser.frequencyBinCount,
        );

        const tick = () => {
          analyser.getByteTimeDomainData(
            values,
          );

          let sum = 0;

          for (const value of values) {
            const normalized =
              (value - 128) / 128;

            sum +=
              normalized * normalized;
          }

          const rms = Math.sqrt(
            sum / values.length,
          );

          /*
           * Ignore very quiet background noise.
           */
          const gated = Math.max(
            0,
            rms - 0.012,
          );

          /*
           * UI meter value.
           */
          const nextVolume = Math.min(
            1,
            Math.sqrt(gated) * 2.6,
          );

          setVolume(nextVolume);

          /*
           * Once real microphone activity has been
           * detected, remember it.
           */
          if (gated > 0.005) {
            setMicrophoneDetected(true);
          }

          audioFrameRef.current =
            requestAnimationFrame(tick);
        };

        tick();
      }
    } catch (caught) {
      setCameraReady(false);
      setCameraHasPicture(false);
      setMicrophoneReady(false);
      setMicrophoneDetected(false);

      if (
        caught instanceof DOMException &&
        caught.name === "NotAllowedError"
      ) {
        setError(
          "Camera and microphone permission was denied. Please allow access and try again.",
        );
      } else if (
        caught instanceof DOMException &&
        caught.name === "NotFoundError"
      ) {
        setError(
          "A camera or microphone could not be found.",
        );
      } else if (
        caught instanceof DOMException &&
        caught.name === "NotReadableError"
      ) {
        setError(
          "Your camera or microphone may be in use by another application.",
        );
      } else {
        setError(
          "Unable to access your camera and microphone. Check your devices and try again.",
        );
      }
    }
  }

  useEffect(() => {
    void startPreview("", "", true);

    return () => {
      stop();
    };
  }, []);

  /*
   * All four conditions must pass.
   */
  const canStart =
    cameraReady &&
    cameraHasPicture &&
    microphoneReady &&
    microphoneDetected;

  return (
    <main className="pageShell">
      <section className="panel deviceCheck">
        {/* CAMERA */}

        <div className="deviceCamera">
          <video
            ref={videoRef}
            muted
            playsInline
          />

          <span>
            {cameraHasPicture
              ? "Camera preview"
              : "Checking camera…"}
          </span>
        </div>

        {/* MICROPHONE METER */}

        <div className="deviceMeter">
          <strong>
            Microphone level
          </strong>

          <div>
            <i
              style={{
                width: `${Math.min(
                  100,
                  volume * 260,
                )}%`,
              }}
            />
          </div>

          {microphoneReady &&
            !microphoneDetected && (
              <small>
                Say something to test your
                microphone.
              </small>
            )}

          {microphoneDetected && (
            <small>
              Microphone is working.
            </small>
          )}
        </div>

        {/* CONTROLS */}

        <div className="deviceControls">
          <h1>
            Audio &amp; Video Test
          </h1>

          <p>
            Check your devices before beginning.
          </p>

          {/* CAMERA SELECT */}

          <label>
            Camera

            <select
              value={cameraId}
              onChange={(event) => {
                const nextCameraId =
                  event.target.value;

                setCameraId(nextCameraId);

                void startPreview(
                  nextCameraId,
                  microphoneId,
                  false,
                );
              }}
            >
              <option value="">
                Select camera
              </option>

              {cameras.map((device) => (
                <option
                  key={device.deviceId}
                  value={device.deviceId}
                >
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          {cameraReady &&
            !cameraHasPicture && (
              <small className="helperText">
                No usable camera image detected.
                Make sure your camera is uncovered
                and camera privacy mode is turned
                off.
              </small>
            )}

          {cameraHasPicture && (
            <small className="helperText">
              Camera is working.
            </small>
          )}

          {/* MICROPHONE SELECT */}

          <label>
            Microphone

            <select
              value={microphoneId}
              onChange={(event) => {
                const nextMicrophoneId =
                  event.target.value;

                setMicrophoneId(
                  nextMicrophoneId,
                );

                void startPreview(
                  cameraId,
                  nextMicrophoneId,
                  true,
                );
              }}
            >
              <option value="">
                Select microphone
              </option>

              {microphones.map((device) => (
                <option
                  key={device.deviceId}
                  value={device.deviceId}
                >
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          {/* SPEAKER SELECT */}

          {speakers.length > 0 && (
            <label>
              Speaker

              <select
                value={speakerId}
                onChange={(event) =>
                  setSpeakerId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  System default
                </option>

                {speakers.map((device) => (
                  <option
                    key={device.deviceId}
                    value={device.deviceId}
                  >
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* ERROR */}

          {error && (
            <div className="stateCard errorState">
              {error}
            </div>
          )}

          {/* START */}

          <button
            type="button"
            className="primaryButton"
            disabled={!canStart}
            onClick={() => {
              stop();

              router.push(
                `/interview/${encodeURIComponent(
                  invitationToken,
                )}/onair`,
              );
            }}
          >
            Start Interview
          </button>
        </div>
      </section>
    </main>
  );
}
