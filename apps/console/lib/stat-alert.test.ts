import assert from "node:assert/strict";
import test from "node:test";
import { isWaitingStat, statArrivals } from "./stat-alert.ts";


const waiting = { id: "r1", status: "awaiting_review", triage: "STAT" };

test("keeps a waiting STAT referral", () => {
  assert.equal(isWaitingStat(waiting), true);
});

test("skips a STAT referral that is already written", () => {
  assert.equal(isWaitingStat({ id: "r2", status: "complete", triage: "STAT" }), false);
});

test("skips screening and a STAT the desk has already seen", () => {
  const rows = [
    waiting,
    { id: "r2", status: "awaiting_review", triage: "screening" },
    { id: "r3", status: "ready", triage: "STAT" },
  ];
  assert.deepEqual(
    statArrivals(new Set(["r1"]), rows).map((row) => row.id),
    ["r3"],
  );
});
