import assert from "node:assert/strict";
import test from "node:test";
import { pinStatFirst } from "./stat-pin.ts";

test("lifts waiting STAT referrals above the rest, keeping their order", () => {
  const rows = [
    { id: "a", triage: "screening", status: "awaiting_review" },
    { id: "b", triage: "STAT", status: "awaiting_review" },
    { id: "c", triage: "STAT", status: "complete" },
    { id: "d", triage: "STAT", status: "awaiting_review" },
  ];
  assert.deepEqual(pinStatFirst(rows).map((row) => row.id), ["b", "d", "a", "c"]);
});
