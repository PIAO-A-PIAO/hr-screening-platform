"use client";

import { useState } from "react";
import { Button, ButtonLink } from "./button";
import { Card, CardContent, CardFooter, CardHeader } from "./card";
import { ConfirmDialog } from "./confirm-dialog";
import { FeedbackState } from "./feedback-state";
import { FormField, formControlA11y } from "./form-field";
import { Modal } from "./modal";
import { PageHeader } from "./page-header";
import { Pagination } from "./pagination";
import { StatusBadge } from "./status-badge";
import { TabItem, Tabs } from "./tabs";
import { TagChip } from "./tag-chip";

const demoTabs: TabItem[] = [
  { id: "invited", label: "Invited", count: 12 },
  { id: "evaluate", label: "To Evaluate", count: 4 },
  { id: "shortlisted", label: "Shortlisted", count: 2 },
  { id: "discarded", label: "Discarded", count: 1 },
];

export function UiShowcase() {
  const [activeTab, setActiveTab] = useState("invited");
  const [selectedTag, setSelectedTag] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");

  return (
    <div className="dsShowcase">
      <PageHeader
        eyebrow="P2-M03"
        title="UI foundations"
        description="Development-only examples of the shared components and states used by Phase 2 pages."
        backHref="/dev"
        backLabel="Development"
        actions={<ButtonLink href="/positions" variant="secondary">View positions</ButtonLink>}
      />

      <section className="dsShowcaseSection">
        <header><h2>Buttons</h2><p>Shared actions with consistent size, focus, disabled, and loading behavior.</p></header>
        <div className="dsShowcaseRow">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="dsShowcaseSection">
        <header><h2>Status and tags</h2><p>Text and colour communicate state together.</p></header>
        <div className="dsShowcaseRow">
          <StatusBadge status="DRAFT" />
          <StatusBadge status="OPEN" />
          <StatusBadge status="IN_PROGRESS" />
          <StatusBadge status="TO_BE_EVALUATED" />
          <StatusBadge status="SHORTLISTED" />
          <StatusBadge status="DISCARDED" />
        </div>
        <div className="dsShowcaseRow">
          <TagChip label="Engineering" />
          <TagChip label="Selected filter" selected={selectedTag} onClick={() => setSelectedTag((current) => !current)} />
          <TagChip label="Removable" onRemove={() => undefined} />
        </div>
      </section>

      <section className="dsShowcaseSection">
        <header><h2>Cards</h2><p>Composable surfaces for positions, candidates, configuration, and reviews.</p></header>
        <div className="dsShowcaseGrid">
          <Card>
            <CardHeader><div><h3>Standard card</h3><StatusBadge status="OPEN" /></div></CardHeader>
            <CardContent><p>Use the header, content, and footer regions only when the hierarchy needs them.</p></CardContent>
            <CardFooter><Button size="small" variant="secondary">Configure</Button><Button size="small">Open</Button></CardFooter>
          </Card>
          <Card interactive selected>
            <CardHeader><div><h3>Selected card</h3><StatusBadge status="TO_BE_EVALUATED" /></div></CardHeader>
            <CardContent><p>Interactive and selected states remain visible without relying only on colour.</p></CardContent>
          </Card>
        </div>
      </section>

      <section className="dsShowcaseSection">
        <header><h2>Forms</h2><p>Labels, hints, and errors remain associated with their controls.</p></header>
        <div className="dsShowcaseGrid">
          <FormField id="showcase-title" label="Position title" hint="Use the title candidates will recognize.">
            <input className="dsFormControl" {...formControlA11y("showcase-title", { hint: "Use the title candidates will recognize." })} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Software Engineer" />
          </FormField>
          <FormField id="showcase-email" label="Candidate email" error="Enter a valid email address.">
            <input className="dsFormControl" {...formControlA11y("showcase-email", { error: "Enter a valid email address." })} defaultValue="invalid-email" />
          </FormField>
        </div>
      </section>

      <section className="dsShowcaseSection">
        <header><h2>Tabs and pagination</h2><p>Reusable navigation for status views and paged results.</p></header>
        <Tabs label="Candidate status" items={demoTabs} activeId={activeTab} onChange={setActiveTab} />
        <Pagination page={page} totalPages={5} onPageChange={setPage} />
      </section>

      <section className="dsShowcaseSection">
        <header><h2>Feedback states</h2><p>Pages retain a useful next action during loading, empty, error, and success states.</p></header>
        <div className="dsShowcaseGrid">
          <FeedbackState kind="loading" title="Loading positions" description="Retrieving the latest position data." />
          <FeedbackState kind="empty" title="No positions yet" description="Create the first position to begin the hiring workflow." actions={<Button>Create position</Button>} />
          <FeedbackState kind="error" title="Positions could not be loaded" description="Check the connection and try again." actions={<Button variant="secondary">Retry</Button>} />
          <FeedbackState kind="success" title="Invitation sent" description="The candidate can now open the assigned interview." />
        </div>
      </section>

      <section className="dsShowcaseSection">
        <header><h2>Dialogs</h2><p>Accessible modal and destructive confirmation patterns.</p></header>
        <div className="dsShowcaseRow">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Open confirmation</Button>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="Invite candidate"
        description="This example demonstrates focus management and responsive dialog layout."
        onClose={() => setModalOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={() => setModalOpen(false)}>Invite</Button></>}
      >
        <FormField id="modal-email" label="Candidate email">
          <input className="dsFormControl" id="modal-email" type="email" placeholder="candidate@example.com" />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete template?"
        description="The template will no longer be available for new email rules."
        confirmLabel="Delete template"
        dangerous
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />
    </div>
  );
}
