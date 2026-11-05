import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, scryptSync } from "node:crypto";
import { z } from "zod";
import {
  rows,
  one,
  run,
  transaction,
  id,
  event,
  publicUserFields,
  documents,
  uploadDir,
} from "./db";
import {
  assert,
  unitAccess,
  regionAccess,
  requireRole,
  expectVersion,
  submissionComplete,
  validateBatchTransition,
  safeFilename,
  validDate,
} from "./domain";
import type {
  User,
  Unit,
  Submission,
  Batch,
  StoredFile,
  Issue,
  Event,
  Capacity,
  Region,
} from "./types";

const now = () => new Date().toISOString();
export function unitFor(user: User, unitId: string) {
  const u = one<Unit>("SELECT * FROM units WHERE id=?", unitId);
  assert(
    unitAccess(user, u),
    "Unit tidak ditemukan atau di luar akses Anda.",
    403,
  );
  return u!;
}
export function submissionFor(user: User, sid: string) {
  const s = one<Submission>("SELECT * FROM submissions WHERE id=?", sid);
  assert(s, "Pengajuan tidak ditemukan.", 404);
  unitFor(user, s.unit_id);
  return s;
}
export function batchFor(user: User, bid: string) {
  const b = one<Batch>("SELECT * FROM batches WHERE id=?", bid);
  assert(b, "Paket regional tidak ditemukan.", 404);
  if (user.role === "unit")
    assert(
      one(
        "SELECT 1 FROM memberships m JOIN submissions s ON s.id=m.submission_id WHERE m.batch_id=? AND s.unit_id=?",
        bid,
        user.unit_id,
      ),
      "Paket di luar akses Anda.",
      403,
    );
  else
    assert(regionAccess(user, b.region_id), "Paket di luar akses Anda.", 403);
  return b;
}
export function issueFor(user: User, iid: string) {
  const i = one<Issue>("SELECT * FROM issues WHERE id=?", iid);
  assert(i, "Kendala tidak ditemukan.", 404);
  unitFor(user, i.unit_id);
  return i;
}
export function accessibleFile(user: User, fid: string) {
  const f = one<StoredFile & { path: string }>(
    "SELECT * FROM files WHERE id=?",
    fid,
  );
  assert(f, "Berkas tidak ditemukan.", 404);
  if (f.owner_type === "submission") submissionFor(user, f.owner_id);
  else if (f.owner_type === "batch") {
    assert(
      user.role !== "unit",
      "Lampiran regional hanya untuk PIC dan PAM.",
      403,
    );
    batchFor(user, f.owner_id);
  } else issueFor(user, f.owner_id);
  assert(fs.existsSync(f.path), "Berkas tidak tersedia di penyimpanan.", 404);
  return f;
}
export function stateFor(user: User) {
  const units = rows<Unit>("SELECT * FROM units").filter((u) =>
    unitAccess(user, u),
  );
  const unitIds = new Set(units.map((u) => u.id));
  const submissions = rows<Submission>(
    "SELECT * FROM submissions ORDER BY updated_at DESC",
  ).filter((s) => unitIds.has(s.unit_id));
  const sids = new Set(submissions.map((s) => s.id));
  const allMemberships = rows<{
    batch_id: string;
    submission_id: string;
    submission_version: number;
  }>("SELECT * FROM memberships");
  const batches = rows<Batch>(
    "SELECT * FROM batches ORDER BY updated_at DESC",
  ).filter((b) =>
    user.role === "unit"
      ? allMemberships.some(
          (m) => m.batch_id === b.id && sids.has(m.submission_id),
        )
      : regionAccess(user, b.region_id),
  );
  const bids = new Set(batches.map((b) => b.id));
  const memberships = allMemberships.filter(
    (m) => bids.has(m.batch_id) && sids.has(m.submission_id),
  );
  const issues = rows<Issue>(
    "SELECT * FROM issues ORDER BY updated_at DESC",
  ).filter((i) => unitIds.has(i.unit_id));
  const iids = new Set(issues.map((i) => i.id));
  const files = rows<StoredFile>(
    "SELECT id,owner_type,owner_id,kind,name,mime,size,version,created_at,created_by FROM files ORDER BY created_at DESC",
  ).filter((f) =>
    f.owner_type === "submission"
      ? sids.has(f.owner_id)
      : f.owner_type === "batch"
        ? user.role !== "unit" && bids.has(f.owner_id)
        : iids.has(f.owner_id),
  );
  const events = rows<Event>(
    "SELECT e.*,u.name actor_name FROM events e JOIN users u ON u.id=e.actor_id ORDER BY e.created_at DESC",
  ).filter((e) =>
    e.entity_type === "submission"
      ? sids.has(e.entity_id)
      : e.entity_type === "batch"
        ? bids.has(e.entity_id)
        : e.entity_type === "issue"
          ? iids.has(e.entity_id)
          : e.entity_type === "capacity"
            ? unitIds.has(e.entity_id)
            : user.role === "pam",
  );
  const read = new Set(
    rows<{ event_id: string }>(
      "SELECT event_id FROM notification_reads WHERE user_id=?",
      user.id,
    ).map((v) => v.event_id),
  );
  const docs = documents()
    .filter((d) => d.published && (d.unit_id ? unitIds.has(d.unit_id) : true))
    .map(({ path: _, published: __, ...d }) => d);
  return {
    user,
    users:
      user.role === "pam"
        ? rows<User>(`SELECT ${publicUserFields} FROM users`)
        : [user],
    regions: rows<Region>("SELECT * FROM regions").filter(
      (r) => user.role === "pam" || r.id === user.region_id,
    ),
    units,
    submissions,
    batches,
    memberships,
    files,
    events: events.slice(0, 300),
    capacities: rows<Capacity>(
      "SELECT * FROM capacities ORDER BY created_at DESC",
    ).filter((c) => unitIds.has(c.unit_id)),
    issues,
    documents: docs,
    notifications: events
      .filter((e) => e.actor_id !== user.id)
      .slice(0, 30)
      .map((e) => ({
        id: e.id,
        title: e.action,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        created_at: e.created_at,
        read: read.has(e.id),
      })),
    settings: {
      region_upload_required:
        one<{ value: string }>(
          "SELECT value FROM settings WHERE key=?",
          "region_upload_required",
        )?.value === "true",
      numbering_scope: "regional",
      pam_permission_separable: true,
    },
  };
}
const submissionSchema = z
  .object({
    unit_id: z.string(),
    period: z.string().trim().min(3).max(100),
    year_from: z.coerce.number().int().min(1900).max(2100),
    year_to: z.coerce.number().int().min(1900).max(2100),
    description: z.string().trim().min(3).max(3000),
    boxes: z.coerce.number().int().min(0).max(100000),
    physical_sorted: z.boolean(),
    photographed: z.boolean(),
    signature_confirmed: z.boolean(),
  })
  .refine(
    (s) => s.year_from <= s.year_to,
    "Tahun awal harus sebelum tahun akhir.",
  );
