"use client";

import { useEffect, useRef } from "react";
import { publishMetric } from "../lib/publish-metric";

export function useDupHint(): boolean {
  const reached = useRef(false);
  useEffect(() => {
    if (reached.current) return;
    reached.current = true;
    void publishMetric("clinic_dup_hint_reached_total", 1, "counter", "dup-hint");
    void publishMetric("clinic_dup_hint_unhealthy", 0, "gauge", "dup-hint");
  }, []);
  return true;
}

export function reportDupHintError() {
  void publishMetric("clinic_dup_hint_error_total", 1, "counter", "dup-hint");
  void publishMetric("clinic_dup_hint_unhealthy", 1, "gauge", "dup-hint");
}
