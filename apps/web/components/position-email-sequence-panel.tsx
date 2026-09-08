"use client";

import { useEffect, useState } from "react";
import {
  listEmailTemplates,
  updatePositionEmailSequence,
  type EmailDelayUnit,
  type EmailSequenceStopCondition,
  type EmailTemplateSummary,
  type PositionResponse,
} from "../lib/position-api";

type SequenceDraftStep = {
  clientId: string;
  templateId: string;
  delayValue: number;
  delayUnit: EmailDelayUnit;
  stopCondition: EmailSequenceStopCondition | "";
};

type PositionEmailSequencePanelProps = {
  position: PositionResponse;
  className?: string;
  onSaved?: () => void;
};

function makeClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `step_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createBlankStep(templates: EmailTemplateSummary[], index: number): SequenceDraftStep {
  return {
    clientId: makeClientId(),
    templateId: templates[index]?.id ?? templates[0]?.id ?? "",
    delayValue: index === 0 ? 1 : 3,
    delayUnit: index === 0 ? "HOURS" : "DAYS",
    stopCondition: "",
  };
}

function fromSequence(position: PositionResponse, templates: EmailTemplateSummary[]): SequenceDraftStep[] {
  if (!position.emails) {
    return [createBlankStep(templates, 0), createBlankStep(templates, 1)];
  }

  return position.emails.steps.map((step) => ({
    clientId: step.id,
    templateId: step.templateId,
    delayValue: step.delayValue,
    delayUnit: step.delayUnit,
    stopCondition: step.stopCondition ?? "",
  })) as SequenceDraftStep[];
}

function describeStep(step: SequenceDraftStep, index: number, templates: EmailTemplateSummary[]) {
  const template = templates.find((entry) => entry.id === step.templateId);
  const label = template ? `${template.name} (${template.subject})` : "Missing template";
  const stopLabel =
    step.stopCondition === ""
      ? "No stop rule"
      : step.stopCondition === "CANDIDATE_SUBMITTED"
        ? "Stop when candidate submits"
        : step.stopCondition === "CANDIDATE_DISCARDED"
          ? "Stop when candidate is discarded"
          : "Stop when position closes";

  return `${index + 1}. ${label} after ${step.delayValue} ${step.delayUnit.toLowerCase()} ${stopLabel}`;
}

export function PositionEmailSequencePanel({
  position,
  className,
  onSaved,
}: PositionEmailSequencePanelProps) {
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [steps, setSteps] = useState<SequenceDraftStep[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setLoadingTemplates(true);
      setError(null);

      try {
        const loaded = await listEmailTemplates();
        if (cancelled) {
          return;
        }

        setTemplates(loaded);
        setSteps(fromSequence(position, loaded));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load email templates");
          setTemplates([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingTemplates(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [position.id, position.emails, position.emails?.id, position.emails?.updatedAt]);

  useEffect(() => {
    if (templates.length === 0 || steps.length > 0) {
      return;
    }

    setSteps(fromSequence(position, templates));
  }, [position, templates, steps.length]);

  function updateStep(index: number, next: Partial<SequenceDraftStep>) {
    setSteps((current) =>
      current.map((step, currentIndex) =>
        currentIndex === index
          ? {
              ...step,
              ...next,
            }
          : step,
      ),
    );
    setSuccess(null);
  }

  function addStep() {
    setSteps((current) => [...current, createBlankStep(templates, current.length)]);
    setSuccess(null);
  }

  function removeStep(index: number) {
    setSteps((current) => {
      if (current.length <= 2) {
        return current;
      }

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
    setSuccess(null);
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
    setSuccess(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (steps.length < 2) {
        throw new Error("Add at least two steps before saving.");
      }

      const payload = {
        steps: steps.map((step, index) => ({
          templateId: step.templateId,
          delayValue: step.delayValue,
          delayUnit: step.delayUnit,
          order: index + 1,
          stopCondition: step.stopCondition === "" ? undefined : step.stopCondition,
        })),
      };

      const saved = await updatePositionEmailSequence(position.id, payload);
      setSuccess(`Saved ${saved.emails?.steps.length ?? 0} email steps.`);
      setSteps(fromSequence(saved, templates));
      onSaved?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save email sequence");
    } finally {
      setSaving(false);
    }
  }

  const canEdit = templates.length > 0 && !loadingTemplates;

  return (
    <details className={`detailCard emailSequenceAccordion ${className ?? ""}`} open>
      <summary className="attachedTestSummary">
        <div>
          <span className="sectionLabel">Email sequence</span>
          <h3>{position.emails ? "Configured sequence" : "No sequence yet"}</h3>
          <small>{position.emails?.id ?? "Configure invitation and reminder emails"}</small>
        </div>
        <div className="attachedTestSummaryMeta">
          <span className="pill">{position.emails?.steps.length ?? 0} steps</span>
          <span className="pill">HTML templates</span>
        </div>
      </summary>

      <div className="attachedTestBody">
        {loadingTemplates && <div className="stateCard">Loading email templates...</div>}
        {error && <div className="stateCard errorState">Error: {error}</div>}

        {!loadingTemplates && templates.length === 0 && !error && (
          <div className="stateCard emptyStateInline">
            No email templates are available yet.
          </div>
        )}

        <form id={`email-sequence-form-${position.id}`} className="formGrid" onSubmit={handleSubmit}>
          <div className="field fieldWide">
            <span>Steps</span>
            <div className="sequenceEditor">
              {steps.map((step, index) => (
                <div key={step.clientId} className="sequenceStepCard">
                  <div className="sequenceStepHeader">
                    <strong>Step {index + 1}</strong>
                    <div className="draftActions">
                      <button type="button" className="ghostButton compactButton" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                        Up
                      </button>
                      <button
                        type="button"
                        className="ghostButton compactButton"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === steps.length - 1}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="ghostButton compactButton"
                        onClick={() => removeStep(index)}
                        disabled={steps.length <= 2}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="formGrid sequenceStepGrid">
                    <label className="field">
                      <span>Global template</span>
                      <select value={step.templateId} onChange={(event) => updateStep(index, { templateId: event.target.value })} required>
                        <option value="" disabled>
                          Select a global template
                        </option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} - {template.subject}
                          </option>
                        ))}
                      </select>
                      <small className="helperText">
                        Templates can be reused by multiple positions. This sequence stores only the template reference.
                      </small>
                    </label>

                    <label className="field">
                      <span>Wait</span>
                      <input
                        type="number"
                        min={1}
                        value={step.delayValue}
                        onChange={(event) => updateStep(index, { delayValue: Number(event.target.value) })}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Unit</span>
                      <select value={step.delayUnit} onChange={(event) => updateStep(index, { delayUnit: event.target.value as EmailDelayUnit })}>
                        <option value="MINUTES">Minutes</option>
                        <option value="HOURS">Hours</option>
                        <option value="DAYS">Days</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Stop rule</span>
                      <select
                        value={step.stopCondition}
                        onChange={(event) =>
                          updateStep(index, {
                            stopCondition: event.target.value as EmailSequenceStopCondition | "",
                          })
                        }
                      >
                        <option value="">None</option>
                        <option value="CANDIDATE_SUBMITTED">Stop when candidate submits</option>
                        <option value="CANDIDATE_DISCARDED">Stop when candidate is discarded</option>
                        <option value="POSITION_CLOSED">Stop when position closes</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="detailCard sequencePreviewCard">
          <strong>Sequence preview</strong>
          {steps.length === 0 ? (
            <div className="stateCard emptyStateInline">Add two or more steps to create a sequence.</div>
          ) : (
            <ul className="dataList">
              {steps.map((step, index) => (
                <li key={step.clientId}>
                  <strong>{describeStep(step, index, templates)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="feedbackArea">
          {success && (
            <div className="stateCard successState">
              <strong>Sequence saved.</strong>
              <span>{success}</span>
            </div>
          )}
          {!error && !success && !loadingTemplates && (
            <div className="stateCard emptyStateInline">
              Invitation, reminders, and stop rules are stored as ordered database records, not a freeform JSON blob.
            </div>
          )}
        </div>

        <div className="actionsRow">
          <button type="button" className="ghostButton" onClick={addStep} disabled={!canEdit}>
            Add step
          </button>
          <button
            className="primaryButton"
            type="submit"
            form={`email-sequence-form-${position.id}`}
            disabled={saving || !canEdit || steps.length < 2 || steps.some((step) => !step.templateId)}
          >
            {saving ? "Saving..." : "Save email sequence"}
          </button>
          <span className="helperText">
            Configure at least an invitation and one reminder. Delays are relative to the prior step.
          </span>
        </div>
      </div>
    </details>
  );
}
