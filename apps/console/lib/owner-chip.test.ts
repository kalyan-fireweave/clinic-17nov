import assert from "node:assert/strict";
import test from "node:test";
import { ownerLabel } from "./owner-chip.ts";

test("names the owner", () => {
  assert.equal(ownerLabel("Ada Lovelace"), "Ada Lovelace");
});

test("says Unassigned when nobody owns it", () => {
  assert.equal(ownerLabel(null), "Unassigned");
  assert.equal(ownerLabel("   "), "Unassigned");
  assert.equal(ownerLabel(undefined), "Unassigned");
});
