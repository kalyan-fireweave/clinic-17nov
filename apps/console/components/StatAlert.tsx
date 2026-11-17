"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isWaitingStat, statArrivals } from "../lib/stat-alert";
import { publishMetric } from "../lib/publish-metric";
import { useToast } from "./Toast";

const QUIET = new Set(["/login", "/signup"]);
const POLL_MS = 10_000;

type Referral = {
  id: string;
  patientName: string | null;
  filename?: string;
  status: string;
  triage: string | null;
};

type SignalKind = "health" | "error" | "metric" | "outcome";
type Signal = { kind: SignalKind; name: string; status?: string };

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
  const runtime = fw.client() as { runtime?: { recordSignal?: (signal: Signal) => void } } | undefined;
  runtime?.runtime?.recordSignal?.({ ...signal, controlPointKey: "stat-alert", value } as Signal);
  void publishMetric(name, value, kind, "stat-alert");
}

function signalFor(name: string, value: number): Signal {
  if (name === "clinic_stat_alert_shown_total" || name === "clinic_stat_alert_reached_total") {
    return { kind: "outcome", name, status: "success" };
  }
  if (name === "clinic_stat_alert_error_total") return { kind: "error", name, status: "error" };
  if (name === "clinic_stat_alert_unhealthy") return { kind: "health", name, status: value > 0 ? "unhealthy" : "ok" };
  return { kind: "metric", name, status: "recorded" };
}

function statAlertOn() {
  // @fireweave-controlpoint stat-alert
  return fw.controlPoints.getBooleanValue("stat-alert", false);
}

export function StatAlert() {
  const toast = useToast();
  const path = usePathname();
  const [enabled, setEnabled] = useState(false);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);
  const reached = useRef(false);
  const lastHealth = useRef<number | null>(null);

  function reportHealth(value: number) {
    if (lastHealth.current === value) return;
    lastHealth.current = value;
    metrics.gauge("clinic_stat_alert_unhealthy", value);
  }

  useEffect(() => {
    const read = () => setEnabled(statAlertOn());
    read();
    return fw.subscribe(read);
  }, []);

  useEffect(() => {
    if (!enabled) {
      primed.current = false;
      seen.current = new Set();
      return;
    }
    if (QUIET.has(path)) return;
    if (!reached.current) {
      reached.current = true;
      metrics.increment("clinic_stat_alert_reached_total");
    }

    let stop = false;

    async function poll() {
      if (stop || document.hidden) return;
      const started = performance.now();
      try {
        const res = await fetch("/api/referrals");
        if (!res.ok) {
          metrics.increment("clinic_stat_alert_error_total");
          reportHealth(1);
          return;
        }
        const rows = (await res.json()) as Referral[];
        if (!Array.isArray(rows)) {
          metrics.increment("clinic_stat_alert_error_total");
          reportHealth(1);
          return;
        }
        metrics.record("clinic_stat_alert_duration_ms", Math.max(0, performance.now() - started));
        reportHealth(0);
        if (!primed.current) {
          primed.current = true;
          for (const row of rows) {
            if (isWaitingStat(row)) seen.current.add(row.id);
          }
          return;
        }
        for (const row of statArrivals(seen.current, rows)) {
          seen.current.add(row.id);
          const name = row.patientName?.trim() || row.filename || "A referral";
          metrics.increment("clinic_stat_alert_shown_total");
          toast.push({
            tone: "ok",
            sticky: true,
            title: `${name} is STAT.`,
            href: "/inbox",
          });
        }
      } catch {
        metrics.increment("clinic_stat_alert_error_total");
        reportHealth(1);
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [enabled, path, toast]);

  return null;
}
