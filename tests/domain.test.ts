import { test } from "node:test";
import assert from "node:assert/strict";
import {
  unitAccess,
  regionAccess,
  submissionComplete,
  canTransition,
  validateBatchTransition,
  expectVersion,
  validDate,
  safeFilename,
} from "../lib/domain";
import type { User, Unit, Submission, Batch } from "../lib/types";
const unit = { id: "u1", region_id: "r1" } as Unit;
const user = {
  id: "user",
  role: "unit",
  unit_id: "u1",
  region_id: "r1",
} as User;
test("unit scope follows own unit; region scope follows region; PAM has all units", () => {
  assert.equal(unitAccess(user, unit), true);
  assert.equal(unitAccess({ ...user, unit_id: "u2" }, unit), false);
  assert.equal(unitAccess({ ...user, role: "region" }, unit), true);
  assert.equal(
    unitAccess({ ...user, role: "region", region_id: "r2" }, unit),
    false,
  );
  assert.equal(unitAccess({ ...user, role: "pam" }, unit), true);
  assert.equal(unitAccess(user, undefined), false);
  assert.equal(regionAccess({ ...user, role: "region" }, "r2"), false);
});
test("submission needs both files plus physical, photograph and signature confirmations", () => {
  const s = {
    boxes: 1,
    description: "Dokumen",
    year_from: 2020,
    year_to: 2022,
    physical_sorted: 1,
    photographed: 1,
    signature_confirmed: 1,
  } as Submission;
  assert.equal(submissionComplete(s, true, true), true);
  assert.equal(submissionComplete(s, true, false), false);
  assert.equal(
    submissionComplete({ ...s, photographed: 0 }, true, true),
    false,
  );
  assert.equal(
    submissionComplete({ ...s, signature_confirmed: 0 }, true, true),
    false,
  );
  assert.equal(submissionComplete({ ...s, boxes: 0 }, true, true), false);
});
test("regional workflow cannot skip memo or finish without PAM review", () => {
  assert.equal(canTransition("draft", "reviewed"), false);
  assert.equal(canTransition("routing", "memo"), true);
  assert.equal(canTransition("review", "reviewed"), true);
  assert.equal(canTransition("reviewed", "revision"), false);
  assert.throws(() =>
    validateBatchTransition({ status: "memo" } as Batch, "review", "region"),
  );
  assert.doesNotThrow(() =>
    validateBatchTransition({ status: "memo" } as Batch, "review", "pam"),
  );
});
test("stale updates fail instead of overwriting another user", () => {
  assert.throws(() => expectVersion(2, 1), /diperbarui/);
  assert.doesNotThrow(() => expectVersion(2, 2));
});
test("memo date rejects normalized invalid dates and filenames reject path separators", () => {
  assert.equal(validDate("2026-02-31"), false);
  assert.equal(validDate("2026-11-05"), true);
  assert.equal(validDate("2026-13-01"), false);
  assert.equal(safeFilename("../folder/test.pdf"), ".._folder_test.pdf");
});
