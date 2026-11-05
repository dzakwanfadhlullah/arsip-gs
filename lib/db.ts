import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, scryptSync } from "node:crypto";
import type { Document, User } from "./types";
export const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.ARSIP_DATA_DIR ||
    path.join(process.cwd(), "data"),
);
export const uploadDir = path.join(dataDir, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const globalDb = globalThis as unknown as { arsipDb?: DatabaseSync };
export const db =
  globalDb.arsipDb ?? new DatabaseSync(path.join(dataDir, "arsip.sqlite"));
globalDb.arsipDb = db;
db.exec(`PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS regions(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,region_id TEXT NOT NULL REFERENCES regions(id),city TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('unit','region','pam')),region_id TEXT REFERENCES regions(id),unit_id TEXT REFERENCES units(id),active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts(ip TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id),period TEXT NOT NULL,year_from INTEGER NOT NULL,year_to INTEGER NOT NULL,description TEXT NOT NULL,boxes INTEGER NOT NULL CHECK(boxes>=0),status TEXT NOT NULL CHECK(status IN ('draft','submitted','revision','verified')),physical_sorted INTEGER NOT NULL DEFAULT 0,photographed INTEGER NOT NULL DEFAULT 0,signature_confirmed INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,region_id TEXT NOT NULL REFERENCES regions(id),number TEXT NOT NULL COLLATE NOCASE UNIQUE,period TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','routing','memo','review','revision','reviewed')),manager_signed INTEGER NOT NULL DEFAULT 0,vp_signed INTEGER NOT NULL DEFAULT 0,memo_number TEXT NOT NULL DEFAULT '',memo_date TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS memberships(batch_id TEXT NOT NULL REFERENCES batches(id),submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id),submission_version INTEGER NOT NULL,PRIMARY KEY(batch_id,submission_id));
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,owner_type TEXT NOT NULL,owner_id TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,path TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS capacities(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id),total INTEGER NOT NULL CHECK(total>=0),used INTEGER NOT NULL CHECK(used>=0 AND used<=total),condition TEXT NOT NULL,temperature REAL,humidity REAL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS issues(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id),title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,version TEXT NOT NULL,filename TEXT,path TEXT,unit_id TEXT REFERENCES units(id),is_demo INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS notification_reads(user_id TEXT NOT NULL REFERENCES users(id),event_id TEXT NOT NULL REFERENCES events(id),PRIMARY KEY(user_id,event_id));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chats(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),question TEXT NOT NULL,answer TEXT NOT NULL,sources TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS submission_unit ON submissions(unit_id,status,updated_at);
CREATE INDEX IF NOT EXISTS batch_region ON batches(region_id,status);
CREATE INDEX IF NOT EXISTS file_owner ON files(owner_type,owner_id,version);
CREATE INDEX IF NOT EXISTS event_entity ON events(entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS capacity_unit ON capacities(unit_id,created_at);
`);
export function rows<T>(
  sql: string,
  ...params: (string | number | null)[]
): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}
export function one<T>(
  sql: string,
  ...params: (string | number | null)[]
): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}
export function run(sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).run(...params);
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const v = fn();
    db.exec("COMMIT");
    return v;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
export function event(
  type: string,
  entityId: string,
  action: string,
  note: string,
  userId: string,
) {
  run(
    "INSERT INTO events VALUES(?,?,?,?,?,?,?)",
    id("EVT"),
    type,
    entityId,
    action,
    note,
    userId,
    new Date().toISOString(),
  );
}
export const publicUserFields = "id,name,email,role,region_id,unit_id,active";
export const documents = () =>
  rows<Document & { path: string | null; published: number }>(
    "SELECT * FROM documents",
  ).map((d) => ({
    ...d,
    available: !!d.path && fs.existsSync(d.path),
    is_demo: !!d.is_demo,
  }));
