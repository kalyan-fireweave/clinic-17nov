"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect, useRef, useState } from "react";
import { publishMetric } from "../lib/publish-metric";

export function useOwnerChip(): boolean {
  const [on, setOn] = useState(false);
  const reached = useRef(false);
  useEffect(() => {
    const read = () => {
      // @fireweave-controlpoint owner-chip
      const next = fw.controlPoints.getBooleanValue("owner-chip", false);
      setOn(next);
      if (!next || reached.current) return;
      reached.current = true;
      void publishMetric("clinic_owner_chip_reached_total", 1, "counter", "owner-chip");
      void publishMetric("clinic_owner_chip_unhealthy", 0, "gauge", "owner-chip");
    };
    read();
    return fw.subscribe(read);
  }, []);
  return on;
}

export function reportOwnerChipError() {
  void publishMetric("clinic_owner_chip_error_total", 1, "counter", "owner-chip");
  void publishMetric("clinic_owner_chip_unhealthy", 1, "gauge", "owner-chip");
}
