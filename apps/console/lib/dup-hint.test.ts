import assert from "node:assert/strict";
import test from "node:test";
import { duplicatePatients } from "./dup-hint.ts";

test("names a patient who has two referrals still waiting", () => {
  const rows = [
    { patientName: "Ada Lovelace", status: "awaiting_review" },
    { patientName: "ada lovelace", status: "awaiting_review" },
    { patientName: "Grace Hopper", status: "awaiting_review" },
    { patientName: "Grace Hopper", status: "complete" },
  ];
  assert.deepEqual(duplicatePatients(rows), ["Ada Lovelace"]);
});

test("ignores a row with no name", () => {
  assert.deepEqual(
    duplicatePatients([
      { patientName: null, status: "awaiting_review" },
      { patientName: "  ", status: "awaiting_review" },
    ]),
    [],
  );
});
