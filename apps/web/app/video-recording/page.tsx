import type { Metadata } from "next";
import Link from "next/link";
import { VideoRecordingRoute } from "../../components/video-recording-route";

export const metadata: Metadata = {
  title: "Browser Video Recording | DS-HR",
  description: "Record, preview, and download a browser video response locally",
};

export default function VideoRecordingPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Video recording</div>
        <h1>Browser recording preview</h1>
        <p>
          Record a local video response in supported browsers, preview it immediately, and download the resulting file.
        </p>
        <div className="heroActions">
          <Link className="primaryButton inlineButton" href="/">
            Back home
          </Link>
        </div>
      </section>

      <VideoRecordingRoute />
    </main>
  );
}
