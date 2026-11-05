"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Archive,
  ShieldCheck,
  Layers,
  FileCheck2,
  ArrowUpRight,
} from "lucide-react";
import { api, Button, Field } from "./ui";
const accounts = [
  ["Admin Unit", "admin.spbu@demo.test", "SPBU COCO Kuningan"],
  ["PIC Region", "pic.region@demo.test", "Regional Jawa Bagian Barat"],
  ["PAM / DC", "pam@demo.test", "Pemantauan seluruh region"],
];
export function Login() {
  const [email, setEmail] = useState(accounts[0][1]),
    [password, setPassword] = useState("ArsipDemo2026!"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="login-page">
      <section className="login-aside">
        <Link className="login-brand" href="/" aria-label="Beranda Arsip GS">
          <span className="brand-symbol">
            <Archive size={23} />
          </span>
          <span>
            ARSIP <b>GS</b>
            <small>PERTAMINA RETAIL</small>
          </span>
        </Link>
        <div className="login-intro">
          <h1>Pengelolaan arsip dari unit hingga regional</h1>
          <p>
            Siapkan pengajuan FUPA dan pantau progres pengkajian di workspace
            Arsip GS.
          </p>
          <div className="login-preview">
            <div className="preview-bar">
              <i />
              <i />
              <i />
              <span>Pengajuan arsip</span>
            </div>
            {[
              ["01", "Persiapan unit", "Selesai"],
              ["02", "Review PIC Region", "Selesai"],
              ["03", "Memo regional", "Selesai"],
              ["04", "Pengkajian PAM", "Dalam proses"],
            ].map((r, i) => (
              <div key={r[0]} className="preview-row">
                <span className={i === 3 ? "current" : ""}>{r[0]}</span>
                <strong>{r[1]}</strong>
                <small>{r[2]}</small>
              </div>
            ))}
          </div>
        </div>
        <footer>
          <span>General Services · Pertamina Retail</span>
          <span>Lingkungan lokal</span>
        </footer>
      </section>
      <section className="login-main">
        <span className="demo-label">
          <i /> Workspace demo
        </span>
        <div className="login-form">
          <span className="login-icon">
            <Layers size={24} />
          </span>
          <h2>Masuk ke Arsip GS</h2>
          <p>Masuk untuk melanjutkan pengelolaan arsip.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("auth/login", { email, password });
                window.location.assign("/workspace");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email">
              <input
                required
                autoComplete="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Kata sandi">
              <input
                required
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button
              variant="primary"
              loading={busy}
              type="submit"
              className="w-full"
            >
              Masuk ke workspace <ArrowRight size={16} />
            </Button>
          </form>
          <div className="demo-accounts">
            <span>Pilih akun demo</span>
            {accounts.map((a) => (
              <button
                key={a[0]}
                onClick={() => {
                  setEmail(a[1]);
                  setPassword("ArsipDemo2026!");
                  setError("");
                }}
                className={email === a[1] ? "selected" : ""}
              >
                <span className="demo-role-icon">
                  {a[0] === "Admin Unit" ? (
                    <Archive size={16} />
                  ) : a[0] === "PIC Region" ? (
                    <Layers size={16} />
                  ) : (
                    <FileCheck2 size={16} />
                  )}
                </span>
                <span>
                  <strong>{a[0]}</strong>
                  <small>{a[2]}</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="login-note">
            <ShieldCheck size={16} />
            <span>
              Data contoh untuk eksplorasi. Dokumen asli tetap tersedia pada
              Pusat Dokumen sesuai hak akses.
            </span>
          </div>
        </div>
        <small className="login-bottom">Arsip GS · v1.0 local workspace</small>
      </section>
    </main>
  );
}
