import type { BatchStatus, Role, User, Submission, Unit, Batch } from "./types";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(message, status);
}
export function unitAccess(user: User, unit: Unit | undefined) {
  return (
    !!unit &&
    (user.role === "pam" ||
      (user.role === "region" && user.region_id === unit.region_id) ||
      (user.role === "unit" && user.unit_id === unit.id))
  );
}
export function regionAccess(user: User, regionId: string) {
  return user.role === "pam" || user.region_id === regionId;
}
export function requireRole(user: User, roles: Role[]) {
  assert(
    roles.includes(user.role),
    "Anda tidak memiliki izin untuk tindakan ini.",
    403,
  );
}
export function expectVersion(actual: number, expected: unknown) {
  assert(
    Number(expected) === actual,
    "Data telah diperbarui oleh pengguna lain. Muat ulang sebelum melanjutkan.",
    409,
  );
}
export function submissionComplete(
  s: Submission,
  hasExcel: boolean,
  hasPdf: boolean,
) {
  return !!(
    s.boxes > 0 &&
    s.description.trim() &&
    s.year_from <= s.year_to &&
    s.physical_sorted &&
    s.photographed &&
    s.signature_confirmed &&
    hasExcel &&
    hasPdf
  );
}
const transitions: Record<BatchStatus, BatchStatus[]> = {
  draft: ["routing"],
  routing: ["memo", "draft"],
  memo: ["review"],
  review: ["revision", "reviewed"],
  revision: ["routing"],
  reviewed: [],
};
export function canTransition(from: BatchStatus, to: BatchStatus) {
  return transitions[from]?.includes(to) ?? false;
}
export function validateBatchTransition(
  batch: Batch,
  to: BatchStatus,
  role: Role,
) {
  assert(
    canTransition(batch.status, to),
    "Perpindahan tahap tidak sesuai urutan proses.",
  );
  if (["review", "revision", "reviewed"].includes(to))
    assert(role === "pam", "Pengkajian hanya dapat dilakukan PAM.", 403);
  else
    assert(
      role === "region",
      "Tahap regional diperbarui oleh PIC Region.",
      403,
    );
}
export function safeFilename(name: string) {
  return name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
