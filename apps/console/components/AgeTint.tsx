"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect, useRef, useState } from "react";
import { publishMetric } from "../lib/publish-metric";

export function useAgeTint(): boolean {
  const [on, setOn] = useState(false);
  const reached = useRef(false);
  useEffect(() => {
    const read = () => {
      // @fireweave-controlpoint age-tint
      const next = fw.controlPoints.getBooleanValue("age-tint", false);
      setOn(next);
      if (!next || reached.current) return;
      reached.current = true;
      void publishMetric("clinic_age_tint_reached_total", 1, "counter", "age-tint");
      void publishMetric("clinic_age_tint_unhealthy", 0, "gauge", "age-tint");
    };
    read();
    return fw.subscribe(read);
  }, []);
  return on;
}

export function reportAgeTintError() {
  void publishMetric("clinic_age_tint_error_total", 1, "counter", "age-tint");
  void publishMetric("clinic_age_tint_unhealthy", 1, "gauge", "age-tint");
}
