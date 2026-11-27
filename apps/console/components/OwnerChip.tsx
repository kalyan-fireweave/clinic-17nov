"use client";

import { useEffect, useRef } from "react";
import { publishMetric } from "../lib/publish-metric";

export function useOwnerChip(): boolean {
  const reached = useRef(false);
  useEffect(() => {
    if (reached.current) return;
    reached.current = true;
    void publishMetric("clinic_owner_chip_reached_total", 1, "counter", "owner-chip");
    void publishMetric("clinic_owner_chip_unhealthy", 0, "gauge", "owner-chip");
  }, []);
  return true;
}

export function reportOwnerChipError() {
  void publishMetric("clinic_owner_chip_error_total", 1, "counter", "owner-chip");
  void publishMetric("clinic_owner_chip_unhealthy", 1, "gauge", "owner-chip");
}
