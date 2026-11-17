"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Banner } from "./Banner";
import { duplicatePatients } from "../lib/dup-hint";
import { reportDupHintError, useDupHint } from "./DupHint";
import { Button } from "./Button";
import { ConfidenceBar } from "./ConfidenceBar";
import { Drawer } from "./Drawer";
import { EmptyState } from "./EmptyState";
import { Modal } from "./Modal";
import { Page, PageHeader } from "./PageHeader";
import { Skeleton } from "./Skeleton";
import { StatusPill } from "./StatusPill";
import { TriagePill } from "./TriagePill";
import { useToast } from "./Toast";
import { COPY } from "../lib/copy";
import { ERROR_CODES } from "../lib/errors";
import { useCounts } from "../lib/counts";
import { inFlight, listSignature } from "../lib/list";
import { useTick } from "../lib/tick";
import { ago } from "../lib/time";
import { publishMetric } from "../lib/publish-metric";
import { reportEmptyHintError, useEmptyHint } from "./EmptyHint";
import { pinStatFirst } from "../lib/stat-pin";
import { reportStatPinError, useStatPin } from "./StatPin";
import { ownerLabel } from "../lib/owner-chip";
import { reportOwnerChipError, useOwnerChip } from "./OwnerChip";
import { ageTintBackground, waitingAgeMs } from "../lib/age-tint";
import { reportAgeTintError, useAgeTint } from "./AgeTint";
import { pdfFiles, postReferral } from "../lib/upload";

type Referral = {
  id: string;
  patientName: string | null;
  status: string;
  triage: string | null;
  filename: string;
  detail?: string;
  reason?: string | null;
  confidence?: number | null;
  sessionId?: string | null;
  createdAt?: string;
  owner?: string | null;
};

type Field = { name: string; value: string; confidence?: number };

const filters = [
  ["all", "All"],
  ["awaiting_review", "Ready"],
  ["fax_back", "Sent back"],
  ["flagged", "Needs a person"],
  ["ineligible", "Ineligible"],
  ["failed", "Could not read"],
] as const;

const triageFilters = [
  ["all", "All"],
  ["STAT", "STAT"],
  ["symptomatic", "Symptomatic"],
  ["screening", "Screening"],
] as const;

const TRIAGE_KEY = "clinic-triage-filter";

type SignalKind = "health" | "error" | "metric" | "outcome";

const metrics = {
  increment(name: string) {
    note(name, 1, "counter");
  },
  record(name: string, value: number) {
    note(name, value, "histogram");
  },
  gauge(name: string, value: number) {
    note(name, value, "gauge");
  },
};

function note(name: string, value: number, kind: "counter" | "gauge" | "histogram") {
  const signal = signalFor(name, value);
  const runtime = fw.client() as { runtime?: { recordSignal?: (signal: typeof signal) => void } } | undefined;
  runtime?.runtime?.recordSignal?.({ ...signal, controlPointKey: "triage", value });
  void publishMetric(name, value, kind, "triage");
}

function signalFor(name: string, value: number): { kind: SignalKind; name: string; status?: string } {
  if (name === "clinic_triage_filter_success_total") return { kind: "outcome", name, status: "success" };
  if (name === "clinic_triage_filter_failure_total") return { kind: "outcome", name, status: "failure" };
  if (name === "clinic_triage_filter_error_total") return { kind: "error", name, status: "error" };
  if (name === "clinic_triage_filter_unhealthy") return { kind: "health", name, status: value > 0 ? "unhealthy" : "ok" };
  return { kind: "metric", name, status: "recorded" };
}

function allowedTriage(value: string) {
  return value === "all" || value === "STAT" || value === "symptomatic" || value === "screening";
}

function nextLine(row: Referral) {
  if (row.status === "fax_back") return row.detail ? `Send it back — ${row.detail}` : "Send it back";
  if (row.status === "failed") return "Could not read this fax";
  if (row.status === "ineligible") return row.detail || "Ineligible";
  return "";
}

