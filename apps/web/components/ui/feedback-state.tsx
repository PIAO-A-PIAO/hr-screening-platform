import type { ReactNode } from "react";
import { Spinner } from "./spinner";

type FeedbackKind = "loading" | "empty" | "error" | "success";

type FeedbackStateProps = {
  kind: FeedbackKind;
  title: string;
  description?: string;
  actions?: ReactNode;
};

const symbols: Record<Exclude<FeedbackKind, "loading">, string> = {
  empty: "—",
  error: "!",
  success: "✓",
};

export function FeedbackState({ kind, title, description, actions }: FeedbackStateProps) {
  return (
    <section className={`dsFeedback dsFeedback-${kind}`} role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}>
      <span className="dsFeedbackIcon" aria-hidden="true">
        {kind === "loading" ? <Spinner label={title} /> : symbols[kind]}
      </span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {actions && <div className="dsFeedbackActions">{actions}</div>}
    </section>
  );
}