export function mutateSubmission(
  user: User,
  sid: string | undefined,
  body: Record<string, unknown>,
) {
  const action = String(body.action || "save");
  return transaction(() => {
    if (!sid) {
      requireRole(user, ["unit"]);
      const v = submissionSchema.parse(body);
      unitFor(user, v.unit_id);
      assert(v.unit_id === user.unit_id, "Unit tidak sesuai akun.", 403);
      const key = id("UNIT");
      run(
        "INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        key,
        v.unit_id,
        v.period,
        v.year_from,
        v.year_to,
        v.description,
        v.boxes,
        "draft",
        +v.physical_sorted,
        +v.photographed,
        +v.signature_confirmed,
        1,
        now(),
        now(),
        user.id,
      );
      event("submission", key, "Draft pengajuan dibuat", "", user.id);
      return { id: key };
    }
    const s = submissionFor(user, sid);
    expectVersion(s.version, body.version);
    if (action === "comment") {
      assert(
        typeof body.note === "string" && body.note.trim().length > 0,
        "Tulis catatan terlebih dahulu.",
      );
      event(
        "submission",
        sid,
        "Catatan ditambahkan",
        String(body.note).slice(0, 3000),
        user.id,
      );
      return { id: sid };
    }
    if (action === "save") {
      requireRole(user, ["unit"]);
      assert(
        ["draft", "revision"].includes(s.status),
        "Pengajuan sedang diproses. Minta revisi sebelum mengubahnya.",
      );
      const v = submissionSchema.parse({ ...body, unit_id: s.unit_id });
      run(
        "UPDATE submissions SET period=?,year_from=?,year_to=?,description=?,boxes=?,physical_sorted=?,photographed=?,signature_confirmed=?,version=version+1,updated_at=? WHERE id=?",
        v.period,
        v.year_from,
        v.year_to,
        v.description,
        v.boxes,
        +v.physical_sorted,
        +v.photographed,
        +v.signature_confirmed,
        now(),
        sid,
      );
      event("submission", sid, "Data pengajuan diperbarui", "", user.id);
    } else if (action === "submit") {
      requireRole(user, ["unit"]);
      assert(
        ["draft", "revision"].includes(s.status),
        "Pengajuan sudah dikirim.",
      );
      const files = rows<StoredFile>(
        "SELECT * FROM files WHERE owner_type=? AND owner_id=?",
        "submission",
        sid,
      );
      assert(
        submissionComplete(
          s,
          files.some((f) => f.kind === "excel"),
          files.some((f) => f.kind === "pdf"),
        ),
        "Lengkapi daftar arsip, Excel, PDF bertanda tangan, dan tiga konfirmasi persiapan.",
      );
      run(
        "UPDATE submissions SET status=?,version=version+1,updated_at=? WHERE id=?",
        "submitted",
        now(),
        sid,
      );
      event(
        "submission",
        sid,
        "Pengajuan dikirim ke PIC Region",
        "Konfirmasi kelengkapan oleh Admin Unit. Tanda tangan tidak divalidasi secara digital.",
        user.id,
      );
    } else if (action === "verify" || action === "revision") {
      requireRole(user, ["region"]);
      assert(
        s.status === "submitted",
        "Hanya pengajuan terkirim yang dapat direview.",
      );
      const note = String(body.note || "").trim();
      assert(
        action !== "revision" || note.length > 2,
        "Jelaskan bagian yang perlu direvisi.",
      );
      run(
        "UPDATE submissions SET status=?,version=version+1,updated_at=? WHERE id=?",
        action === "verify" ? "verified" : "revision",
        now(),
        sid,
      );
      event(
        "submission",
        sid,
        action === "verify"
          ? "Berkas unit diverifikasi PIC"
          : "Revisi diperlukan",
        note,
        user.id,
      );
    } else assert(false, "Tindakan tidak dikenal.");
    return { id: sid };
  });
}
export function mutateBatch(
  user: User,
  bid: string | undefined,
  body: Record<string, unknown>,
) {
  return transaction(() => {
    if (!bid) {
      requireRole(user, ["region"]);
      const v = z
        .object({
          number: z.string().trim().min(3).max(150),
          period: z.string().trim().min(3).max(100),
          submission_ids: z.array(z.string()).min(1),
        })
        .parse(body);
      assert(
        new Set(v.submission_ids).size === v.submission_ids.length,
        "Unit tidak boleh berulang.",
      );
      const selected = v.submission_ids.map((sid) => submissionFor(user, sid));
      assert(
        selected.every((s) => s.status === "verified" && s.period === v.period),
        "Pilih pengajuan terverifikasi dengan periode yang sama.",
      );
      assert(
        selected.every(
          (s) => !one("SELECT 1 FROM memberships WHERE submission_id=?", s.id),
        ),
        "Ada pengajuan yang sudah masuk paket regional.",
      );
      const key = id("FUPA");
      run(
        "INSERT INTO batches VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        key,
        user.region_id!,
        v.number,
        v.period,
        "draft",
        0,
        0,
        "",
        "",
        1,
        now(),
        now(),
        user.id,
      );
      selected.forEach((s) =>
        run("INSERT INTO memberships VALUES(?,?,?)", key, s.id, s.version),
      );
      event(
        "batch",
        key,
        "Paket FUPA regional dibuat",
        `${selected.length} pengajuan unit; nomor dikonfirmasi PIC Region.`,
        user.id,
      );
      return { id: key };
    }
    const b = batchFor(user, bid);
    expectVersion(b.version, body.version);
    const action = String(body.action);
    if (action === "comment") {
      assert(String(body.note || "").trim(), "Catatan belum diisi.");
      event(
        "batch",
        bid,
        "Catatan regional",
        String(body.note).slice(0, 3000),
        user.id,
      );
      return { id: bid };
    }
    if (action === "save") {
      requireRole(user, ["region"]);
      assert(
        ["draft", "routing", "revision"].includes(b.status),
        "Paket tidak dapat diubah pada tahap ini.",
      );
      const v = z
        .object({
          number: z.string().trim().min(3).max(150),
          manager_signed: z.boolean(),
          vp_signed: z.boolean(),
        })
        .parse(body);
      run(
        "UPDATE batches SET number=?,manager_signed=?,vp_signed=?,version=version+1,updated_at=? WHERE id=?",
        v.number,
        +v.manager_signed,
        +v.vp_signed,
        now(),
        bid,
      );
      event(
        "batch",
        bid,
        "Status persetujuan eksternal diperbarui",
        "Konfirmasi PIC atas proses tanda tangan di luar website.",
        user.id,
      );
      return { id: bid };
    }
    const to = z
      .enum(["routing", "memo", "review", "revision", "reviewed", "draft"])
      .parse(action);
    validateBatchTransition(b, to, user.role);
    const members = rows<{ submission_id: string; submission_version: number }>(
      "SELECT * FROM memberships WHERE batch_id=?",
      bid,
    );
    assert(members.length, "Paket belum memiliki pengajuan unit.");
    const selected = members.map((m) => submissionFor(user, m.submission_id));
    if (to === "routing") {
      assert(
        selected.every((s) => s.status === "verified"),
        "Semua unit harus diverifikasi kembali sebelum routing.",
      );
      members.forEach((m) =>
        run(
          "UPDATE memberships SET submission_version=? WHERE batch_id=? AND submission_id=?",
          selected.find((s) => s.id === m.submission_id)!.version,
          bid,
          m.submission_id,
        ),
      );
      run(
        "UPDATE batches SET manager_signed=0,vp_signed=0,memo_number=?,memo_date=? WHERE id=?",
        "",
        "",
        bid,
      );
    }
    if (to === "memo") {
      assert(
        b.manager_signed && b.vp_signed,
        "Konfirmasi tanda tangan Manager dan VP terlebih dahulu.",
      );
      assert(
        selected.every((s) => s.status === "verified") &&
          members.every(
            (m) =>
              selected.find((s) => s.id === m.submission_id)!.version ===
              m.submission_version,
          ),
        "Data unit berubah. Kembalikan ke draft dan ulangi routing.",
      );
      const number = String(body.memo_number || "").trim(),
        date = String(body.memo_date || "");
      assert(
        number.length >= 3 && number.length <= 150 && validDate(date),
        "Isi nomor dan tanggal memo yang valid.",
      );
      const mandatory =
        one<{ value: string }>(
          "SELECT value FROM settings WHERE key=?",
          "region_upload_required",
        )?.value === "true";
      if (mandatory)
        assert(
          one(
            "SELECT 1 FROM files WHERE owner_type=? AND owner_id=? AND kind=?",
            "batch",
            bid,
            "regional",
          ),
          "Lampiran regional wajib sesuai pengaturan.",
        );
      run(
        "UPDATE batches SET memo_number=?,memo_date=? WHERE id=?",
        number,
        date,
        bid,
      );
    }
    if (to === "revision") {
      const note = String(body.note || "").trim();
      assert(note.length > 2, "Catatan revisi wajib diisi.");
      const revised = z.array(z.string()).parse(body.submission_ids || []);
      assert(
        revised.every((sid) => members.some((m) => m.submission_id === sid)),
        "Pengajuan revisi di luar paket.",
      );
      revised.forEach((sid) => {
        run(
          "UPDATE submissions SET status=?,signature_confirmed=0,version=version+1,updated_at=? WHERE id=?",
          "revision",
          now(),
          sid,
        );
        event("submission", sid, "Revisi dari pengkajian PAM", note, user.id);
      });
      run("UPDATE batches SET manager_signed=0,vp_signed=0 WHERE id=?", bid);
    }
    run(
      "UPDATE batches SET status=?,version=version+1,updated_at=? WHERE id=?",
      to,
      now(),
      bid,
    );
    const labels = {
      routing: "Routing persetujuan dimulai",
      memo: "Memo regional dicatat",
      review: "Pengkajian PAM dimulai",
      revision: "Paket dikembalikan untuk revisi",
      reviewed: "Pengkajian PAM selesai",
      draft: "Paket dikembalikan ke draft",
    };
    event(
      "batch",
      bid,
      labels[to],
      `${String(body.note || "").slice(0, 3000)}${to === "memo" ? ` · ${body.memo_number} (${body.memo_date})` : ""}${to === "reviewed" ? " · Selesai dikaji bukan izin pemusnahan fisik." : ""}`,
      user.id,
    );
    return { id: bid };
  });
}
export async function upload(user: User, form: FormData) {
  const file = form.get("file");
  assert(file instanceof File && file.size > 0, "Pilih berkas untuk diunggah.");
  assert(file.size <= 20 * 1024 * 1024, "Ukuran maksimal 20 MB.");
  const owner = String(form.get("owner_type")),
    ownerId = String(form.get("owner_id")),
    kind = String(form.get("kind"));
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase();
  const pdf = ext === ".pdf" && bytes.subarray(0, 5).toString() === "%PDF-",
    xlsx = ext === ".xlsx" && bytes[0] === 80 && bytes[1] === 75,
    png =
      ext === ".png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpg =
      [".jpg", ".jpeg"].includes(ext) && bytes[0] === 255 && bytes[1] === 216;
  const csv = ext === ".csv" && !bytes.includes(0);
  const mime = pdf
    ? "application/pdf"
    : xlsx
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : png
        ? "image/png"
        : jpg
          ? "image/jpeg"
          : csv
            ? "text/csv; charset=utf-8"
            : "";
  assert(mime, "Berkas harus PDF, XLSX, PNG, atau JPEG yang valid.");
  if (owner === "document") {
    requireRole(user, ["pam"]);
    const d = one<{ category: string }>(
      "SELECT category FROM documents WHERE id=?",
      ownerId,
    );
    assert(d, "Dokumen tidak ditemukan.", 404);
    assert(
      d.category === "template"
        ? xlsx
        : d.category === "materi"
          ? pdf
          : xlsx || csv,
      "Materi menggunakan PDF, template menggunakan XLSX, dan data unit menggunakan XLSX atau CSV.",
    );
  } else if (owner === "submission") {
    requireRole(user, ["unit"]);
    const s = submissionFor(user, ownerId);
    expectVersion(s.version, form.get("version"));
    assert(
      ["draft", "revision"].includes(s.status),
      "Berkas hanya dapat diubah pada draft atau revisi.",
    );
    assert(
      (kind === "excel" && xlsx) ||
        (kind === "pdf" && pdf) ||
        (kind === "photo" && (png || jpg)),
      "Jenis berkas tidak sesuai slot unggahan.",
    );
  } else if (owner === "batch") {
    requireRole(user, ["region"]);
    const b = batchFor(user, ownerId);
    expectVersion(b.version, form.get("version"));
    assert(
      ["draft", "routing", "revision"].includes(b.status),
      "Lampiran tidak dapat diubah pada tahap ini.",
    );
    assert(kind === "regional" && pdf, "Lampiran regional harus PDF.");
  } else if (owner === "issue") {
    issueFor(user, ownerId);
    assert(
      user.role === "unit" && (png || jpg) && kind === "photo",
      "Foto kendala diunggah Admin Unit.",
      403,
    );
  } else assert(false, "Jenis pemilik berkas tidak valid.");
  const fid = id("FILE"),
    dest = path.join(uploadDir, randomUUID());
  fs.writeFileSync(dest, bytes, { flag: "wx" });
  try {
    transaction(() => {
      if (owner === "document") {
        const versionLabel = String(
          form.get("document_version") || "Unggahan terbaru",
        ).slice(0, 100);
        const linked = ["d-fupa", "d-daftar"].includes(ownerId)
          ? ["d-fupa", "d-daftar"]
          : [ownerId];
        linked.forEach((docId) =>
          run(
            "UPDATE documents SET filename=?,path=?,version=?,is_demo=0 WHERE id=?",
            safeFilename(file.name),
            dest,
            versionLabel,
            docId,
          ),
        );
        const doc = one<{ unit_id: string | null }>(
          "SELECT unit_id FROM documents WHERE id=?",
          ownerId,
        );
        if (doc?.unit_id) {
          const unit = one<Unit>("SELECT * FROM units WHERE id=?", doc.unit_id);
          run(
            "UPDATE documents SET title=?,description=? WHERE id=?",
            `Data Unit ${unit?.code || doc.unit_id}`,
            "Berkas unit disediakan administrator. Ekspor I-BOS dilakukan di luar website.",
            ownerId,
          );
        }
        event(
          "document",
          ownerId,
          "Dokumen referensi diperbarui",
          safeFilename(file.name),
          user.id,
        );
        return;
      }
      const ver =
        (one<{ v: number }>(
          "SELECT MAX(version) v FROM files WHERE owner_type=? AND owner_id=? AND kind=?",
          owner,
          ownerId,
          kind,
        )?.v || 0) + 1;
      run(
        "INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        fid,
        owner,
        ownerId,
        kind,
        safeFilename(file.name),
        mime,
        bytes.length,
        dest,
        ver,
        now(),
        user.id,
      );
      if (owner === "submission")
        run(
          "UPDATE submissions SET version=version+1,updated_at=? WHERE id=?",
          now(),
          ownerId,
        );
      if (owner === "batch")
        run(
          "UPDATE batches SET version=version+1,updated_at=? WHERE id=?",
          now(),
          ownerId,
        );
      event(
        owner,
        ownerId,
        `Berkas ${kind} diunggah · versi ${ver}`,
        safeFilename(file.name),
        user.id,
      );
    });
  } catch (e) {
    fs.unlinkSync(dest);
    throw e;
  }
  return { id: fid };
}
export function mutateMonitoring(
  user: User,
  kind: string,
  body: Record<string, unknown>,
  entityId?: string,
) {
  return transaction(() => {
    if (kind === "capacity") {
      requireRole(user, ["unit"]);
      const v = z
        .object({
          unit_id: z.string(),
          total: z.coerce.number().int().min(1).max(100000),
          used: z.coerce.number().int().min(0),
          condition: z.enum(["Baik", "Perlu perhatian", "Kritis"]),
          temperature: z.coerce.number().min(-10).max(60).nullable(),
          humidity: z.coerce.number().min(0).max(100).nullable(),
          note: z.string().max(3000),
        })
        .parse(body);
      unitFor(user, v.unit_id);
      assert(v.used <= v.total, "Box terisi tidak boleh melebihi kapasitas.");
      run(
        "INSERT INTO capacities VALUES(?,?,?,?,?,?,?,?,?,?)",
        id("CAP"),
        v.unit_id,
        v.total,
        v.used,
        v.condition,
        v.temperature,
        v.humidity,
        v.note,
        now(),
        user.id,
      );
      event(
        "capacity",
        v.unit_id,
        "Monitoring ruang arsip diperbarui",
        v.note,
        user.id,
      );
      return;
    }
    if (entityId) {
      const i = issueFor(user, entityId);
      const status = z
        .enum(["open", "progress", "resolved"])
        .parse(body.status);
      const note = String(body.note || "").trim();
      assert(note.length > 2, "Tuliskan catatan tindak lanjut.");
      run(
        "UPDATE issues SET status=?,updated_at=? WHERE id=?",
        status,
        now(),
        i.id,
      );
      event(
        "issue",
        i.id,
        "Status kendala diperbarui",
        `${status} · ${note}`,
        user.id,
      );
      return;
    }
    requireRole(user, ["unit"]);
    const v = z
      .object({
        unit_id: z.string(),
        title: z.string().trim().min(3).max(150),
        description: z.string().trim().min(5).max(3000),
        category: z.enum([
          "Kapasitas",
          "Kondisi penyimpanan",
          "Pemeliharaan",
          "Administrasi",
          "Lainnya",
        ]),
        priority: z.enum(["Normal", "Tinggi"]),
      })
      .parse(body);
    unitFor(user, v.unit_id);
    const key = id("ISS");
    run(
      "INSERT INTO issues VALUES(?,?,?,?,?,?,?,?,?,?)",
      key,
      v.unit_id,
      v.title,
      v.description,
      v.category,
      v.priority,
      "open",
      now(),
      now(),
      user.id,
    );
    event("issue", key, "Kendala dilaporkan", v.title, user.id);
    return { id: key };
  });
}
export function admin(user: User, kind: string, body: Record<string, unknown>) {
  requireRole(user, ["pam"]);
  return transaction(() => {
    if (kind === "settings") {
      assert(
        typeof body.region_upload_required === "boolean",
        "Nilai pengaturan tidak valid.",
      );
      run(
        "UPDATE settings SET value=? WHERE key=?",
        String(body.region_upload_required),
        "region_upload_required",
      );
      event(
        "settings",
        "global",
        "Pengaturan alur diperbarui",
        `Lampiran regional wajib: ${body.region_upload_required}`,
        user.id,
      );
      return;
    }
    if (kind === "regions") {
      const v = z
        .object({
          name: z.string().trim().min(3).max(150),
          code: z.string().trim().min(2).max(25),
        })
        .parse(body);
      run("INSERT INTO regions VALUES(?,?,?)", id("REG"), v.name, v.code);
    } else if (kind === "units") {
      const v = z
        .object({
          code: z.string().trim().min(3).max(40),
          name: z.string().trim().min(3).max(150),
          city: z.string().trim().min(3).max(100),
          region_id: z.string(),
        })
        .parse(body);
      assert(
        one("SELECT 1 FROM regions WHERE id=?", v.region_id),
        "Region tidak ditemukan.",
      );
      run(
        "INSERT INTO units VALUES(?,?,?,?,?,?)",
        id("SPBU"),
        v.code,
        v.name,
        v.region_id,
        v.city,
        1,
      );
    } else if (kind === "users") {
      if (body.action === "toggle") {
        assert(body.id !== user.id, "Akun sendiri tidak dapat dinonaktifkan.");
        const u = one<User>("SELECT * FROM users WHERE id=?", String(body.id));
        assert(u, "Pengguna tidak ditemukan.");
        run("UPDATE users SET active=? WHERE id=?", u.active ? 0 : 1, u.id);
        if (u.active) run("DELETE FROM sessions WHERE user_id=?", u.id);
      } else {
        const v = z
          .object({
            name: z.string().trim().min(3).max(150),
            email: z.email(),
            password: z.string().min(12).max(100),
            role: z.enum(["unit", "region", "pam"]),
            region_id: z.string().nullable(),
            unit_id: z.string().nullable(),
          })
          .parse(body);
        if (v.role === "unit") {
          const unit = one<Unit>("SELECT * FROM units WHERE id=?", v.unit_id);
          assert(unit, "Unit akun wajib dipilih.");
          v.region_id = unit.region_id;
        } else if (v.role === "region")
          assert(
            one("SELECT 1 FROM regions WHERE id=?", v.region_id),
            "Region akun wajib dipilih.",
          );
        if (v.role === "pam") {
          v.region_id = null;
          v.unit_id = null;
        }
        if (v.role === "region") v.unit_id = null;
        const salt = randomUUID();
        run(
          "INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)",
          id("USER"),
          v.name,
          v.email.toLowerCase(),
          scryptSync(v.password, salt, 64).toString("hex"),
          salt,
          v.role,
          v.region_id,
          v.unit_id,
          1,
        );
      }
    } else assert(false, "Menu administrasi tidak ditemukan.");
    event("admin", kind, "Data administrasi diperbarui", kind, user.id);
  });
}
export function markRead(user: User, body: Record<string, unknown>) {
  const visible = stateFor(user).notifications;
  const ids = Array.isArray(body.ids) ? body.ids : visible.map((n) => n.id);
  transaction(() => {
    ids
      .filter((v) => visible.some((n) => n.id === v))
      .forEach((v) =>
        run(
          "INSERT OR IGNORE INTO notification_reads VALUES(?,?)",
          user.id,
          String(v),
        ),
      );
  });
}
export const faqs = [
  {
    key: "fupa",
    question: "Bagaimana alur pengajuan FUPA?",
    answer:
      "Admin Unit mengekspor data dari I-BOS di luar website, menyusun daftar arsip, memisahkan arsip fisik dan memfoto kondisinya. Setelah PDF ditandatangani ABH dan PIC Region, unggah Excel dan PDF ke pengajuan unit. PIC meninjau, menggabungkan unit terverifikasi ke paket FUPA regional, mengurus tanda tangan Manager/VP di luar web, lalu mencatat nomor dan tanggal memo. PAM melakukan pengkajian. Nomor FUPA dikonfirmasi PIC, bukan dibuat otomatis oleh website.",
    sources: ["d-fupa", "d-daftar"],
  },
  {
    key: "retensi",
    question: "Apakah arsip sudah boleh dimusnahkan?",
    answer:
      "Website tidak menentukan kelayakan musnah secara otomatis. Periksa klasifikasi, retensi, dan persyaratan dalam JRDP serta ketentuan resmi melalui petugas berwenang. Status “Selesai dikaji” hanya menyatakan pengkajian administrasi telah selesai, bukan izin untuk memusnahkan fisik arsip.",
    sources: ["d-jrdp", "d-c002"],
  },
  {
    key: "unggah",
    question: "Berkas apa yang perlu diunggah?",
    answer:
      "Pengajuan unit memerlukan Excel daftar arsip dan PDF yang telah ditandatangani ABH dan PIC Region. Konfirmasi pemisahan fisik, foto kondisi, dan tanda tangan wajib diisi. Unggahan foto bersifat opsional. Tanda tangan tidak diverifikasi secara digital. Form FUPA dan sheet daftar arsip dapat diunduh dari Pusat Dokumen.",
    sources: ["d-fupa", "d-daftar"],
  },
  {
    key: "memo",
    question: "Apakah memo dan tanda tangan dilakukan di website?",
    answer:
      "Memo serta routing tanda tangan dilakukan di luar website. PIC Region mencatat konfirmasi tanda tangan, nomor memo, dan tanggal memo pada paket regional. Lampiran PDF regional bersifat opsional kecuali administrator mengaktifkan kewajiban unggah. Pengkajian PAM berlaku hanya untuk unit yang masuk paket tersebut.",
    sources: ["d-fupa"],
  },
  {
    key: "ibos",
    question: "Bagaimana cara mengambil data I-BOS?",
    answer:
      "Tidak ada integrasi I-BOS. Admin Unit melakukan ekspor langsung dari I-BOS sesuai manual resmi. Data CSV yang tersedia pada lingkungan lokal ini adalah contoh demonstrasi, bukan tarikan I-BOS sebenarnya. Manual yang belum disediakan ditandai “Belum tersedia”.",
    sources: ["d-ibos"],
  },
  {
    key: "aktif",
    question: "Apa referensi pengelolaan aktif dan inaktif?",
    answer:
      "TKI C001 membahas pengelolaan dokumen hardpaper aktif di unit pencipta. TKI C002 membahas pengelolaan hardpaper inaktif. Buka dokumen resmi dan JRDP untuk rincian ketentuan; asisten demo ini tidak menggantikan isi dokumen atau keputusan petugas berwenang.",
    sources: ["d-c001", "d-c002", "d-jrdp"],
  },
];
export function help(user: User, body?: Record<string, unknown>) {
  if (!body)
    return rows(
      "SELECT id,question,answer,sources,created_at FROM chats WHERE user_id=? ORDER BY created_at ASC",
      user.id,
    );
  const q = String(body.question || "").trim();
  assert(
    q.length > 2 && q.length <= 1000,
    "Tulis pertanyaan antara 3–1.000 karakter.",
  );
  const lower = q.toLowerCase();
  const found =
    faqs.find((f) => f.question === q) ||
    faqs.find((f) => lower.includes(f.key)) ||
    (/excel|pdf|upload|foto|berkas/.test(lower) ? faqs[2] : null) ||
    (/musnah|boleh|jrdp/.test(lower) ? faqs[1] : null);
  const answer =
    found?.answer ||
    "Asisten ini memakai jawaban FAQ yang telah disiapkan, belum menggunakan AI atau pencarian isi PDF. Coba pertanyaan tentang FUPA, unggah berkas, memo, retensi, I-BOS, atau dokumen aktif/inaktif. Untuk penafsiran ketentuan, konsultasikan PIC Region atau PAM.";
  const sources = found?.sources || [];
  const key = id("CHAT");
  run(
    "INSERT INTO chats VALUES(?,?,?,?,?,?)",
    key,
    user.id,
    q,
    answer,
    JSON.stringify(sources),
    now(),
  );
  return {
    id: key,
    question: q,
    answer,
    sources: JSON.stringify(sources),
    created_at: now(),
  };
}
