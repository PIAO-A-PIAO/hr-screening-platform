import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

type ProbeStream = {
  codec_name?: string;
  codec_type?: string;
  profile?: string;
  width?: number;
  height?: number;
  channels?: number;
  sample_rate?: string;
  bit_rate?: string;
  duration?: string;
};

type ProbeResult = {
  streams?: ProbeStream[];
  format?: {
    duration?: string;
    bit_rate?: string;
    format_name?: string;
  };
};

export type VideoTranscodeResult = {
  preparedBuffer: Buffer;
  preparedMimeType: string;
  preparedSize: number;
  sourceMimeType: string;
  sourceSize: number;
  sourceCodec: string;
  preparedCodec: string;
  sourceDurationSeconds: number | null;
  preparedDurationSeconds: number | null;
};

export type VideoCompressionReport = VideoTranscodeResult & {
  compressionPercentage: number | null;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

@Injectable()
export class VideoTranscodingService {
  private availabilityPromise: Promise<boolean> | null = null;

  async isAvailable() {
    this.availabilityPromise ??= Promise.all([
      this.runCommand(this.resolveBinary("FFMPEG_PATH", "ffmpeg"), ["-version"]),
      this.runCommand(this.resolveBinary("FFPROBE_PATH", "ffprobe"), ["-version"]),
    ])
      .then(() => true)
      .catch(() => false);

    return this.availabilityPromise;
  }

  async transcodeUpload(input: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }): Promise<VideoTranscodeResult> {
    return this.transcodeBuffer(input);
  }

  async transcodeBuffer(input: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }): Promise<VideoTranscodeResult> {
    return this.transcodeWithTempFiles(input);
  }

  async transcodeAndReportCompression(input: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }): Promise<VideoCompressionReport> {
    const result = await this.transcodeWithTempFiles(input);
    const compressionPercentage = result.sourceSize > 0
      ? Number((((result.sourceSize - result.preparedSize) / result.sourceSize) * 100).toFixed(1))
      : null;

    return {
      ...result,
      compressionPercentage,
    };
  }

  private async probe(filePath: string): Promise<ProbeResult> {
    const { stdout } = await this.runCommand(this.resolveBinary("FFPROBE_PATH", "ffprobe"), [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      filePath,
    ]);

    try {
      return JSON.parse(stdout) as ProbeResult;
    } catch {
      throw new ServiceUnavailableException("Video probing failed");
    }
  }

  private describeProbe(probe: ProbeResult) {
    const streams = probe.streams ?? [];
    const video = streams.find((stream) => stream.codec_type === "video");
    const audio = streams.find((stream) => stream.codec_type === "audio");
    const parts: string[] = [];

    if (video?.codec_name) {
      const videoParts = [video.codec_name];
      if (video.profile) videoParts.push(video.profile);
      if (video.width && video.height) videoParts.push(`${video.width}x${video.height}`);
      parts.push(videoParts.join(" "));
    }

    if (audio?.codec_name) {
      const audioParts = [audio.codec_name];
      if (audio.channels) audioParts.push(`${audio.channels}ch`);
      if (audio.sample_rate) audioParts.push(`${audio.sample_rate}Hz`);
      parts.push(audioParts.join(" "));
    }

    return parts.length > 0 ? parts.join(" + ") : "unknown";
  }

  private extractDuration(probe: ProbeResult) {
    const duration = probe.format?.duration ?? probe.streams?.find((stream) => stream.duration)?.duration;
    if (!duration) {
      return null;
    }

    const value = Number(duration);
    return Number.isFinite(value) ? value : null;
  }

  private resolveBinary(envKey: "FFMPEG_PATH" | "FFPROBE_PATH", fallback: string) {
    return process.env[envKey] && process.env[envKey]!.trim().length > 0
      ? process.env[envKey]!.trim()
      : fallback;
  }

  private sanitizeName(name: string, fallback: string) {
    const stem = name
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    return stem.length > 0 ? stem : fallback;
  }

  private runCommand(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(new Error(stderr.trim() || `${command} exited with code ${code ?? "unknown"}`));
      });
    });
  }

  private async transcodeWithTempFiles(input: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }): Promise<VideoTranscodeResult> {
    const available = await this.isAvailable();
    if (!available) {
      throw new ServiceUnavailableException("Video transcoding is not available on this server");
    }

    const workDir = await mkdtemp(join(tmpdir(), "ds-hr-video-"));
    const inputPath = join(workDir, `${randomUUID()}-${this.sanitizeName(input.originalName, "input")}`);
    const outputPath = join(workDir, `${randomUUID()}.mp4`);

    try {
      await writeFile(inputPath, input.buffer);
      const sourceProbe = await this.probe(inputPath);

      await this.runCommand(this.resolveBinary("FFMPEG_PATH", "ffmpeg"), [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath,
      ]);

      const outputBuffer = await readFile(outputPath);
      const outputProbe = await this.probe(outputPath);

      return {
        preparedBuffer: outputBuffer,
        preparedMimeType: "video/mp4",
        preparedSize: outputBuffer.byteLength,
        sourceMimeType: input.mimeType,
        sourceSize: input.buffer.byteLength,
        sourceCodec: this.describeProbe(sourceProbe),
        preparedCodec: this.describeProbe(outputProbe),
        sourceDurationSeconds: this.extractDuration(sourceProbe),
        preparedDurationSeconds: this.extractDuration(outputProbe),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        error instanceof Error ? `Video transcoding failed: ${error.message}` : "Video transcoding failed",
      );
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
