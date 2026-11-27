"use client";

import { useEffect, useRef } from "react";
import { publishMetric } from "../lib/publish-metric";
import { emptyHintCopy } from "../lib/empty-hint";

export function useEmptyHint(): string {
  const reached = useRef(false);
  useEffect(() => {
    if (reached.current) return;
    reached.current = true;
    void publishMetric("clinic_empty_hint_reached_total", 1, "counter", "empty-hint");
    void publishMetric("clinic_empty_hint_unhealthy", 0, "gauge", "empty-hint");
  }, []);
  return emptyHintCopy();
}

export function reportEmptyHintError() {
  void publishMetric("clinic_empty_hint_error_total", 1, "counter", "empty-hint");
  void publishMetric("clinic_empty_hint_unhealthy", 1, "gauge", "empty-hint");
}
