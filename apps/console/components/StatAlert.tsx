"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isWaitingStat, statArrivals } from "../lib/stat-alert";
import { useToast } from "./Toast";

const QUIET = new Set(["/login", "/signup"]);
const POLL_MS = 10_000;

type Referral = {
  id: string;
  patientName: string | null;
  filename?: string;
  status: string;
  triage: string | null;
};

function statAlertOn() {
  // @fireweave-controlpoint stat-alert
  return fw.controlPoints.getBooleanValue("stat-alert", false);
}

export function StatAlert() {
  const toast = useToast();
  const path = usePathname();
  const [enabled, setEnabled] = useState(false);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  useEffect(() => {
    const read = () => setEnabled(statAlertOn());
    read();
    return fw.subscribe(read);
  }, []);

  useEffect(() => {
    if (!enabled) {
      primed.current = false;
      seen.current = new Set();
      return;
    }
    if (QUIET.has(path)) return;

    let stop = false;

    async function poll() {
      if (stop || document.hidden) return;
      const res = await fetch("/api/referrals");
      if (!res.ok) return;
      const rows = (await res.json()) as Referral[];
      if (!primed.current) {
        primed.current = true;
        for (const row of rows) {
          if (isWaitingStat(row)) seen.current.add(row.id);
        }
        return;
      }
      for (const row of statArrivals(seen.current, rows)) {
        seen.current.add(row.id);
        const name = row.patientName?.trim() || row.filename || "A referral";
        toast.push({
          tone: "ok",
          sticky: true,
          title: `${name} is STAT.`,
          href: "/inbox",
        });
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [enabled, path, toast]);

  return null;
}
