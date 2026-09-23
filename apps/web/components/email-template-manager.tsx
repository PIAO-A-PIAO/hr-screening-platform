"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createEmailTemplate,
  deleteEmailTemplate,
  getEmailSettings,
  listEmailTemplates,
  updateEmailSettings,
  updateEmailTemplate,
  type EmailSettings,
  type EmailTemplateInput,
  type EmailTemplateSummary,
} from "../lib/position-api";

import { EmailPreview } from "./email-preview";
import { Modal } from "./ui/modal";

const blank: Required<EmailTemplateInput> = {
  key: "",
  name: "",
  subject: "",
  content: "",
  text: "",
  tags: [],
};
const templateVariables = ["candidate.name", "candidate.email", "candidate.firstName", "candidate.lastName", "position.title", "test.name", "inviteUrl"];

export function EmailTemplateManager() {
  const [items, setItems] = useState<EmailTemplateSummary[]>([]);
  const [settings, setSettings] = useState<EmailSettings | null>(null);

  const [pass, setPass] = useState("");
  const [q, setQ] = useState("");

  const [tags, setTags] = useState<string[]>([]);
  const [tagOpen, setTagOpen] = useState(false);

  const [draft, setDraft] =
    useState<Required<EmailTemplateInput>>(blank);

  const [editing, setEditing] =
    useState<EmailTemplateSummary | null>(null);

  const [preview, setPreview] =
    useState<EmailTemplateSummary | null>(null);

  const [removing, setRemoving] =
    useState<EmailTemplateSummary | null>(null);

  const [form, setForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [variableOpen, setVariableOpen] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: string) {
    const input = contentRef.current;
    const cursor = input?.selectionStart ?? draft.content.length;
    const before = draft.content.slice(0, cursor).replace(/\{\{$/, "");
    const next = `${before}{{${variable}}}${draft.content.slice(cursor)}`;
    setDraft({ ...draft, content: next });
    setVariableOpen(false);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(before.length + variable.length + 4, before.length + variable.length + 4); });
  }

  useEffect(() => {
    void Promise.all([
      listEmailTemplates(),
      getEmailSettings(),
    ])
      .then(([templateItems, emailSettings]) => {
        setItems(templateItems);
        setSettings(emailSettings);
      })
      .catch((e) => {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load email templates"
        );
      });
  }, []);

  const allTags = useMemo(() => {
    return [...new Set(items.flatMap((item) => item.tags))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [items]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query);

      const matchesTags =
        tags.length === 0 ||
        tags.some((tag) => item.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  }, [items, q, tags]);

  function toggleTagFilter(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  }

  async function removeTag(template: EmailTemplateSummary, tag: string) {
    if (!window.confirm(`Remove tag "${tag}"?`)) return;
    try {
      const saved = await updateEmailTemplate(template.id, {
        name: template.name, subject: template.subject, content: template.content,
        text: template.text ?? "", tags: template.tags.filter((item) => item !== tag),
      });
      setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove tag"); }
  }

  async function addTag(template: EmailTemplateSummary) {
    const tag = window.prompt("Add a tag")?.trim();
    if (!tag || template.tags.includes(tag)) return;
    try {
      const saved = await updateEmailTemplate(template.id, {
        name: template.name, subject: template.subject, content: template.content,
        text: template.text ?? "", tags: [...template.tags, tag],
      });
      setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add tag"); }
  }

  function open(template?: EmailTemplateSummary) {
    setTagsInput(template?.tags.join(", ") ?? "");
    setEditing(template ?? null);

    setDraft(
      template
        ? {
            key: template.key,
            name: template.name,
            subject: template.subject,
            content: template.content,
            text: template.text ?? "",
            tags: template.tags,
          }
        : blank
    );

    setForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const data: Required<EmailTemplateInput> = {
        ...draft,
        tags: tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),

        key: editing
          ? editing.key
          : draft.key ||
            draft.name
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, ""),
      };

      const saved = editing
        ? await updateEmailTemplate(editing.id, data)
        : await createEmailTemplate(data);

      setItems((current) =>
        editing
          ? current.map((item) =>
              item.id === saved.id ? saved : item
            )
          : [...current, saved]
      );

      setForm(false);
      setEditing(null);
      setDraft(blank);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Save failed"
      );
    }
  }

  async function removeTemplate() {
    if (!removing) return;

    setError(null);

    try {
      await deleteEmailTemplate(removing.id);

      setItems((current) =>
        current.filter(
          (item) => item.id !== removing.id
        )
      );

      setRemoving(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to delete template"
      );
    }
  }

  return (
    <section className="stack emailManager">

      {/* EMAIL SETTINGS */}

      <section className="panel">
        <h2>Email settings</h2>

        {settings && (
          <form
            className="formGrid"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);

              try {
                const updated =
                  await updateEmailSettings({
                    ...settings,
                    ...(pass
                      ? { smtpPassword: pass }
                      : {}),
                  });

                setSettings(updated);
                setPass("");
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Failed to save email settings"
                );
              }
            }}
          >
            <label className="field">
              <span>SMTP host</span>

              <input
                value={settings.smtpHost}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    smtpHost: e.target.value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>Port</span>

              <input
                type="number"
                value={settings.smtpPort}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    smtpPort: +e.target.value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>User</span>

              <input
                value={settings.smtpUser}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    smtpUser: e.target.value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>Password</span>

              <input
                type="password"
                value={pass}
                placeholder={settings.passwordConfigured ? "••••••••" : "Enter password"}
                onChange={(e) =>
                  setPass(e.target.value)
                }
              />
            </label>

            <label className="checkRow">
              <input
                type="checkbox"
                checked={settings.smtpSecure}
                onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
              />
              Use secure SMTP
            </label>

            <label className="field">
              <span>From</span>

              <input
                value={settings.emailFrom}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    emailFrom: e.target.value,
                  })
                }
              />
            </label>

            <button className="primaryButton">
              Save settings
            </button>
          </form>
        )}
      </section>

      {/* EMAIL TEMPLATES */}

      <section className="panel">

        <div className="railHeader">
          <h2>Email templates</h2>

          <button
            type="button"
            className="primaryButton"
            onClick={() => open()}
          >
            Create new template
          </button>
        </div>

        {/* FILTERS */}

        <div className="emailTemplateFilters">

          <input
            placeholder="Search title"
            value={q}
            onChange={(e) =>
              setQ(e.target.value)
            }
          />

          <div className="tagFilterMenu">

            <button
              type="button"
              onClick={() =>
                setTagOpen((current) => !current)
              }
            >
              All tags
              {tags.length > 0
                ? ` (${tags.length})`
                : ""}
              {" ▾"}
            </button>

            {tagOpen && (
              <div className="tagFilterOptions">

                {allTags.length === 0 ? (
                  <span>No tags</span>
                ) : (
                  allTags.map((tag) => (
                    <label key={tag}>

                      <span>{tag}</span>
                      <input
                        type="checkbox"
                        checked={tags.includes(tag)}
                        onChange={() =>
                          toggleTagFilter(tag)
                        }
                      />


                    </label>
                  ))
                )}

                {tags.length > 0 && (
                  <button
                    type="button"
                    className="clearTagFilters"
                    onClick={() =>
                      setTags([])
                    }
                  >
                    Clear filters
                  </button>
                )}

              </div>
            )}

          </div>

        </div>

        {error && (
          <p className="emailManagerError">
            {error}
          </p>
        )}

        {/* TEMPLATE LIST */}

        {shown.map((template) => (
          <article
            className="optionCard emailTemplateCard"
            key={template.id}
          >

            <div>

              <strong>
                {template.name}
              </strong>

              <p>
                {template.subject}
              </p>

              <div className="emailTagList">

                {template.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={
                      tags.includes(tag)
                        ? "emailTagChip active"
                        : "emailTagChip"
                    }
                    onClick={() => removeTag(template, tag)}
                  >
                    {tag}
                  </button>
                ))}

                <button type="button" className="emailTagAddButton" aria-label={`Add tag to ${template.name}`} onClick={() => addTag(template)}>+</button>

              </div>

            </div>

            <div className="emailTemplateActions">

              <button
                type="button"
                onClick={() =>
                  setPreview(template)
                }
              >
                Preview
              </button>

              <button
                type="button"
                onClick={() =>
                  open(template)
                }
              >
                Edit
              </button>

              <button
                type="button"
                className="danger"
                onClick={() =>
                  setRemoving(template)
                }
              >
                Delete
              </button>

            </div>

          </article>
        ))}

        {shown.length === 0 && (
          <p>
            No email templates match your filters.
          </p>
        )}

      </section>

      {/* CREATE / EDIT TEMPLATE */}

      <Modal
        open={form}
        title={
          editing
            ? "Edit email template"
            : "Create email template"
        }
        onClose={() => {
          setForm(false);
          setEditing(null);
        }}
      >

        <form
          className="formGrid"
          onSubmit={save}
        >

          <label className="field">
            <span>Title</span>

            <input
              required
              value={draft.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  name: e.target.value,
                })
              }
            />
          </label>

          <label className="field">
            <span>Tags (Example: invitation, reminder)</span>

            <input
              value={tagsInput}
              placeholder="e.g. onboarding, candidate"
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </label>

          <label className="field fieldWide">
            <span>Subject</span>

            <input
              required
              value={draft.subject}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  subject: e.target.value,
                })
              }
            />
          </label>

          <label className="field fieldWide variableField">
            <span>Message</span>

            <textarea
              ref={contentRef}
              required
              value={draft.content}
              placeholder="Write the email message in plain text…"
              onChange={(e) => {
                setDraft({ ...draft, content: e.target.value });
                setVariableOpen(e.target.value.slice(0, e.target.selectionStart).endsWith("{{"));
              }}
            />
            {variableOpen && <div className="variableMenu" role="listbox">{templateVariables.map((variable) => <button type="button" role="option" key={variable} onClick={() => insertVariable(variable)}>{`{{${variable}}}`}</button>)}</div>}
          </label>

          <button className="primaryButton">
            Save template
          </button>

        </form>

      </Modal>

      {/* PREVIEW */}

      <Modal
        open={!!preview}
        title="Email preview"
        onClose={() =>
          setPreview(null)
        }
      >

        {preview && (
          <EmailPreview
            from={
              settings?.emailFrom ?? ""
            }
            subject={preview.subject}
            html={preview.content.replace(/\n/g, "<br>")}
          />
        )}

      </Modal>

      {/* DELETE */}

      <Modal
        open={!!removing}
        title="Delete template?"
        onClose={() =>
          setRemoving(null)
        }
        footer={
          <button
            type="button"
            className="danger"
            onClick={() =>
              void removeTemplate()
            }
          >
            Delete
          </button>
        }
      >

        {removing && (
          <p>
            Delete{" "}
            <strong>
              {removing.name}
            </strong>
            ?
          </p>
        )}

      </Modal>

    </section>
  );
}
