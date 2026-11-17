import assert from "node:assert/strict";
import test from "node:test";
import { AGE_TINT_AFTER_MS, ageTintBackground, waitingAgeMs } from "./age-tint.ts";

const now = Date.parse("2026-11-17T12:00:00.000Z");

test("a referral waiting two hours is tinted", () => {
  const created = new Date(now - AGE_TINT_AFTER_MS).toISOString();
  assert.equal(ageTintBackground(waitingAgeMs(created, now), "awaiting_review"), "#fff3d6");
});

test("a fresh referral and a finished one stay plain", () => {
  const created = new Date(now - 60_000).toISOString();
  assert.equal(ageTintBackground(waitingAgeMs(created, now), "awaiting_review"), null);
  assert.equal(
    ageTintBackground(waitingAgeMs(new Date(now - AGE_TINT_AFTER_MS).toISOString(), now), "complete"),
    null,
  );
});

test("a missing or unreadable time is not an age", () => {
  assert.equal(waitingAgeMs(undefined, now), null);
  assert.equal(waitingAgeMs("not-a-time", now), null);
});
