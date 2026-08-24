import type { Metadata } from "next";
import Link from "next/link";
import { ResponseCreateRoute } from "../../../components/response-create-route";

export const metadata: Metadata = {
  title: "Create Response | DS-HR",
  description: "Submit a typed candidate response",
};

export default function CreateResponsePage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">
          DS-HR - Responses
        </div>

        <h1>Submit a candidate response</h1>

        <p>
          Create a short-answer, multiple-choice, or recorded-video
          response for an assigned test.
        </p>

        <div className="heroActions">
          <Link
            className="ghostButton"
            href="/responses/view"
          >
            View response
          </Link>
        </div>
      </section>

      <ResponseCreateRoute />
    </main>
  );
}