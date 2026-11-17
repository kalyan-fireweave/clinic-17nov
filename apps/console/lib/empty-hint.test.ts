import assert from "node:assert/strict";
import test from "node:test";
import { emptyHintCopy } from "./empty-hint.ts";

test("the empty inbox tells staff where faxes go", () => {
  assert.match(emptyHintCopy(), /Upload a referral/);
});
