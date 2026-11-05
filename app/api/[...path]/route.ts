import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { ZodError } from "zod";
import { login, logout, requireUser } from "@/lib/auth";
import { AppError, assert, unitAccess } from "@/lib/domain";
import { documents, one } from "@/lib/db";
import type { Unit } from "@/lib/types";
import {
  stateFor,
  mutateSubmission,
  mutateBatch,
  accessibleFile,
  upload,
  mutateMonitoring,
  admin,
  markRead,
  help,
} from "@/lib/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await params).path;
    const method = req.method;
    if (method === "POST") {
      const origin = req.headers.get("origin");
      assert(
        !origin ||
          (new URL(origin).host === req.headers.get("host") &&
            ["http:", "https:"].includes(new URL(origin).protocol)),
        "Permintaan lintas situs ditolak.",
        403,
      );
      assert(
        Number(req.headers.get("content-length") || 0) <= 25 * 1024 * 1024,
        "Permintaan melebihi 25 MB.",
        413,
      );
    }
    if (p.join("/") === "auth/login" && method === "POST") {
      const b = await req.json();
      assert(
        typeof b.email === "string" &&
          typeof b.password === "string" &&
          b.password.length <= 100,
        "Email dan kata sandi wajib diisi.",
      );
      return NextResponse.json({ user: await login(b.email, b.password) });
    }
    const user = await requireUser();
    if (p.join("/") === "auth/logout" && method === "POST") {
      await logout();
      return NextResponse.json({ ok: true });
    }
    if (p[0] === "state" && method === "GET")
      return NextResponse.json(stateFor(user));
    if (p[0] === "files" && p[1] && method === "GET") {
      const f = accessibleFile(user, p[1]);
      return new NextResponse(fs.readFileSync(f.path), {
        headers: {
          "Content-Type": f.mime,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (p[0] === "documents" && p[1] && method === "GET") {
      const d = documents().find((d) => d.id === p[1] && d.published);
      assert(d, "Dokumen tidak ditemukan.", 404);
      if (d.unit_id)
        assert(
          unitAccess(
            user,
            one<Unit>("SELECT * FROM units WHERE id=?", d.unit_id),
          ),
          "Data unit di luar akses Anda.",
          403,
        );
      assert(
        d.available && d.path,
        "Dokumen belum disediakan administrator.",
        404,
      );
      return new NextResponse(fs.readFileSync(d.path), {
        headers: {
          "Content-Type": d.filename?.endsWith(".xlsx")
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : d.filename?.endsWith(".csv")
              ? "text/csv; charset=utf-8"
              : "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.filename || "dokumen")}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (method === "POST" && p[0] === "files")
      return NextResponse.json(await upload(user, await req.formData()));
    if (p[0] === "help")
      return NextResponse.json(
        help(user, method === "POST" ? await req.json() : undefined),
      );
    if (method === "POST") {
      const b = await req.json();
      let result: unknown;
      if (p[0] === "submissions") result = mutateSubmission(user, p[1], b);
      else if (p[0] === "batches") result = mutateBatch(user, p[1], b);
      else if (p[0] === "capacity" || p[0] === "issues")
        result = mutateMonitoring(user, p[0], b, p[1]);
      else if (p[0] === "admin") result = admin(user, p[1], b);
      else if (p[0] === "notifications") result = markRead(user, b);
      else throw new AppError("Halaman tidak ditemukan.", 404);
      return NextResponse.json(result || { ok: true });
    }
    throw new AppError("Halaman tidak ditemukan.", 404);
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    if (e instanceof AppError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof Error && e.message.includes("UNIQUE constraint"))
      return NextResponse.json(
        { error: "Nomor, kode, atau email tersebut sudah digunakan." },
        { status: 409 },
      );
    console.error(e);
    return NextResponse.json(
      { error: "Terjadi kendala. Coba muat ulang halaman." },
      { status: 500 },
    );
  }
}
async function route(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const response = await handle(req, context);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const GET = route;
export const POST = route;
