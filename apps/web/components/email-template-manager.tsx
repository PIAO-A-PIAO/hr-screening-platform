"use client";

import { useEffect, useMemo, useState } from "react";

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
  html: "",
  text: "",
  tags: [],
};

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

  function open(template?: EmailTemplateSummary) {
    setEditing(template ?? null);

    setDraft(
      template
        ? {
            key: template.key,
            name: template.name,
            subject: template.subject,
            html: template.html,
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
                placeholder="Leave blank to keep"
                onChange={(e) =>
                  setPass(e.target.value)
                }
              />
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
                    onClick={() =>
                      toggleTagFilter(tag)
                    }
                  >
                    {tag}
                  </button>
                ))}

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
            <span>Tags</span>

            <input
              value={draft.tags.join(", ")}
              placeholder="e.g. onboarding, candidate"
              onChange={(e) =>
                setDraft({
                  ...draft,

                  tags: e.target.value
                    .split(",")
                    .map((tag) =>
                      tag.trim()
                    )
                    .filter(Boolean),
                })
              }
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

          <label className="field fieldWide">
            <span>HTML</span>

            <textarea
              required
              value={draft.html}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  html: e.target.value,
                })
              }
            />
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
            html={preview.html}
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