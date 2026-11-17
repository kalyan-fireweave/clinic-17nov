"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect, useRef, useState } from "react";
import { publishMetric } from "../lib/publish-metric";

export function useDupHint(): boolean {
  const [on, setOn] = useState(false);
  const reached = useRef(false);
  useEffect(() => {
    const read = () => {
      // @fireweave-controlpoint dup-hint
      const next = fw.controlPoints.getBooleanValue("dup-hint", false);
      setOn(next);
      if (!next || reached.current) return;
      reached.current = true;
      void publishMetric("clinic_dup_hint_reached_total", 1, "counter", "dup-hint");
      void publishMetric("clinic_dup_hint_unhealthy", 0, "gauge", "dup-hint");
    };
    read();
    return fw.subscribe(read);
  }, []);
  return on;
}

export function reportDupHintError() {
  void publishMetric("clinic_dup_hint_error_total", 1, "counter", "dup-hint");
  void publishMetric("clinic_dup_hint_unhealthy", 1, "gauge", "dup-hint");
}
