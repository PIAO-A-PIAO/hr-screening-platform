"use client";

import { FormEvent, useState } from "react";
import { Button } from "./ui/button";
import { FeedbackState } from "./ui/feedback-state";
import { FormField, formControlA11y } from "./ui/form-field";
import { Modal } from "./ui/modal";
import { Tabs } from "./ui/tabs";

type InviteCandidateModalProps = {
  open: boolean;
  positionId: string;
  hasTest: boolean;
  onClose: () => void;
  onCompleted: () => void;
};

type ImportRow = { row: number; name?: string; firstName?: string; lastName?: string; email: string };
type ImportResult = {
  totalRows: number; imported: number; skipped: number; invalid: number;
  rows: Array<{ row: number; email: string; status: "IMPORTED" | "SKIPPED" | "INVALID"; message: string }>;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim());
  return values;
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV must contain a header and at least one candidate row.");
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[ _-]/g, ""));
  const column = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const nameIndex = column(["name", "fullname"]);
  const firstIndex = column(["firstname", "givenname"]);
  const lastIndex = column(["lastname", "surname", "familyname"]);
  const emailIndex = column(["email", "emailaddress"]);
  if (emailIndex < 0 || (nameIndex < 0 && firstIndex < 0)) throw new Error("CSV requires email and either name or firstName/lastName columns.");
  if (lines.length - 1 > 500) throw new Error("CSV cannot contain more than 500 candidate rows.");
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    return {
      row: index + 2,
      name: nameIndex >= 0 ? values[nameIndex] : undefined,
      firstName: firstIndex >= 0 ? values[firstIndex] : undefined,
      lastName: lastIndex >= 0 ? values[lastIndex] : undefined,
      email: values[emailIndex] ?? "",
    };
  });
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as T & { message?: string | string[] };
  if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(", ") : payload.message ?? "Request failed");
  return payload;
}

export function InviteCandidateModal({ open, positionId, hasTest, onClose, onCompleted }: InviteCandidateModalProps) {
  const [mode, setMode] = useState<"single" | "csv">("single");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/positions/${encodeURIComponent(positionId)}/candidates`;

  async function invite(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      await post(`${base}/invite`, { firstName, lastName, email });
      setFirstName(""); setLastName(""); setEmail(""); onCompleted();
      setResult({ totalRows: 1, imported: 1, skipped: 0, invalid: 0, rows: [] });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Invitation failed"); }
    finally { setBusy(false); }
  }

  async function selectCsv(file?: File) {
    setError(""); setResult(null); setRows([]); setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("CSV file must be 2 MB or smaller."); return; }
    try { setRows(parseCsv(await file.text())); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "CSV could not be read"); }
  }

  async function importCsv() {
    setBusy(true); setError(""); setResult(null);
    try { const next = await post<ImportResult>(`${base}/import`, { rows }); setResult(next); onCompleted(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "CSV import failed"); }
    finally { setBusy(false); }
  }

  return <Modal open={open} title="Invite new candidate" description="Invite one candidate or import a validated CSV file." size="large" closeDisabled={busy} onClose={onClose}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Close</Button>{mode === "csv" && <Button loading={busy} disabled={!hasTest || rows.length === 0} onClick={() => void importCsv()}>Import {rows.length || ""} candidates</Button>}</>}>
    <Tabs label="Invitation method" activeId={mode} onChange={(id) => { setMode(id as "single" | "csv"); setError(""); setResult(null); }} items={[{ id: "single", label: "Single candidate" }, { id: "csv", label: "Import CSV" }]} />
    {!hasTest && <FeedbackState kind="error" title="Attach a test first" description="This position needs an interview test before candidates can be invited." />}
    {error && <FeedbackState kind="error" title="Invitation could not be processed" description={error} />}
    {result && <FeedbackState kind="success" title={result.totalRows === 1 ? "Invitation created" : "CSV import completed"} description={`${result.imported} imported, ${result.skipped} skipped, ${result.invalid} invalid.`} />}
    {mode === "single" ? <form className="inviteCandidateForm" onSubmit={invite}>
      <div className="inviteCandidateNameGrid">
        <FormField id="candidate-first-name" label="First name"><input {...formControlA11y("candidate-first-name", {})} value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></FormField>
        <FormField id="candidate-last-name" label="Last name"><input {...formControlA11y("candidate-last-name", {})} value={lastName} onChange={(event) => setLastName(event.target.value)} required /></FormField>
      </div>
      <FormField id="candidate-email" label="Email"><input {...formControlA11y("candidate-email", {})} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></FormField>
      <Button type="submit" loading={busy} disabled={!hasTest || !firstName.trim() || !lastName.trim() || !email.trim()}>Invite candidate</Button>
    </form> : <div className="candidateCsvImport">
      <FormField id="candidate-csv" label="CSV file" hint="Maximum 500 rows and 2 MB. Required: email plus name or firstName/lastName."><input {...formControlA11y("candidate-csv", { hint: "Maximum 500 rows and 2 MB. Required: email plus name or firstName/lastName." })} type="file" accept=".csv,text/csv" onChange={(event) => void selectCsv(event.target.files?.[0])} /></FormField>
      {fileName && <p><strong>{fileName}</strong> · {rows.length} candidate rows ready</p>}
      {result && result.rows.length > 0 && <div className="candidateImportResults"><table><thead><tr><th>Row</th><th>Email</th><th>Status</th><th>Result</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.row}-${row.email}`}><td>{row.row}</td><td>{row.email || "—"}</td><td>{row.status}</td><td>{row.message}</td></tr>)}</tbody></table></div>}
    </div>}
  </Modal>;
}