function seed() {
  transaction(() => {
    if (one("SELECT id FROM regions LIMIT 1")) return;
    [
      ["r1", "Regional Jawa Bagian Barat", "JBB"],
      ["r2", "Regional Jawa Bagian Tengah", "JBT"],
      ["r3", "Regional Jawa Timur, Bali & Nusa Tenggara", "JATIMBALINUS"],
    ].forEach((r) => run("INSERT INTO regions VALUES(?,?,?)", ...r));
    const units = [
      ["u1", "31.129.02", "SPBU COCO Kuningan", "r1", "Jakarta Selatan"],
      ["u2", "31.171.01", "SPBU COCO Bekasi", "r1", "Bekasi"],
      ["u3", "31.401.01", "SPBU COCO Dago", "r1", "Bandung"],
      ["u4", "31.153.01", "SPBU COCO BSD", "r1", "Tangerang Selatan"],
      ["u5", "31.161.01", "SPBU COCO Bogor", "r1", "Bogor"],
      ["u6", "41.501.01", "SPBU COCO Ahmad Yani", "r2", "Semarang"],
      ["u7", "41.551.01", "SPBU COCO Lempuyangan", "r2", "Yogyakarta"],
      ["u8", "41.571.01", "SPBU COCO Solo", "r2", "Surakarta"],
      ["u9", "51.601.01", "SPBU COCO Jemursari", "r3", "Surabaya"],
      ["u10", "51.651.01", "SPBU COCO Malang", "r3", "Malang"],
      ["u11", "51.801.01", "SPBU COCO Denpasar", "r3", "Denpasar"],
      ["u12", "51.831.01", "SPBU COCO Mataram", "r3", "Mataram"],
    ];
    units.forEach((u) =>
      run(
        "INSERT INTO units(id,code,name,region_id,city) VALUES(?,?,?,?,?)",
        ...u,
      ),
    );
    const people = [
      ["usr-unit", "Alya Pratama", "admin.spbu@demo.test", "unit", "r1", "u1"],
      ["usr-unit2", "Raka Putra", "admin.bekasi@demo.test", "unit", "r1", "u2"],
      [
        "usr-region",
        "Dimas Saputra",
        "pic.region@demo.test",
        "region",
        "r1",
        null,
      ],
      [
        "usr-region2",
        "Nadia Putri",
        "pic.jateng@demo.test",
        "region",
        "r2",
        null,
      ],
      ["usr-pam", "Sinta Maharani", "pam@demo.test", "pam", null, null],
    ];
    people.forEach((p) => {
      const salt = randomUUID();
      run(
        "INSERT INTO users(id,name,email,password_hash,salt,role,region_id,unit_id) VALUES(?,?,?,?,?,?,?,?)",
        p[0]!,
        p[1]!,
        p[2]!,
        scryptSync("ArsipDemo2026!", salt, 64).toString("hex"),
        salt,
        p[3]!,
        p[4],
        p[5],
      );
    });
    run("INSERT INTO settings VALUES(?,?)", "region_upload_required", "false");
    run("INSERT INTO settings VALUES(?,?)", "numbering_scope", "regional");
    run("INSERT INTO settings VALUES(?,?)", "pam_permission_separable", "true");
    const ago = (hours: number) =>
      new Date(Date.now() - hours * 3600000).toISOString();
    const statuses = [
      "draft",
      "submitted",
      "verified",
      "verified",
      "revision",
      "verified",
      "submitted",
      "draft",
      "verified",
      "verified",
      "submitted",
      "draft",
    ];
    units.forEach((u, i) => {
      const sid = `UNIT-2026-${String(i + 1).padStart(3, "0")}`;
      run(
        "INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        sid,
        u[0],
        "Semester II 2026",
        2020,
        2022,
        [
          "Dokumen penjualan dan administrasi operasional",
          "Dokumen settlement dan rekap transaksi",
          "Dokumen administrasi umum SPBU",
        ][i % 3],
        8 + i * 2,
        statuses[i],
        1,
        1,
        statuses[i] === "draft" ? 0 : 1,
        1,
        ago(120 - i * 6),
        ago(36 - i * 2),
        i === 1 ? "usr-unit2" : "usr-unit",
      );
      if (statuses[i] !== "draft")
        for (const kind of ["excel", "pdf"]) {
          const src = path.join(
            process.cwd(),
            "seed-assets",
            "fixtures",
            kind === "excel" ? "demo-daftar.xlsx" : "demo-lampiran.pdf",
          );
          if (fs.existsSync(src)) {
            const fid = `seed-${i}-${kind}`;
            const dest = path.join(uploadDir, fid);
            fs.copyFileSync(src, dest);
            run(
              "INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?)",
              fid,
              "submission",
              sid,
              kind,
              kind === "excel"
                ? "DEMO_Daftar_Arsip.xlsx"
                : "DEMO_Lampiran_Arsip.pdf",
              kind === "excel"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/pdf",
              fs.statSync(dest).size,
              dest,
              1,
              ago(35 - i * 2),
              "usr-unit",
            );
          }
        }
      run(
        "INSERT INTO capacities VALUES(?,?,?,?,?,?,?,?,?,?)",
        id("CAP"),
        u[0],
        80 + i * 10,
        Math.min(80 + i * 10, 36 + i * 8),
        i === 4 || i === 8 ? "Perlu perhatian" : "Baik",
        i === 8 ? 26 : 21,
        55,
        i === 8
          ? "Ventilasi perlu diperiksa."
          : "Pemeriksaan rutin ruang arsip.",
        ago(24 + i * 10),
        "usr-unit",
      );
      run(
        "INSERT INTO events VALUES(?,?,?,?,?,?,?)",
        id("EVT"),
        "submission",
        sid,
        statuses[i] === "draft" ? "Draft dibuat" : "Berkas unit diperbarui",
        "Data demonstrasi, bukan pengajuan operasional.",
        "usr-unit",
        ago(35 - i * 2),
      );
    });
    const bs = [
      ["FUPA-2026-001", "r1", "FUPA-001/JBB/2026", "routing", 0, 0, "", ""],
      [
        "FUPA-2026-002",
        "r2",
        "FUPA-002/JBT/2026",
        "review",
        1,
        1,
        "MEMO-DEMO-002/JBT/2026",
        "2026-11-02",
      ],
      [
        "FUPA-2026-003",
        "r3",
        "FUPA-003/JATIMBALINUS/2026",
        "reviewed",
        1,
        1,
        "MEMO-DEMO-003/JATIMBALINUS/2026",
        "2026-10-30",
      ],
    ];
    bs.forEach((b) =>
      run(
        "INSERT INTO batches VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        b[0],
        b[1],
        b[2],
        "Semester II 2026",
        b[3],
        b[4],
        b[5],
        b[6],
        b[7],
        1,
        ago(96),
        ago(12),
        "usr-region",
      ),
    );
    [
      ["FUPA-2026-001", "UNIT-2026-003"],
      ["FUPA-2026-001", "UNIT-2026-004"],
      ["FUPA-2026-002", "UNIT-2026-006"],
      ["FUPA-2026-003", "UNIT-2026-009"],
      ["FUPA-2026-003", "UNIT-2026-010"],
    ].forEach((m) => run("INSERT INTO memberships VALUES(?,?,?)", ...m, 1));
    run(
      "INSERT INTO events VALUES(?,?,?,?,?,?,?)",
      id("EVT"),
      "batch",
      "FUPA-2026-002",
      "Pengkajian PAM dimulai",
      "Pemeriksaan administrasi daftar arsip dan kelengkapan lampiran.",
      "usr-pam",
      ago(8),
    );
    run(
      "INSERT INTO events VALUES(?,?,?,?,?,?,?)",
      id("EVT"),
      "batch",
      "FUPA-2026-003",
      "Pengkajian selesai",
      "Administrasi pengkajian selesai. Bukan izin pemusnahan fisik.",
      "usr-pam",
      ago(4),
    );
    run(
      "INSERT INTO events VALUES(?,?,?,?,?,?,?)",
      id("EVT"),
      "submission",
      "UNIT-2026-005",
      "Revisi diperlukan",
      "Mohon periksa kembali tahun arsip dan kesesuaian jumlah box.",
      "usr-region",
      ago(6),
    );
    [
      [
        "ISS-2026-001",
        "u5",
        "Box arsip mulai lembap",
        "Beberapa box pada rak bawah mulai lembap setelah hujan.",
        "Kondisi penyimpanan",
        "Tinggi",
        "open",
      ],
      [
        "ISS-2026-002",
        "u1",
        "Kebutuhan tambahan box",
        "Kapasitas box untuk dokumen operasional semester berikutnya perlu ditambah.",
        "Kapasitas",
        "Normal",
        "progress",
      ],
      [
        "ISS-2026-003",
        "u9",
        "Sirkulasi udara ruang arsip",
        "Suhu ruang tercatat 26°C saat pemeriksaan terakhir.",
        "Pemeliharaan",
        "Tinggi",
        "open",
      ],
    ].forEach((i) =>
      run(
        "INSERT INTO issues VALUES(?,?,?,?,?,?,?,?,?,?)",
        ...i,
        ago(48),
        ago(12),
        "usr-unit",
      ),
    );
    const docs = [
      [
        "d-pedoman",
        "Pedoman Pengelolaan Arsip",
        "materi",
        "Pedoman resmi perusahaan.",
        "Menunggu berkas",
        null,
      ],
      [
        "d-c001",
        "TKI C001 · Dokumen Hardpaper Aktif",
        "materi",
        "Tata kerja pengelolaan dokumen aktif di unit pencipta.",
        "Dokumen unggahan · 2025",
        "tki-c001.pdf",
      ],
      [
        "d-c002",
        "TKI C002 · Dokumen Hardpaper Inaktif",
        "materi",
        "Tata kerja pengelolaan dokumen di ruang arsip inaktif.",
        "Dokumen unggahan · 2025",
        "tki-c002.pdf",
      ],
      [
        "d-jrdp",
        "JRDP & Formulir Standar Arsip",
        "materi",
        "JRDP berada pada halaman pertama; termasuk formulir standar kearsipan.",
        "Dokumen unggahan",
        "template-dok-arsip.pdf",
      ],
      [
        "d-buku",
        "Buku Saku Lapangan Pengelolaan Arsip",
        "materi",
        "Panduan praktis pengelolaan arsip untuk petugas lapangan.",
        "Menunggu berkas",
        null,
      ],
      [
        "d-sprint",
        "Sprint Tim Arsip",
        "materi",
        "Dokumen sprint dan koordinasi tim arsip.",
        "Menunggu berkas",
        null,
      ],
      [
        "d-ibos",
        "Manual Book Admin Unit · I-BOS",
        "materi",
        "Tata cara penggunaan I-BOS. Ekspor dilakukan di luar Web Arsip GS.",
        "Menunggu berkas",
        null,
      ],
      [
        "d-fupa",
        "Template Form FUPA",
        "template",
        "Workbook asli, berisi formulir FUPA dan lampiran daftar arsip.",
        "Template unggahan",
        "template-fupa.xlsx",
      ],
      [
        "d-daftar",
        "Template Daftar Arsip",
        "template",
        "Gunakan sheet “Template FUPA” dalam workbook yang tersedia.",
        "Bagian dari workbook FUPA",
        "template-fupa.xlsx",
      ],
    ];
    docs.forEach((d) => {
      const p = d[5]
        ? path.join(process.cwd(), "seed-assets", "docs", d[5])
        : null;
      run(
        "INSERT INTO documents(id,title,category,description,version,filename,path) VALUES(?,?,?,?,?,?,?)",
        d[0]!,
        d[1]!,
        d[2]!,
        d[3]!,
        d[4]!,
        d[5],
        p,
      );
    });
    units.forEach((u) =>
      run(
        "INSERT INTO documents(id,title,category,description,version,filename,path,unit_id,is_demo) VALUES(?,?,?,?,?,?,?,?,?)",
        `ibos-${u[0]}`,
        `Contoh Data Unit ${u[1]}`,
        "data-unit",
        "Data CSV demonstrasi. Bukan hasil tarikan I-BOS yang sebenarnya.",
        "Demo · 2026",
        "contoh-data-unit.csv",
        path.join(process.cwd(), "seed-assets", "demo-data.csv"),
        u[0],
        1,
      ),
    );
  });
}
seed();
export function getUser(userId: string) {
  return one<User>(
    `SELECT ${publicUserFields} FROM users WHERE id=? AND active=1`,
    userId,
  );
}
