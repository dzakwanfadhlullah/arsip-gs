import Link from "next/link";
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  FileText,
  Files,
  Layers,
  LayoutDashboard,
  Search,
  TriangleAlert,
} from "lucide-react";
import { currentUser } from "@/lib/auth";

const navigation = [
  [LayoutDashboard, "Ringkasan"],
  [Files, "Pengajuan unit"],
  [Layers, "FUPA regional"],
  [ChartNoAxesCombined, "Monitoring arsip"],
  [TriangleAlert, "Kendala & tindak lanjut"],
  [BookOpen, "Pusat dokumen"],
] as const;

const sampleRows = [
  ["PU-2026-001", "SPBU COCO Kuningan", "Draf", "neutral", "18 box"],
  ["PU-2026-002", "SPBU COCO Bekasi", "Menunggu review", "blue", "24 box"],
  ["PU-2026-003", "SPBU COCO Cikini", "Perlu revisi", "amber", "16 box"],
  ["PU-2026-004", "SPBU COCO Bandung", "Terverifikasi", "green", "30 box"],
  ["PU-2026-005", "SPBU COCO Cirebon", "Terverifikasi", "green", "12 box"],
] as const;

const steps = [
  [
    "01",
    "Admin Unit",
    "Siapkan daftar arsip",
    "Gunakan data yang diambil dari i-BOS, pisahkan arsip, foto kondisinya, lalu unggah Excel dan PDF yang sudah ditandatangani.",
  ],
  [
    "02",
    "PIC Region",
    "Susun FUPA regional",
    "Tinjau berkas unit, susun paket regional, lalu catat nomor dan tanggal memo setelah persetujuan diproses di luar aplikasi.",
  ],
  [
    "03",
    "PAM / Document Control",
    "Kaji usulan pemusnahan",
    "Tinjau paket dan lampirannya, minta revisi bila perlu, lalu catat hasil pengkajian.",
  ],
] as const;

function ProductPreview() {
  return (
    <figure
      className="product-stage"
      aria-label="Pratinjau daftar pengajuan dengan data ilustrasi"
    >
      <div className="product-window">
        <div className="product-top">
          <span className="product-brand">
            <Archive size={15} /> Arsip GS
          </span>
          <span className="product-search">
            <Search size={13} /> Cari di workspace
          </span>
          <span className="product-demo">Data contoh</span>
        </div>
        <div className="product-body">
          <div className="product-sidebar" aria-hidden="true">
            <strong>Workspace</strong>
            {navigation.map(([Icon, label]) => (
              <span
                key={label}
                className={label === "Pengajuan unit" ? "selected" : ""}
              >
                <Icon size={15} /> {label}
              </span>
            ))}
          </div>
          <div className="product-records">
            <div className="product-record-heading">
              <h2>Pengajuan unit</h2>
              <span aria-hidden="true">+ Pengajuan baru</span>
            </div>
            <div className="product-tabs">
              <strong>Semua pengajuan</strong>
              <span>Menunggu review</span>
            </div>
            <div className="product-labels">
              <span>Unit / pengajuan</span>
              <span>Status</span>
              <span>Arsip</span>
            </div>
            {sampleRows.map(([id, name, status, tone, quantity]) => (
              <div className="product-row" key={id}>
                <div>
                  <FileText size={16} />
                  <span>
                    <strong>{name}</strong>
                    <small>{id}</small>
                  </span>
                </div>
                <span className={`product-status ${tone}`}>
                  <i />
                  {status}
                </span>
                <span className="product-quantity">{quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

export default async function Page() {
  const signedIn = Boolean(await currentUser());
  const entry = signedIn ? "/workspace" : "/login";
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Link className="landing-brand" href="/">
            <Archive size={24} /> Arsip GS
          </Link>
          <nav aria-label="Navigasi utama">
            <a href="#workspace-preview">Pratinjau</a>
            <a href="#alur">Alur FUPA</a>
            <a href="#referensi">Dokumen</a>
          </nav>
          <Link className="landing-button solid" href={entry}>
            {signedIn ? "Buka workspace" : "Masuk"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main className="landing-wrap">
        <section className="landing-hero" aria-labelledby="landing-title">
          <p className="landing-kicker">General Services · Pertamina Retail</p>
          <h1 id="landing-title">
            Pengelolaan arsip dari unit
            <br className="hero-break" /> hingga regional
          </h1>
          <p className="landing-lead">
            Siapkan pengajuan FUPA, pantau kelengkapan berkas SPBU, dan lihat
            progres pengkajian PAM dalam satu ruang kerja.
          </p>
          <div className="landing-actions">
            <Link className="landing-button solid" href={entry}>
              {signedIn ? "Buka workspace" : "Masuk ke workspace"}
              <ArrowRight size={17} />
            </Link>
            <a className="landing-button" href="#alur">
              Lihat alur FUPA
              <ArrowDown size={16} />
            </a>
          </div>
        </section>
        <div id="workspace-preview">
          <ProductPreview />
        </div>
        <section className="landing-section" id="alur">
          <div className="landing-section-intro">
            <span>Alur kerja</span>
            <h2>Dari daftar arsip hingga pengkajian</h2>
          </div>
          <ol className="landing-steps">
            {steps.map(([number, role, title, description]) => (
              <li key={number}>
                <span>
                  {number} / {role}
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="landing-section landing-reference" id="referensi">
          <div className="landing-section-intro">
            <span>Referensi</span>
            <h2>Pedoman dan template pengajuan</h2>
            <p>
              Akses TKI, template FUPA, dan materi pengelolaan arsip yang
              tersedia melalui Pusat dokumen.
            </p>
          </div>
          <Link
            className="landing-button"
            href={signedIn ? "/workspace/dokumen" : "/login"}
          >
            Buka pusat dokumen
            <ArrowUpRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="landing-wrap landing-footer">
        <span>Arsip GS · Pertamina Retail</span>
        <span>Lingkungan demonstrasi</span>
      </footer>
    </div>
  );
}
