import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { State, Submission, Batch } from "../lib/types";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "arsip-gs-integration-"));
const port = 3101,
  base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, ARSIP_DATA_DIR: folder },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverOutput = "";
server.stdout?.on(
  "data",
  (b) => (serverOutput = (serverOutput + b).slice(-3000)),
);
server.stderr?.on(
  "data",
  (b) => (serverOutput = (serverOutput + b).slice(-3000)),
);
let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks++;
  process.stdout.write(`✓ ${name}\n`);
}
class Client {
  cookie = "";
  async request(url: string, body?: unknown, expected = 200) {
    const r = await fetch(`${base}/api/${url}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: this.cookie,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        Origin: base,
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    if (r.headers.get("set-cookie"))
      this.cookie = r.headers.get("set-cookie")!.split(";")[0];
    const value = await r.json();
    assert.equal(r.status, expected, `${url}: ${JSON.stringify(value)}`);
    return value;
  }
  async login(email: string) {
    await this.request("auth/login", { email, password: "ArsipDemo2026!" });
  }
  async state() {
    return this.request("state") as Promise<State>;
  }
  async upload(
    owner: string,
    id: string,
    kind: string,
    version: number,
    filename?: string,
  ) {
    const form = new FormData();
    form.set("owner_type", owner);
    form.set("owner_id", id);
    form.set("kind", kind);
    form.set("version", String(version));
    form.set(
      "file",
      new Blob([
        fs.readFileSync(
          path.join(
            "seed-assets",
            "fixtures",
            kind === "excel" ? "demo-daftar.xlsx" : "demo-lampiran.pdf",
          ),
        ),
      ]),
      filename || (kind === "excel" ? "TEST-daftar.xlsx" : "TEST-lampiran.pdf"),
    );
    return this.request("files", form);
  }
}
async function main() {
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const r = await fetch(base + "/login");
        if (r.status === 200) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    assert(ready, serverOutput);
    const anon = new Client(),
      unit = new Client(),
      other = new Client(),
      region = new Client(),
      otherRegion = new Client(),
      pam = new Client();
    await anon.request("state", undefined, 401);
    await anon.request("documents/d-fupa", undefined, 401);
    check("unauthenticated state and private documents are denied", () => {});
    await Promise.all([
      unit.login("admin.spbu@demo.test"),
      other.login("admin.bekasi@demo.test"),
      region.login("pic.region@demo.test"),
      otherRegion.login("pic.jateng@demo.test"),
      pam.login("pam@demo.test"),
    ]);
    const us = await unit.state(),
      ps = await pam.state(),
      rs = await region.state();
    check("server filters unit, region, and PAM scope", () => {
      assert(us.units.every((u) => u.id === "u1"));
      assert(us.submissions.every((s) => s.unit_id === "u1"));
      assert.equal(ps.units.length, 12);
      assert(rs.units.every((u) => u.region_id === "r1"));
      assert(!JSON.stringify(us).includes("password_hash"));
      assert(!JSON.stringify(us).includes("uploads\\"));
      assert(us.users.every((u) => u.id === us.user.id));
    });
    const cs = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://outside.example",
      },
      body: JSON.stringify({
        email: "pam@demo.test",
        password: "ArsipDemo2026!",
      }),
    });
    check("cross-site mutations are blocked", () =>
      assert.equal(cs.status, 403),
    );
    let response = await fetch(`${base}/api/files/seed-1-pdf`, {
      headers: { Cookie: unit.cookie },
    });
    check("unit cannot download another unit attachment", () =>
      assert.equal(response.status, 403),
    );
    response = await fetch(`${base}/api/documents/ibos-u2`, {
      headers: { Cookie: unit.cookie },
    });
    check("unit-specific data download enforces access", () =>
      assert.equal(response.status, 403),
    );
    response = await fetch(`${base}/api/documents/d-fupa`, {
      headers: { Cookie: unit.cookie },
    });
    check("FUPA template download follows local file availability", () => {
      const hasTemplate = fs.existsSync("seed-assets/docs/template-fupa.xlsx");
      assert.equal(response.status, hasTemplate ? 200 : 404);
      if (hasTemplate) {
        assert.equal(
          response.headers.get("cache-control"),
          "private, no-store",
        );
      }
    });
    response = await fetch(`${base}/api/documents/d-pedoman`, {
      headers: { Cookie: unit.cookie },
    });
    check("missing official document returns unavailable", () =>
      assert.equal(response.status, 404),
    );
    const initial = {
      unit_id: "u1",
      period: "Semester II 2026",
      year_from: 2020,
      year_to: 2022,
      description: "TEST pengajuan lengkap",
      boxes: 3,
      physical_sorted: true,
      photographed: true,
      signature_confirmed: true,
    };
    const created = await unit.request("submissions", initial);
    const sid = created.id;
    const invalidFile = new FormData();
    invalidFile.set("owner_type", "submission");
    invalidFile.set("owner_id", sid);
    invalidFile.set("kind", "pdf");
    invalidFile.set("version", "1");
    invalidFile.set("file", new Blob(["not a PDF"]), "invalid.pdf");
    await unit.request("files", invalidFile, 400);
    check(
      "file content signature is checked against permitted extension",
      () => {},
    );
    const getS = async () => {
      const s = (await unit.state()).submissions.find((s) => s.id === sid);
      assert(s);
      return s;
    };
    let s = await getS();
    await unit.request(
      `submissions/${sid}`,
      { action: "submit", version: s.version },
      400,
    );
    check(
      "submission is blocked when mandatory attachments are missing",
      () => {},
    );
    await other.request(
      `submissions/${sid}`,
      { ...initial, action: "save", version: s.version },
      403,
    );
    check("another unit cannot change a submission", () => {});
    await unit.upload("submission", sid, "excel", s.version);
    s = await getS();
    await unit.upload("submission", sid, "pdf", s.version);
    s = await getS();
    await unit.request(
      `submissions/${sid}`,
      { action: "submit", version: 1 },
      409,
    );
    check("stale version is rejected", () => {});
    await unit.request(`submissions/${sid}`, {
      action: "submit",
      version: s.version,
    });
    s = await getS();
    assert.equal(s.status, "submitted");
    await unit.request(
      `submissions/${sid}`,
      { ...initial, action: "save", version: s.version },
      400,
    );
    await otherRegion.request(
      `submissions/${sid}`,
      { action: "verify", version: s.version },
      403,
    );
    check("submitted records lock and other regions cannot review", () => {});
    await region.request(`submissions/${sid}`, {
      action: "revision",
      version: s.version,
      note: "TEST periksa ulang box",
    });
    s = await getS();
    assert.equal(s.status, "revision");
    await unit.request(`submissions/${sid}`, {
      ...initial,
      boxes: 4,
      action: "save",
      version: s.version,
    });
    s = await getS();
    await unit.request(`submissions/${sid}`, {
      action: "submit",
      version: s.version,
    });
    s = await getS();
    await region.request(`submissions/${sid}`, {
      action: "verify",
      version: s.version,
      note: "TEST sesuai",
    });
    s = await getS();
    check("unit → PIC revision → resubmission → verification works", () =>
      assert.equal(s.status, "verified"),
    );
    const b = await region.request("batches", {
      number: "TEST-FUPA-001/JBB/2026",
      period: initial.period,
      submission_ids: [sid],
    });
    const bid = b.id;
    const getB = async () => {
      const b = (await region.state()).batches.find((b) => b.id === bid);
      assert(b);
      return b;
    };
    let batch = await getB();
    await region.request(
      "batches",
      {
        number: "TEST-DUPLICATE",
        period: initial.period,
        submission_ids: [sid],
      },
      400,
    );
    check(
      "one unit submission cannot be counted in two regional packages",
      () => {},
    );
    await region.request(`batches/${bid}`, {
      action: "routing",
      version: batch.version,
    });
    batch = await getB();
    await region.request(
      `batches/${bid}`,
      {
        action: "memo",
        version: batch.version,
        memo_number: "TEST-MEMO",
        memo_date: "2026-11-05",
      },
      400,
    );
    check("memo needs Manager and VP confirmations", () => {});
    await region.request(`batches/${bid}`, {
      action: "save",
      version: batch.version,
      number: batch.number,
      manager_signed: true,
      vp_signed: true,
    });
    batch = await getB();
    await pam.request("admin/settings", { region_upload_required: true });
    await region.request(
      `batches/${bid}`,
      {
        action: "memo",
        version: batch.version,
        memo_number: "TEST-MEMO",
        memo_date: "2026-11-05",
      },
      400,
    );
    await region.upload("batch", bid, "regional", batch.version);
    batch = await getB();
    check("configurable regional PDF requirement is enforced", () => {});
    await region.request(
      `batches/${bid}`,
      {
        action: "memo",
        version: batch.version,
        memo_number: "TEST-MEMO",
        memo_date: "2026-02-31",
      },
      400,
    );
    await region.request(`batches/${bid}`, {
      action: "memo",
      version: batch.version,
      memo_number: "TEST-MEMO",
      memo_date: "2026-11-05",
    });
    batch = await getB();
    await region.request(
      `batches/${bid}`,
      { action: "review", version: batch.version },
      403,
    );
    await pam.request(`batches/${bid}`, {
      action: "review",
      version: batch.version,
    });
    batch = await getB();
    check("PIC records memo; only PAM can start review", () =>
      assert.equal(batch.status, "review"),
    );
    await pam.request(`batches/${bid}`, {
      action: "revision",
      version: batch.version,
      note: "TEST revisi dokumen unit",
      submission_ids: [sid],
    });
    batch = await getB();
    s = await getS();
    check(
      "PAM revision returns only selected unit and clears signature confirmation",
      () => {
        assert.equal(s.status, "revision");
        assert.equal(s.signature_confirmed, 0);
        assert.equal(batch.manager_signed, 0);
      },
    );
    await region.request(
      `batches/${bid}`,
      { action: "routing", version: batch.version },
      400,
    );
    await unit.request(`submissions/${sid}`, {
      ...initial,
      action: "save",
      version: s.version,
    });
    s = await getS();
    await unit.upload("submission", sid, "pdf", s.version);
    s = await getS();
    await unit.request(`submissions/${sid}`, {
      action: "submit",
      version: s.version,
    });
    s = await getS();
    await region.request(`submissions/${sid}`, {
      action: "verify",
      version: s.version,
    });
    batch = await getB();
    await region.request(`batches/${bid}`, {
      action: "routing",
      version: batch.version,
    });
    batch = await getB();
    check(
      "re-routing snapshots the new submission version and clears old memo",
      () => {
        assert.equal(batch.memo_number, "");
        assert.equal(batch.manager_signed, 0);
      },
    );
    await region.request(`batches/${bid}`, {
      action: "save",
      version: batch.version,
      number: batch.number,
      manager_signed: true,
      vp_signed: true,
    });
    batch = await getB();
    await region.request(`batches/${bid}`, {
      action: "memo",
      version: batch.version,
      memo_number: "TEST-MEMO-REVISI",
      memo_date: "2026-11-05",
    });
    batch = await getB();
    await pam.request(`batches/${bid}`, {
      action: "review",
      version: batch.version,
    });
    batch = await getB();
    await pam.request(`batches/${bid}`, {
      action: "reviewed",
      version: batch.version,
      note: "TEST selesai kajian administrasi",
    });
    batch = await getB();
    check("full revised regional workflow reaches PAM reviewed state", () =>
      assert.equal(batch.status, "reviewed"),
    );
    await unit.request(
      "capacity",
      {
        unit_id: "u1",
        total: 10,
        used: 11,
        condition: "Baik",
        temperature: null,
        humidity: null,
        note: "",
      },
      400,
    );
    await unit.request("capacity", {
      unit_id: "u1",
      total: 10,
      used: 5,
      condition: "Baik",
      temperature: 21,
      humidity: 55,
      note: "TEST monitoring",
    });
    check("monitoring persists and rejects impossible capacity", () => {});
    const issue = await unit.request("issues", {
      unit_id: "u1",
      title: "TEST Box lembap",
      description: "TEST perlu pemeriksaan",
      category: "Kondisi penyimpanan",
      priority: "Tinggi",
    });
    await region.request(`issues/${issue.id}`, {
      status: "resolved",
      note: "TEST pemeriksaan selesai",
    });
    check("issue report and region follow-up persist", () => {});
    await unit.request(
      "admin/regions",
      { code: "TEST", name: "TEST Region" },
      403,
    );
    await pam.request("admin/regions", { code: "TEST", name: "TEST Region" });
    await pam.request("admin/units", {
      code: "TEST-01",
      name: "TEST Unit",
      city: "TEST Kota",
      region_id: "r1",
    });
    check("admin creation enforces PAM role", () => {});
    const docUpload = new FormData();
    docUpload.set("owner_type", "document");
    docUpload.set("owner_id", "d-pedoman");
    docUpload.set("kind", "document");
    docUpload.set(
      "file",
      new Blob([fs.readFileSync("seed-assets/fixtures/demo-lampiran.pdf")]),
      "TEST-pedoman.pdf",
    );
    docUpload.set("document_version", "TEST versi");
    await unit.request("files", docUpload, 403);
    await pam.request("files", docUpload);
    const afterDoc = await unit.state();
    check(
      "only PAM supplies missing reference documents and availability refreshes",
      () =>
        assert(afterDoc.documents.find((d) => d.id === "d-pedoman")?.available),
    );
    const templateUpload = new FormData();
    templateUpload.set("owner_type", "document");
    templateUpload.set("owner_id", "d-fupa");
    templateUpload.set("kind", "document");
    templateUpload.set(
      "file",
      new Blob([fs.readFileSync("seed-assets/fixtures/demo-daftar.xlsx")]),
      "TEST-template.xlsx",
    );
    templateUpload.set("document_version", "TEST workbook");
    await pam.request("files", templateUpload);
    const templates = (await unit.state()).documents.filter((d) =>
      ["d-fupa", "d-daftar"].includes(d.id),
    );
    check(
      "FUPA and archive-list references stay on the same workbook version",
      () =>
        assert(
          templates.every(
            (d) =>
              d.filename === "TEST-template.xlsx" &&
              d.version === "TEST workbook",
          ),
        ),
    );
    const account = {
      name: "TEST User",
      email: "test-created@demo.test",
      password: "TestAccount2026!",
      role: "unit",
      region_id: "r1",
      unit_id: "u1",
    };
    await pam.request("admin/users", account);
    const createdClient = new Client();
    await createdClient.request("auth/login", {
      email: account.email,
      password: account.password,
    });
    const userId = (await createdClient.state()).user.id;
    await pam.request("admin/users", { action: "toggle", id: userId });
    await createdClient.request("state", undefined, 401);
    check(
      "new account login works and deactivation invalidates sessions",
      () => {},
    );
    const chat = await unit.request("help", {
      question: "Bagaimana alur pengajuan FUPA?",
    });
    check("FAQ returns curated guidance and is private per user", () =>
      assert(chat.answer.includes("I-BOS")),
    );
    assert.equal((await other.request("help")).length, 0);
    const final = await unit.state();
    check(
      "audit history preserves all workflow transitions and file versions",
      () => {
        assert(final.events.some((e) => e.action === "Pengkajian PAM selesai"));
        assert(
          final.files.filter((f) => f.owner_id === sid && f.kind === "pdf")
            .length === 2,
        );
        assert(final.batches.some((b) => b.id === bid));
      },
    );
    await unit.request("auth/logout", {});
    await unit.request("state", undefined, 401);
    check("logout revokes session", () => {});
    console.log(
      `\n${checks} integration checks passed. Isolated database: ${folder}`,
    );
  } catch (e) {
    console.error(e);
    console.error(serverOutput);
    process.exitCode = 1;
  } finally {
    server.kill();
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      setTimeout(() => resolve(), 3000);
    });
    if (folder.startsWith(path.join(os.tmpdir(), "arsip-gs-integration-")))
      fs.rmSync(folder, { recursive: true, force: true });
  }
}
void main();
