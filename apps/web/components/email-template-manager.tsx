"use client";

import { useEffect, useState } from "react";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  listEmailTemplates,
  updateEmailTemplate,
  type EmailTemplateInput,
  type EmailTemplateSummary,
} from "../lib/position-api";

const emptyDraft: Required<EmailTemplateInput> = { key: "", name: "", subject: "", html: "", text: "" };
const placeholderPattern = /(\{[a-zA-Z0-9_]+\})/g;

function PlaceholderPreview({ value }: { value: string }) {
  if (!value) return <span className="helperText">No placeholders in this field.</span>;
  return <code className="placeholderPreview">{value.split(placeholderPattern).map((part, index) =>
    /^\{[a-zA-Z0-9_]+\}$/.test(part) ? <mark key={`${part}-${index}`}>{part}</mark> : part,
  )}</code>;
}

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [draft, setDraft] = useState<Required<EmailTemplateInput>>(emptyDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTemplates() {
    setLoading(true);
    try {
      setTemplates(await listEmailTemplates());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  function selectTemplate(template: EmailTemplateSummary) {
    setSelectedId(template.id);
    setDraft({
      key: template.key,
      name: template.name,
      subject: template.subject,
      html: template.html,
      text: template.text ?? "",
    });
    setSuccess(null);
    setError(null);
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyDraft);
    setSuccess(null);
    setError(null);
  }

  function updateDraft(field: keyof Required<EmailTemplateInput>, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSuccess(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = selectedId
        ? await updateEmailTemplate(selectedId, draft)
        : await createEmailTemplate(draft);
      setTemplates((current) =>
        selectedId ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved],
      );
      setSelectedId(saved.id);
      setDraft({
        key: saved.key,
        name: saved.name,
        subject: saved.subject,
        html: saved.html,
        text: saved.text ?? "",
      });
      setSuccess("Template saved. All positions using it will see this content.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedId || !window.confirm("Delete this unused email template?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteEmailTemplate(selectedId);
      setTemplates((current) => current.filter((item) => item.id !== selectedId));
      startNew();
      setSuccess("Template deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="templateManagerLayout">
      <div className="panel templateListPanel">
        <div className="railHeader">
          <div>
            <span className="sectionLabel">Global library</span>
            <h2>Email templates</h2>
          </div>
          <button className="ghostButton compactButton" type="button" onClick={startNew}>
            New
          </button>
        </div>
        {loading ? (
          <div className="stateCard">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="stateCard emptyStateInline">No templates yet.</div>
        ) : (
          <ul className="dataList templateList">
            {templates.map((template) => (
              <li key={template.id} className={selectedId === template.id ? "selected" : ""}>
                <button type="button" className="templateListButton" onClick={() => selectTemplate(template)}>
                  <strong>{template.name}</strong>
                  <small>{template.subject}</small>
                  <small>{template.key}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form className="panel templateEditor" onSubmit={save}>
        <div className="panelHeader">
          <span className="sectionLabel">{selectedId ? "Edit template" : "New template"}</span>
          <h2>{selectedId ? draft.name : "Create a global template"}</h2>
          <p>Changes apply to every position that references this template.</p>
        </div>
        <div className="formGrid">
          <label className="field">
            <span>Key</span>
            <input value={draft.key} disabled={Boolean(selectedId)} onChange={(event) => updateDraft("key", event.target.value)} required />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} required />
          </label>
          <label className="field fieldWide">
            <span>Subject</span>
            <input value={draft.subject} onChange={(event) => updateDraft("subject", event.target.value)} required />
            <PlaceholderPreview value={draft.subject} />
          </label>
          <label className="field fieldWide">
            <span>HTML</span>
            <textarea rows={12} value={draft.html} onChange={(event) => updateDraft("html", event.target.value)} required />
            <PlaceholderPreview value={draft.html} />
          </label>
          <label className="field fieldWide">
            <span>Plain text (optional)</span>
            <textarea rows={6} value={draft.text} onChange={(event) => updateDraft("text", event.target.value)} />
            <PlaceholderPreview value={draft.text} />
          </label>
        </div>
        {error && <div className="stateCard errorState">Error: {error}</div>}
        {success && <div className="stateCard successState">{success}</div>}
        <div className="actionsRow">
          <button className="primaryButton" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save template"}
          </button>
          {selectedId && (
            <button className="ghostButton dangerButton" type="button" onClick={remove} disabled={saving}>
              Delete template
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
