// Every control point this app reads, with its LOCAL value.
// Production values come from FireWeave rollouts, never from this file.
import { defineControlPoints } from "@fireweaveai/web-sdk/start";

export const controlPoints = defineControlPoints({
  "stat-alert": { local: true },
  "age-tint": { local: true },
  "owner-chip": { local: true },
  "stat-pin": { local: true },
  "empty-hint": { local: true },
  "dup-hint": { local: true },
});
