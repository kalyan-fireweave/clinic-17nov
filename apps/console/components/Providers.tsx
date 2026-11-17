"use client";

import type { ReactNode } from "react";
import { CountsProvider } from "../lib/counts";
import { TickProvider } from "../lib/tick";
import { StatAlert } from "./StatAlert";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TickProvider>
      <ToastProvider>
        <CountsProvider>
          <StatAlert />
          {children}
        </CountsProvider>
      </ToastProvider>
    </TickProvider>
  );
}
