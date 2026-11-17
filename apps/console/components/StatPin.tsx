"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect, useRef, useState } from "react";
import { publishMetric } from "../lib/publish-metric";

export function useStatPin(): boolean {
  const [on, setOn] = useState(false);
  const reached = useRef(false);
  useEffect(() => {
    const read = () => {
      // @fireweave-controlpoint stat-pin
      const next = fw.controlPoints.getBooleanValue("stat-pin", false);
      setOn(next);
      if (!next || reached.current) return;
      reached.current = true;
      void publishMetric("clinic_stat_pin_reached_total", 1, "counter", "stat-pin");
      void publishMetric("clinic_stat_pin_unhealthy", 0, "gauge", "stat-pin");
    };
    read();
    return fw.subscribe(read);
  }, []);
  return on;
}

export function reportStatPinError() {
  void publishMetric("clinic_stat_pin_error_total", 1, "counter", "stat-pin");
  void publishMetric("clinic_stat_pin_unhealthy", 1, "gauge", "stat-pin");
}
