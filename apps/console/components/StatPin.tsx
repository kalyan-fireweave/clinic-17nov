"use client";

import { useEffect, useRef } from "react";
import { publishMetric } from "../lib/publish-metric";

export function useStatPin(): boolean {
  const reached = useRef(false);
  useEffect(() => {
    if (reached.current) return;
    reached.current = true;
    void publishMetric("clinic_stat_pin_reached_total", 1, "counter", "stat-pin");
    void publishMetric("clinic_stat_pin_unhealthy", 0, "gauge", "stat-pin");
  }, []);
  return true;
}

export function reportStatPinError() {
  void publishMetric("clinic_stat_pin_error_total", 1, "counter", "stat-pin");
  void publishMetric("clinic_stat_pin_unhealthy", 1, "gauge", "stat-pin");
}
