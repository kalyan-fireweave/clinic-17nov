"use server";

import { readFileSync } from "node:fs";
import path from "node:path";

const NAMES = new Set([
  "clinic_theme_apply_success_total",
  "clinic_theme_apply_failure_total",
  "clinic_theme_apply_error_total",
  "clinic_theme_control_unhealthy",
  "clinic_theme_apply_duration_ms",
  "clinic_theme_switch_reached_total",
]);

type MetricKind = "counter" | "gauge" | "histogram";

function readEnvFile(file: string, into: Record<string, string>) {
  try {
    const raw = readFileSync(file, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const cut = trimmed.indexOf("=");
      const key = trimmed.slice(0, cut);
      const value = trimmed.slice(cut + 1);
      if (value && into[key] === undefined) into[key] = value;
    }
  } catch {
    // A missing local env file leaves the process environment in charge.
  }
}

function openObserveEnv() {
  const file: Record<string, string> = {};
  const cwd = process.cwd();
  readEnvFile(path.resolve(cwd, ".env"), file);
  readEnvFile(path.resolve(cwd, "../../.env"), file);
  const endpoint = process.env.OO_OTLP_ENDPOINT || file.OO_OTLP_ENDPOINT || "";
  const authorization = process.env.OO_AUTHORIZATION || file.OO_AUTHORIZATION || "";
  return { endpoint: endpoint.replace(/\/$/, ""), authorization };
}

export async function publishMetric(name: string, value: number, kind: MetricKind) {
  if (!NAMES.has(name) || !Number.isFinite(value)) return;
  const { endpoint, authorization } = openObserveEnv();
  if (!endpoint || !authorization) return;
  try {
    await fetch(`${endpoint}/ingest/metrics/_json`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify([
        {
          __name__: name,
          __type__: kind,
          value,
          control_point: "theme",
          _timestamp: Date.now() * 1000,
        },
      ]),
    });
  } catch {
    // Theme selection still applies when the metrics vendor is unreachable.
  }
}
