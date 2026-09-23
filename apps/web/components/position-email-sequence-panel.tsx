"use client";

import { useEffect, useState } from "react";
import { listEmailTemplates, updatePositionEmailSequence, type EmailSequenceTrigger, type EmailTemplateSummary, type PositionResponse } from "../lib/position-api";
import { AppIcon } from "./ui/app-icon";
import { Modal } from "./ui/modal";
import { EmailPreview } from "./email-preview";

type Rule = { clientId: string; templateId: string; condition: EmailSequenceTrigger; hours: number };
type Props = { position: PositionResponse; className?: string; onSaved?: (position: PositionResponse) => void };
function id() { return globalThis.crypto?.randomUUID?.() ?? `rule_${Date.now()}_${Math.random()}`; }
function blankRule(): Rule { return { clientId: id(), templateId: "", condition: "INVITATION", hours: 1 }; }
function defaultRules(templates: EmailTemplateSummary[]): Rule[] {
  const byKey = new Map(templates.map((template) => [template.key, template.id]));
  return [
    { key: "invitation_default", condition: "INVITATION" as const, hours: 1 },
    { key: "final_reminder_default", condition: "NO_RESPONSE" as const, hours: 48 },
    { key: "completion_default", condition: "INTERVIEW_COMPLETED" as const, hours: 1 },
  ].flatMap(({ key, condition, hours }) => byKey.has(key) ? [{ clientId: id(), templateId: byKey.get(key)!, condition, hours }] : []);
}
function label(condition: EmailSequenceTrigger) { return condition === "INVITATION" ? "On invitation" : condition === "INTERVIEW_COMPLETED" ? "On completion" : "No response in X hours"; }

export function PositionEmailSequencePanel({ position, className, onSaved }: Props) {
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false; setLoading(true); setError(null);
    void listEmailTemplates().then((items) => {
      if (cancelled) return;
      setTemplates(items);
      setRules(position.emails ? position.emails.steps.map((step) => ({
        clientId: step.id, templateId: step.templateId, condition: step.trigger,
        hours: step.trigger === "NO_RESPONSE" ? (step.delayUnit === "HOURS" ? step.delayValue : step.delayUnit === "DAYS" ? step.delayValue * 24 : Math.max(1, Math.ceil(step.delayValue / 60))) : 1,
      })) : defaultRules(items));
    }).catch((caught) => !cancelled && setError(caught instanceof Error ? caught.message : "Failed to load email templates"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [position.id, position.emails?.updatedAt]);

  const previewRule = rules.find((rule) => rule.clientId === previewId);
  const previewTemplate = templates.find((template) => template.id === previewRule?.templateId);
  function change(index: number, patch: Partial<Rule>) { setRules((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); setSaved(false); }
  async function save() {
    setError(null); setSaved(false);
    if (rules.some((rule) => !rule.templateId)) { setError("Choose an email template for every rule."); return; }
    if (rules.some((rule) => rule.condition === "NO_RESPONSE" && (!Number.isInteger(rule.hours) || rule.hours <= 0))) { setError("No-response hours must be a positive whole number."); return; }
    setSaving(true);
    try {
      const result = await updatePositionEmailSequence(position.id, { steps: rules.map((rule, index) => ({ templateId: rule.templateId, trigger: rule.condition, delayValue: rule.condition === "NO_RESPONSE" ? rule.hours : 0, delayUnit: "HOURS", order: index + 1 })) });
      setRules((result.emails?.steps ?? []).map((step) => ({ clientId: step.id, templateId: step.templateId, condition: step.trigger, hours: step.delayValue || 1 })));
      setSaved(true); onSaved?.(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to save email rules"); }
    finally { setSaving(false); }
  }

  return <section className={`positionSettingsCard positionEmailCard ${className ?? ""}`}>
    <div className="positionCardHeader positionEmailHeader"><div className="positionCardCopy"><h2>Candidate notifications</h2><p>Automatically notify candidates based on their progress.</p></div><span className="positionCountBadge">{rules.length} {rules.length === 1 ? "rule" : "rules"}</span></div>
    {loading && <div className="stateCard">Loading email templates...</div>}
    {!loading && templates.length === 0 && <div className="stateCard emptyStateInline">Create an email template before adding a rule.</div>}
    {!loading && templates.length > 0 && rules.length === 0 && <div className="positionEmailEmpty"><div className="positionCardIcon muted"><AppIcon name="email" size={22} /></div><strong>No email rules yet</strong><span>Add a rule to automate candidate communication.</span></div>}
    <div className="positionRuleList">{rules.map((rule, index) => <div className="positionRuleRow" key={rule.clientId}>
      <div className="positionRuleNumber">{index + 1}</div>
      <div className="positionRuleFields">
        <label><span>Template</span><select value={rule.templateId} onChange={(event) => change(index, { templateId: event.target.value })} required><option value="">Choose a template...</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>
        <label><span>Send when</span><select value={rule.condition} onChange={(event) => change(index, { condition: event.target.value as EmailSequenceTrigger })}><option value="INVITATION">On invitation</option><option value="INTERVIEW_COMPLETED">On completion</option><option value="NO_RESPONSE">No response in X hours</option></select></label>
        {rule.condition === "NO_RESPONSE" && <label className="positionHoursField"><span>After</span><div><input aria-label="Hours without response" type="number" min="1" step="1" value={rule.hours} onChange={(event) => change(index, { hours: Number(event.target.value) })} required /><span>hours</span></div></label>}
      </div>
      <div className="positionRuleActions"><button type="button" disabled={!rule.templateId} onClick={() => setPreviewId(rule.clientId)}>Preview</button><button className="danger" type="button" aria-label={`Delete rule ${index + 1}`} onClick={() => setRules((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Delete</button></div>
      <small className="positionRuleSummary">{label(rule.condition)}</small>
    </div>)}</div>
    {error && <div className="stateCard errorState">Error: {error}</div>}{saved && <div className="stateCard successState">Email rules saved.</div>}
    <div className="positionEmailFooter"><button type="button" className="positionAddRule" disabled={loading || templates.length === 0} onClick={() => setRules((items) => [...items, blankRule()])}><AppIcon name="plus" size={17} /> Add email rule</button><button type="button" className="primaryButton" disabled={loading || saving} onClick={save}>{saving ? "Saving..." : "Save sequence"}</button></div>
    <Modal open={Boolean(previewRule)} title="Email preview" description="Placeholder values remain unchanged in the stored template." onClose={() => setPreviewId(null)} size="large">
      {previewTemplate ? <EmailPreview from="Configured sender" subject={previewTemplate.subject} html={previewTemplate.html} /> : <div className="stateCard emptyStateInline">Select a template to preview it.</div>}
    </Modal>
  </section>;
}
