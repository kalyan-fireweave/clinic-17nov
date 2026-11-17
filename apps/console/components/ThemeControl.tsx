"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect, useRef, useState } from "react";
import { publishMetric } from "../lib/publish-metric";
import { Button } from "./Button";

type ThemeMode = "light" | "dark";
type SignalKind = "health" | "error" | "metric" | "outcome";

const STORAGE_KEY = "clinic-theme";

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
  runtime?.runtime?.recordSignal?.({ ...signal, controlPointKey: "theme", value });
  void publishMetric(name, value, kind);
}

function signalFor(name: string, value: number): { kind: SignalKind; name: string; status?: string } {
  if (name === "clinic_theme_apply_success_total") return { kind: "outcome", name, status: "success" };
  if (name === "clinic_theme_apply_failure_total") return { kind: "outcome", name, status: "failure" };
  if (name === "clinic_theme_apply_error_total") return { kind: "error", name, status: "error" };
  if (name === "clinic_theme_control_unhealthy") return { kind: "health", name, status: value > 0 ? "unhealthy" : "ok" };
  return { kind: "metric", name, status: "recorded" };
}

function paint(mode: ThemeMode) {
  if (mode === "dark") document.documentElement.dataset.theme = "dark";
  else document.documentElement.removeAttribute("data-theme");
}

export function ThemeControl() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const reached = useRef(false);
  const restored = useRef(false);
  const reportedFailure = useRef(false);
  const lastHealth = useRef<number | null>(null);

  function reportHealth(value: number) {
    if (lastHealth.current === value) return;
    lastHealth.current = value;
    metrics.gauge("clinic_theme_control_unhealthy", value);
  }

  useEffect(() => {
    const started = performance.now();
    if (!reached.current) {
      reached.current = true;
      metrics.increment("clinic_theme_switch_reached_total");
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        paint(stored);
        setMode(stored);
        if (!restored.current) {
          restored.current = true;
          metrics.increment("clinic_theme_apply_success_total");
          metrics.record("clinic_theme_apply_duration_ms", Math.max(0, performance.now() - started));
        }
        reportHealth(0);
        return;
      }
      if (stored !== null) {
        window.localStorage.removeItem(STORAGE_KEY);
        paint("light");
        setMode("light");
        if (!reportedFailure.current) {
          reportedFailure.current = true;
          metrics.increment("clinic_theme_apply_failure_total");
          reportHealth(1);
        }
        return;
      }
      paint("light");
      setMode("light");
      reportHealth(0);
    } catch {
      paint("light");
      setMode("light");
      if (!reportedFailure.current) {
        reportedFailure.current = true;
        metrics.increment("clinic_theme_apply_failure_total");
        reportHealth(1);
      }
    }
  }, []);

  function choose(next: ThemeMode) {
    const started = performance.now();
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      paint(next);
      setMode(next);
      metrics.increment("clinic_theme_apply_success_total");
      metrics.record("clinic_theme_apply_duration_ms", Math.max(0, performance.now() - started));
      reportHealth(0);
    } catch (error) {
      paint("light");
      setMode("light");
      if (error instanceof DOMException) metrics.increment("clinic_theme_apply_failure_total");
      else metrics.increment("clinic_theme_apply_error_total");
      reportHealth(1);
    }
  }

  return (
    <div className="theme-control">
      <div className="nav-label" id="theme-label">
        Theme
      </div>
      <div className="theme-options" role="group" aria-labelledby="theme-label">
        <Button variant="ghost" size="sm" aria-pressed={mode === "light"} onClick={() => choose("light")}>
          Light
        </Button>
        <Button variant="ghost" size="sm" aria-pressed={mode === "dark"} onClick={() => choose("dark")}>
          Dark
        </Button>
      </div>
    </div>
  );
}