export function InboxTable() {
  const now = useTick();
  const dupHint = useDupHint();
  const emptyHint = useEmptyHint();
  const statPin = useStatPin();
  const ownerChip = useOwnerChip();
  const ageTint = useAgeTint();
  const { setInboxRows } = useCounts();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [triage, setTriage] = useState("all");
  const [query, setQuery] = useState("");
  const reached = useRef(false);
  const restored = useRef(false);
  const reportedFailure = useRef(false);
  const lastHealth = useRef<number | null>(null);

  function reportHealth(value: number) {
    if (lastHealth.current === value) return;
    lastHealth.current = value;
    metrics.gauge("clinic_triage_filter_unhealthy", value);
  }

  function chooseTriage(next: string) {
    const started = performance.now();
    if (!allowedTriage(next)) {
      window.sessionStorage.removeItem(TRIAGE_KEY);
      setTriage("all");
      if (!reportedFailure.current) {
        reportedFailure.current = true;
        metrics.increment("clinic_triage_filter_failure_total");
        reportHealth(1);
      }
      return;
    }
    try {
      window.sessionStorage.setItem(TRIAGE_KEY, next);
    } catch (error) {
      setTriage("all");
      if (error instanceof DOMException) metrics.increment("clinic_triage_filter_failure_total");
      else metrics.increment("clinic_triage_filter_error_total");
      reportHealth(1);
      return;
    }
    setTriage(next);
    metrics.increment("clinic_triage_filter_success_total");
    metrics.record("clinic_triage_filter_duration_ms", Math.max(0, performance.now() - started));
    reportHealth(0);
  }
  const [drag, setDrag] = useState(false);
  const [openId, setOpenId] = useState("");
  const [tab, setTab] = useState<"details" | "pdf">("details");
  const [fields, setFields] = useState<Field[]>([]);
  const [confirm, setConfirm] = useState<"reject" | "flag" | "">("");
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState("");

  async function load() {
    const res = await fetch("/api/referrals");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) return;
    const next = (await res.json()) as Referral[];
    setRows((prev) => (prev && listSignature(prev) === listSignature(next) ? prev : next));
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!reached.current) {
      reached.current = true;
      metrics.increment("clinic_triage_filter_reached_total");
    }
    try {
      const stored = window.sessionStorage.getItem(TRIAGE_KEY);
      if (stored === null) {
        reportHealth(0);
        return;
      }
      if (!allowedTriage(stored)) {
        window.sessionStorage.removeItem(TRIAGE_KEY);
        setTriage("all");
        if (!reportedFailure.current) {
          reportedFailure.current = true;
          metrics.increment("clinic_triage_filter_failure_total");
          reportHealth(1);
        }
        return;
      }
      setTriage(stored);
      if (!restored.current && stored !== "all") {
        restored.current = true;
        metrics.increment("clinic_triage_filter_success_total");
        metrics.record("clinic_triage_filter_duration_ms", 0);
      }
      reportHealth(0);
    } catch {
      setTriage("all");
      if (!reportedFailure.current) {
        reportedFailure.current = true;
        metrics.increment("clinic_triage_filter_failure_total");
        reportHealth(1);
      }
    }
  }, []);

  useEffect(() => {
    if (rows) setInboxRows(rows);
  }, [rows, setInboxRows]);

  useEffect(() => {
    if (!rows || !inFlight(rows)) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [rows]);

  useEffect(() => {
    if (!openId) return;
    void (async () => {
      const res = await fetch(`/api/referrals/${openId}`);
      if (!res.ok) return;
      const body = (await res.json()) as { fields: Field[] };
      setFields(body.fields ?? []);
    })();
  }, [openId]);

  async function upload(list: FileList | File[]) {
    const batch = pdfFiles(list);
    if (batch.length === 0 || sending) return;
    setSending(true);
    const optimistic = batch.map((file) => ({
      id: `tmp-${file.name}-${file.size}-${file.lastModified}`,
      patientName: file.name,
      status: "extracting",
      triage: null,
      filename: file.name,
    }));
    setRows((current) => [...optimistic, ...(current ?? []).filter((row) => !optimistic.some((item) => item.filename === row.filename && row.id.startsWith("tmp-")))]);
    let failed = 0;
    let lastDuplicate = "";
    for (const file of batch) {
      const result = await postReferral(file);
      if (!result.ok) failed += 1;
      else if (result.duplicate && result.referralId) lastDuplicate = result.referralId;
    }
    await load();
    setSending(false);
    if (failed) {
      toast.push({
        tone: "error",
        title: batch.length === 1 ? "That fax did not go through." : COPY.someFailed,
        code: ERROR_CODES.EXTRACT_FAILED,
      });
      return;
    }
    if (lastDuplicate) {
      toast.push({ tone: "ok", title: COPY.duplicate });
      setFlash(lastDuplicate);
      window.setTimeout(() => setFlash(""), 1500);
    }
  }

  async function act(action: "approve" | "reject" | "flag") {
    if (!openId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/referrals/${openId}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { outcome?: string; reason?: string };
      if (!res.ok || body.outcome === "refused") {
        toast.push({ tone: "error", title: body.reason ?? "Could not save the decision", code: ERROR_CODES.RUNNER_REFUSED });
        return;
      }
      const sessionId = rows?.find((row) => row.id === openId)?.sessionId;
      setOpenId("");
      setConfirm("");
      await load();
      if (action === "approve" && sessionId) {
        window.location.href = `/sessions/${sessionId}`;
      }
    } finally {
      setPending(false);
    }
  }

  const visible = useMemo(() => {
    const list = rows ?? [];
    const filtered = list.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (triage !== "all" && row.triage !== triage) return false;
      const hay = `${row.patientName ?? ""} ${row.filename} ${row.reason ?? ""}`.toLowerCase();
      return hay.includes(query.trim().toLowerCase());
    });
    if (statPin && filtered.some((row) => row.triage !== "STAT" && row.triage !== "symptomatic" && row.triage !== "screening" && row.triage !== null)) {
      reportStatPinError();
    }
    return statPin ? pinStatFirst(filtered) : filtered;
  }, [rows, filter, query, triage, statPin]);

  const open = rows?.find((row) => row.id === openId) ?? null;
  const duplicates = dupHint ? duplicatePatients(rows ?? []) : [];
  if (dupHint && (rows ?? []).some((row) => row.patientName === undefined)) reportDupHintError();
  const counts = Object.fromEntries(filters.map(([id]) => [id, (rows ?? []).filter((row) => id === "all" || row.status === id).length]));
  const triageCounts = Object.fromEntries(
    triageFilters.map(([id]) => [id, (rows ?? []).filter((row) => id === "all" || row.triage === id).length]),
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDrag(false);
        if (event.dataTransfer.files.length) void upload(event.dataTransfer.files);
      }}
    >
      {drag ? <div className="drop-over">Drop the faxes here</div> : null}
      <Page>
        <PageHeader
          title="Referral inbox"
          subtitle={<span className="mono muted">{rows?.length ?? 0} referrals</span>}
          actions={
            <>
              <input
                className="search"
                placeholder="Search name, DOB, or referring provider"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <input
                id="file"
                ref={fileRef}
                className="hidden-file"
                name="file"
                type="file"
                accept="application/pdf"
                multiple
                onChange={(event) => {
                  if (event.target.files?.length) void upload(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button variant="primary" size="lg" aria-label="Upload" onClick={() => fileRef.current?.click()}>
                Upload referral
              </Button>
            </>
          }
        />
        <div className="filters">
          {filters.map(([id, name]) => (
            <button key={id} className={filter === id ? "chip on" : "chip"} type="button" onClick={() => setFilter(id)}>
              {name}
              <span className="count">{counts[id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="filters" role="group" aria-label="Triage">
          {triageFilters.map(([id, name]) => (
            <button key={id} className={triage === id ? "chip on" : "chip"} type="button" onClick={() => chooseTriage(id)}>
              {name}
              <span className="count">{triageCounts[id] ?? 0}</span>
            </button>
          ))}
        </div>
        {duplicates.length > 0 ? (
          <Banner>{duplicates.join(", ")} may have been sent twice. Check the waiting rows before you review.</Banner>
        ) : null}
        {rows == null ? <Skeleton /> : null}
        {rows && rows.length === 0 ? (
          <EmptyState
            title={COPY.emptyInbox}
            action={
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                {COPY.emptyInboxCta}
              </Button>
            }
          />
        ) : null}
        {rows && rows.length === 0 && emptyHint ? <p className="muted">{emptyHint}</p> : null}
        {rows && rows.length === 0 && emptyHint === "" ? reportEmptyHintError() : null}
        {rows && rows.length > 0 && visible.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters."
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                  chooseTriage("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : null}
        {visible.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: "25%" }}>
                  Patient
                </th>
                <th scope="col" style={{ width: "12%" }}>
                  Status
                </th>
                <th scope="col" style={{ width: "10%" }}>
                  Triage
                </th>
                <th scope="col" style={{ width: "15%" }}>
                  Referring
                </th>
                <th scope="col" style={{ width: "10%" }}>
                  Confidence
                </th>
                <th scope="col" style={{ width: "13%" }}>
                  Received
                </th>
                <th scope="col" style={{ width: "5%" }}>
                  {" "}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                if (ownerChip && row.owner !== undefined && row.owner !== null && !row.owner.trim()) reportOwnerChipError();
                if (ageTint && row.createdAt && waitingAgeMs(row.createdAt, now) === null) reportAgeTintError();
                const ready = row.status === "awaiting_review";
                return (
                  <tr
                    key={row.id}
                    className={flash === row.id ? "row-flash" : ""}
                    style={ageTint && ageTintBackground(waitingAgeMs(row.createdAt, now), row.status) ? { background: "#fff3d6" } : undefined}
                  >
                    <td>
                      <h2 className="patient">{row.patientName ?? row.filename}</h2>
                      <div className="muted">{row.filename}</div>
                      {ownerChip ? <div className="muted">{ownerLabel(row.owner)}</div> : null}
                      {row.status === "extracting" ? <div className="read-bar"><i /></div> : null}
                      {nextLine(row) ? <p className="missing">{nextLine(row)}</p> : null}
                    </td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td>
                      <TriagePill triage={row.triage} />
                    </td>
                    <td className="muted">—</td>
                    <td>
                      <ConfidenceBar value={row.confidence ?? null} />
                    </td>
                    <td className="mono muted" title={row.createdAt}>
                      {ago(row.createdAt, now)}
                    </td>
                    <td>
                      {ready ? (
                        <a
                          className="btn btn-primary btn-sm"
                          href={`/hub/${row.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setTab("details");
                            setOpenId(row.id);
                          }}
                        >
                          Review {row.patientName}
                        </a>
                      ) : (
                        <a className="btn btn-ghost btn-sm" href={`/api/referrals/${row.id}/file`} target="_blank" rel="noreferrer" aria-label="View file">
                          <ChevronRight size={16} aria-hidden="true" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </Page>

      {open ? (
        <Drawer
          title={open.patientName ?? open.filename}
          extra={<StatusPill status={open.status} />}
          onClose={() => setOpenId("")}
          footer={
            open.status === "awaiting_review" ? (
              <>
                <Button variant="primary" loading={pending} onClick={() => void act("approve")}>
                  Looks good
                </Button>
                <Button variant="danger-ghost" onClick={() => setConfirm("reject")}>
                  Reject
                </Button>
                <Button variant="ghost" onClick={() => setConfirm("flag")}>
                  Flag
                </Button>
              </>
            ) : open.status === "fax_back" ? (
              <Button variant="primary" disabled>
                Send back to referring provider
              </Button>
            ) : null
          }
        >
          <div className="tabs">
            <button className={tab === "details" ? "on" : ""} type="button" onClick={() => setTab("details")}>
              Details
            </button>
            <button className={tab === "pdf" ? "on" : ""} type="button" onClick={() => setTab("pdf")}>
              PDF
            </button>
          </div>
          {tab === "details" ? (
            <div className="stack">
              {open.status === "fax_back" ? <Banner>{nextLine(open)}</Banner> : null}
              {open.status === "ineligible" ? <Banner>{open.detail || "Cannot take this referral."}</Banner> : null}
              {open.status === "failed" ? <Banner tone="error">{COPY.unknownFile}</Banner> : null}
              <div className="fields">
                {fields
                  .filter((field) => field.value)
                  .map((field) => (
                    <div key={field.name}>
                      <div className="muted">{field.name}</div>
                      <div className="patient">{field.value}</div>
                    </div>
                  ))}
              </div>
              {open.triage ? (
                <p>
                  Ready for review. {open.reason || ""} {open.triage === "STAT" ? "· STAT" : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <iframe title="Referral PDF" src={`/api/referrals/${open.id}/file`} style={{ width: "100%", height: 420, border: 0 }} />
          )}
        </Drawer>
      ) : null}

      {confirm ? (
        <Modal title={confirm === "reject" ? "Reject referral" : "Flag referral"} onClose={() => setConfirm("")}>
          <p>{confirm === "reject" ? COPY.confirmReject : COPY.confirmFlag}</p>
          <div className="actions">
            <Button variant={confirm === "reject" ? "danger" : "primary"} loading={pending} onClick={() => void act(confirm)}>
              {confirm === "reject" ? "Reject" : "Flag"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirm("")}>
              Cancel
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
