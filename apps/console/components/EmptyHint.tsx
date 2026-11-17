"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect, useRef, useState } from "react";
import { publishMetric } from "../lib/publish-metric";
import { emptyHintCopy } from "../lib/empty-hint";

export function useEmptyHint(): string | null {
  const [on, setOn] = useState(false);
  const reached = useRef(false);
  useEffect(() => {
    const read = () => {
      // @fireweave-controlpoint empty-hint
      const next = fw.controlPoints.getBooleanValue("empty-hint", false);
      setOn(next);
      if (!next || reached.current) return;
      reached.current = true;
      void publishMetric("clinic_empty_hint_reached_total", 1, "counter", "empty-hint");
      void publishMetric("clinic_empty_hint_unhealthy", 0, "gauge", "empty-hint");
    };
    read();
    return fw.subscribe(read);
  }, []);
  return on ? emptyHintCopy() : null;
}

export function reportEmptyHintError() {
  void publishMetric("clinic_empty_hint_error_total", 1, "counter", "empty-hint");
  void publishMetric("clinic_empty_hint_unhealthy", 1, "gauge", "empty-hint");
}
