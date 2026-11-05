import "server-only";
import { cookies, headers } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { one, run, getUser } from "./db";
import { AppError } from "./domain";
const cookieName = "arsip_session";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = one<{ user_id: string }>(
    "SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?",
    hash(token),
    new Date().toISOString(),
  );
  return session ? (getUser(session.user_id) ?? null) : null;
}
export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new AppError("Sesi berakhir. Silakan masuk kembali.", 401);
  return u;
}
export async function login(email: string, password: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] || "local";
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  run("DELETE FROM login_attempts WHERE created_at<?", since);
  const count =
    one<{ n: number }>(
      "SELECT COUNT(*) n FROM login_attempts WHERE ip=? AND created_at>?",
      ip,
      since,
    )?.n ?? 0;
  if (count >= 15)
    throw new AppError(
      "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
      429,
    );
  const u = one<{
    id: string;
    password_hash: string;
    salt: string;
    active: number;
  }>(
    "SELECT id,password_hash,salt,active FROM users WHERE email=?",
    email.toLowerCase().trim(),
  );
  const salt = u?.salt || "dummy-salt-for-timing";
  const computed = scryptSync(password, salt, 64);
  if (
    !u ||
    !u.active ||
    !timingSafeEqual(Buffer.from(u.password_hash, "hex"), computed)
  ) {
    run("INSERT INTO login_attempts VALUES(?,?)", ip, new Date().toISOString());
    throw new AppError("Email atau kata sandi tidak sesuai.", 401);
  }
  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 7 * 86400000);
  run(
    "INSERT INTO sessions VALUES(?,?,?)",
    hash(token),
    u.id,
    expiry.toISOString(),
  );
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.ARSIP_SECURE_COOKIES === "true",
    sameSite: "lax",
    path: "/",
    expires: expiry,
  });
  return getUser(u.id)!;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) run("DELETE FROM sessions WHERE token_hash=?", hash(token));
  jar.delete(cookieName);
}
