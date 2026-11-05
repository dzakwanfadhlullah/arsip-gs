"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowUpRight,
  Sparkles,
  Send,
  Plus,
  Users,
  MapPin,
  Layers,
  ShieldCheck,
  Search,
  CheckCircle2,
  Info,
  Loader2,
  ArrowRight,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import type { PageProps } from "./workspace";
import type { Document, Role } from "@/lib/types";
import {
  api,
  Button,
  Badge,
  PageTitle,
  Modal,
  Field,
  Select,
  Check,
  Notice,
  Empty,
  SearchInput,
  Tabs,
  UploadBox,
  fmtDate,
  fmtTime,
  roleLabel,
  Avatar,
  exportCsv,
} from "./ui";
export function Documents({ data, refresh }: PageProps) {
  const [tab, setTab] = useState("all"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Document | null>(null),
    [version, setVersion] = useState("");
  const docs = data.documents.filter(
    (d) =>
      (tab === "all" || d.category === tab) &&
      `${d.title} ${d.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="Pusat dokumen"
        description="Unduh pedoman resmi dan template untuk menyiapkan pengajuan arsip."
      />
      {data.documents.some((d) => d.id === "d-fupa" && d.available) && (
        <div className="document-banner">
          <span>
            <BookOpen size={24} />
          </span>
          <div>
            <h2>Template pengajuan FUPA</h2>
            <p>
              Gunakan workbook FUPA asli. Daftar arsip tersedia pada sheet
              “Template FUPA”.
            </p>
          </div>
          <a href="/api/documents/d-fupa" className="button">
            <Download size={14} />
            Unduh template FUPA
          </a>
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "all", label: "Semua dokumen", count: data.documents.length },
          { id: "materi", label: "Materi & pedoman" },
          { id: "template", label: "Template pengajuan" },
          { id: "data-unit", label: "Data unit" },
        ]}
      />
      <div className="table-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari dokumen atau template…"
        />
        <span className="results-count">
          {docs.filter((d) => d.available).length} tersedia ·{" "}
          {docs.filter((d) => !d.available).length} menunggu berkas
        </span>
      </div>
      <div className="document-library">
        {docs.map((d) => (
          <article className="document-row" key={d.id}>
            <span
              className={`document-icon ${d.filename?.endsWith("xlsx") ? "excel" : ""}`}
            >
              {d.filename?.endsWith("xlsx") ? (
                <FileSpreadsheet size={22} />
              ) : (
                <FileText size={22} />
              )}
            </span>
            <div className="document-entry">
              <div className="document-entry-title">
                <h3>{d.title}</h3>
                <Badge
                  status={
                    d.is_demo ? "revision" : d.available ? "verified" : "draft"
                  }
                >
                  {d.is_demo
                    ? "Data contoh"
                    : d.available
                      ? "Tersedia"
                      : "Belum tersedia"}
                </Badge>
              </div>
              <p>{d.description}</p>
              <div className="document-meta">
                <span>
                  {d.category === "materi"
                    ? "Pedoman / referensi"
                    : d.category === "template"
                      ? "Template"
                      : "Data unit"}
                </span>
                <small>{d.version}</small>
              </div>
            </div>
            <div className="document-actions">
              {d.available ? (
                <a className="button" href={`/api/documents/${d.id}`} download>
                  <Download size={14} />
                  Unduh
                  {d.filename?.endsWith("xlsx")
                    ? " Excel"
                    : d.filename?.endsWith("pdf")
                      ? " PDF"
                      : ""}
                </a>
              ) : null}
              {data.user.role === "pam" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelected(d);
                    setVersion("");
                  }}
                >
                  <Upload size={14} />
                  {d.available ? "Ganti berkas" : "Sediakan berkas"}
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!docs.length && <Empty title="Dokumen tidak ditemukan" />}
      <div className="resource-note">
        <Info size={16} />
        <p>
          Ketentuan pengelolaan arsip mengikuti pedoman, TKI, JRDP, dan arahan
          fungsi berwenang. Data contoh unit bukan hasil tarikan I-BOS.
        </p>
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Kelola berkas referensi"
        description={selected?.title}
      >
        <div className="form-stack">
          <Field label="Label versi / tanggal dokumen">
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Contoh: Revisi 2 · 2026"
            />
          </Field>
          {selected && (
            <UploadBox
              ownerType="document"
              ownerId={selected.id}
              kind="document"
              documentVersion={version || "Unggahan terbaru"}
              label={
                selected.category === "materi"
                  ? "Pilih dokumen resmi (.pdf)"
                  : selected.category === "template"
                    ? "Pilih workbook template (.xlsx)"
                    : "Pilih data unit (.xlsx / .csv)"
              }
              accept={
                selected.category === "materi"
                  ? ".pdf"
                  : selected.category === "template"
                    ? ".xlsx"
                    : ".xlsx,.csv"
              }
              onDone={() => {
                refresh();
                setSelected(null);
              }}
            />
          )}
          <Notice>
            Unggahan mengganti berkas unduhan aktif dan dicatat pada jejak
            audit. Pastikan versi serta judul sesuai dokumen yang diberikan.
          </Notice>
        </div>
      </Modal>
    </>
  );
}
type Chat = {
  id: string;
  question: string;
  answer: string;
  sources: string;
  created_at: string;
};
const questions = [
  "Bagaimana alur pengajuan FUPA?",
  "Berkas apa yang perlu diunggah?",
  "Apakah memo dan tanda tangan dilakukan di website?",
  "Apakah arsip sudah boleh dimusnahkan?",
  "Bagaimana cara mengambil data I-BOS?",
  "Apa referensi pengelolaan aktif dan inaktif?",
];
export function Assistant({ data }: PageProps) {
  const chats = useQuery({
    queryKey: ["help", data.user.id],
    queryFn: () => api<Chat[]>("help"),
  });
  const client = useQueryClient();
  const [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chats.data?.length, busy]);
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const c = await api<Chat>("help", { question: q });
      client.setQueryData(["help", data.user.id], (old: Chat[] | undefined) => [
        ...(old || []),
        c,
      ]);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="assistant-page">
      <PageTitle
        title="Asisten arsip"
        description="Panduan langkah kerja dan akses cepat ke referensi."
        action={<Badge status="revision">Simulasi FAQ · tanpa AI</Badge>}
      />
      <div className="assistant-notice">
        <ShieldCheck size={16} />
        <span>
          Jawaban telah disiapkan dari brief alur kerja. Belum membaca isi PDF
          secara otomatis. Penafsiran ketentuan dikonsultasikan ke PIC/PAM.
        </span>
      </div>
      <div className="chat-scroll">
        {chats.isPending ? (
          <div className="chat-loading">
            <Loader2 className="spin" size={20} />
          </div>
        ) : chats.isError ? (
          <Empty
            title="Riwayat belum dapat dimuat"
            action={<Button onClick={() => chats.refetch()}>Coba lagi</Button>}
          />
        ) : !chats.data?.length ? (
          <div className="assistant-welcome">
            <span className="assistant-orb">
              <Sparkles size={28} />
            </span>
            <h2>Panduan pengelolaan arsip</h2>
            <p>
              Pilih pertanyaan tentang FUPA, berkas, atau dokumen referensi.
            </p>
            <div className="suggestion-grid">
              {questions.map((q) => (
                <button key={q} onClick={() => ask(q)}>
                  <span>{q}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {chats.data.map((c) => (
              <div key={c.id} className="chat-turn">
                <div className="chat-question">
                  <Avatar name={data.user.name} size="small" />
                  <div>
                    <strong>
                      Anda <time>{fmtTime(c.created_at)}</time>
                    </strong>
                    <p>{c.question}</p>
                  </div>
                </div>
                <div className="chat-answer">
                  <span className="assistant-avatar">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <strong>
                      Asisten arsip <small>FAQ DEMO</small>
                    </strong>
                    <p>{c.answer}</p>
                    <div className="chat-sources">
                      {(JSON.parse(c.sources) as string[]).map((id) => {
                        const d = data.documents.find((d) => d.id === id);
                        return d?.available ? (
                          <a key={id} href={`/api/documents/${id}`}>
                            <FileText size={13} />
                            {d.title}
                            <Download size={12} />
                          </a>
                        ) : (
                          <span key={id}>
                            {d?.title || id} · belum tersedia
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {busy && (
          <div className="assistant-thinking">
            <Loader2 size={15} className="spin" />
            Menyiapkan panduan…
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-compose">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <textarea
            aria-label="Pertanyaan untuk asisten"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Tanyakan alur FUPA, memo, atau kebutuhan berkas…"
            rows={2}
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(question);
              }
            }}
          />
          <button
            aria-label="Kirim pertanyaan"
            type="submit"
            disabled={busy || question.trim().length < 3}
          >
            <Send size={18} />
          </button>
        </form>
        <small>
          FAQ demonstrasi · Tidak menentukan retensi atau persetujuan musnah
        </small>
      </div>
    </div>
  );
}
export function Admin({ data, refresh }: PageProps) {
  const [tab, setTab] = useState("users"),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState<Role>("unit");
  const [required, setRequired] = useState(
    data.settings.region_upload_required,
  );
  const users = data.users.filter((u) =>
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
    ),
    units = data.units.filter((u) =>
      `${u.name} ${u.code}`.toLowerCase().includes(search.toLowerCase()),
    ),
    regions = data.regions.filter((r) =>
      `${r.name} ${r.code}`.toLowerCase().includes(search.toLowerCase()),
    ),
    events = data.events.filter((e) =>
      `${e.action} ${e.entity_id} ${e.actor_name} ${e.note}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const labels: Record<string, string> = {
    users: "Pengguna",
    units: "Unit SPBU",
    regions: "Regional",
    settings: "Pengaturan alur",
    audit: "Jejak audit",
  };
  return (
    <>
      <PageTitle
        title="Administrasi"
        description="Kelola akses pengguna, struktur unit, dan pengaturan alur kerja."
        action={
          ["users", "units", "regions"].includes(tab) && (
            <Button
              variant="primary"
              onClick={() => {
                setRole("unit");
                setCreate(true);
              }}
            >
              <Plus size={15} />
              Tambah{" "}
              {tab === "users"
                ? "pengguna"
                : tab === "units"
                  ? "unit"
                  : "regional"}
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSearch("");
        }}
        items={Object.entries(labels).map(([id, label]) => ({ id, label }))}
      />
      {tab !== "settings" && (
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Cari ${labels[tab].toLowerCase()}…`}
          />
          {tab === "audit" && (
            <Button
              onClick={() =>
                exportCsv("audit-workspace.csv", [
                  ["Waktu", "Aktor", "Entitas", "Tindakan", "Catatan"],
                  ...events.map((e) => [
                    e.created_at,
                    e.actor_name,
                    e.entity_id,
                    e.action,
                    e.note,
                  ]),
                ])
              }
            >
              <Download size={14} />
              Ekspor audit
            </Button>
          )}
        </div>
      )}
      {tab === "users" && (
        <div className="table-container">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Peran</th>
                  <th>Lingkup akses</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <Avatar name={u.name} />
                        <span>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{roleLabel[u.role]}</td>
                    <td className="text-sm">
                      {u.role === "pam"
                        ? "Semua region"
                        : u.role === "unit"
                          ? data.units.find((v) => v.id === u.unit_id)?.name
                          : data.regions.find((r) => r.id === u.region_id)
                              ?.code}
                    </td>
                    <td>
                      <Badge status={u.active ? "verified" : "draft"}>
                        {u.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td>
                      {u.id !== data.user.id && (
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await api("admin/users", {
                                action: "toggle",
                                id: u.id,
                              });
                              toast.success("Status akun diperbarui.");
                              refresh();
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          {u.active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!users.length && <Empty title="Pengguna tidak ditemukan" />}
        </div>
      )}
      {tab === "units" && (
        <div className="table-container">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode SPBU</th>
                  <th>Nama unit</th>
                  <th>Regional</th>
                  <th>Kota</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td>{u.code}</td>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td>
                      {data.regions.find((r) => r.id === u.region_id)?.code}
                    </td>
                    <td>{u.city}</td>
                    <td>
                      <Badge status="verified">Aktif</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "regions" && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama regional</th>
                <th>Unit terdaftar</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="region-mark">{r.code.slice(0, 2)}</span>
                    {r.code}
                  </td>
                  <td>{r.name}</td>
                  <td>
                    {data.units.filter((u) => u.region_id === r.id).length} SPBU
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "settings" && (
        <div className="settings-content">
          <div className="settings-section">
            <div>
              <h2>Aturan lampiran regional</h2>
              <p>
                Atur kewajiban unggah PDF FUPA regional sebelum nomor memo
                dicatat.
              </p>
            </div>
            <div>
              <Check
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              >
                Wajibkan lampiran PDF regional
              </Check>
              <p className="muted text-sm">
                Excel dan PDF bertanda tangan pada pengajuan unit selalu wajib.
                Pengaturan ini hanya memengaruhi lampiran regional.
              </p>
              <Button
                variant="primary"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("admin/settings", {
                      region_upload_required: required,
                    });
                    toast.success("Pengaturan disimpan.");
                    refresh();
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Simpan pengaturan
              </Button>
            </div>
          </div>
          <div className="settings-section">
            <div>
              <h2>Keputusan alur saat ini</h2>
              <p>Dasar versi lokal yang dapat dikembangkan kemudian.</p>
            </div>
            <div className="property-list">
              <div>
                <span>Penomoran FUPA</span>
                <strong>Per paket regional · manual PIC</strong>
              </div>
              <div>
                <span>Pengkajian</span>
                <strong>PAM / Document Control</strong>
              </div>
              <div>
                <span>Routing & memo</span>
                <strong>Dilakukan di luar website</strong>
              </div>
              <div>
                <span>I-BOS</span>
                <strong>Tanpa integrasi</strong>
              </div>
              <div>
                <span>Asisten</span>
                <strong>FAQ demonstrasi · tanpa model AI</strong>
              </div>
            </div>
          </div>
          <Notice>
            Perubahan menjadi FUPA per unit atau pemisahan peran PAM/DC
            memerlukan pembaruan aturan data dan izin. Keduanya dipusatkan pada
            lapisan layanan agar dapat dikembangkan.
          </Notice>
        </div>
      )}
      {tab === "audit" && (
        <div className="table-container">
          <div className="table-scroll">
            <table className="data-table audit-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aktor</th>
                  <th>Entitas</th>
                  <th>Aktivitas</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap muted">{fmtTime(e.created_at)}</td>
                    <td>{e.actor_name}</td>
                    <td>
                      <span className="record-id">{e.entity_id}</span>
                    </td>
                    <td>{e.action}</td>
                    <td className="muted">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-footnote">
            Menampilkan maksimal 300 aktivitas terbaru dalam workspace lokal.
          </div>
        </div>
      )}
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title={`Tambah ${labels[tab].toLowerCase()}`}
        wide
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            try {
              await api(
                `admin/${tab}`,
                tab === "users"
                  ? {
                      ...v,
                      role,
                      region_id: v.region_id || null,
                      unit_id: v.unit_id || null,
                    }
                  : v,
              );
              toast.success("Data berhasil ditambahkan.");
              refresh();
              setCreate(false);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {tab === "users" ? (
            <>
              <div className="form-grid">
                <Field label="Nama lengkap">
                  <input name="name" required minLength={3} />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" required />
                </Field>
              </div>
              <Field
                label="Kata sandi awal"
                hint="Minimal 12 karakter. Sampaikan melalui saluran internal yang aman."
              >
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Peran">
                <Select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {Object.entries(roleLabel).map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              {role === "unit" ? (
                <Field label="Unit SPBU">
                  <Select name="unit_id">
                    {data.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.code}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : role === "region" ? (
                <Field label="Regional">
                  <Select name="region_id">
                    {data.regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Notice>
                  Akun PAM dapat melihat seluruh region dan mengelola
                  administrasi workspace.
                </Notice>
              )}
            </>
          ) : tab === "units" ? (
            <>
              <Field label="Kode SPBU">
                <input name="code" required minLength={3} />
              </Field>
              <Field label="Nama unit">
                <input name="name" required minLength={3} />
              </Field>
              <div className="form-grid">
                <Field label="Kota">
                  <input name="city" required minLength={3} />
                </Field>
                <Field label="Regional">
                  <Select name="region_id">
                    {data.regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Kode regional">
                <input name="code" required minLength={2} maxLength={25} />
              </Field>
              <Field label="Nama regional">
                <input name="name" required minLength={3} />
              </Field>
            </>
          )}
          <div className="form-actions">
            <Button type="button" onClick={() => setCreate(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={busy}>
              Simpan{" "}
              {tab === "users"
                ? "pengguna"
                : tab === "units"
                  ? "unit"
                  : "regional"}
            </Button>
          </div>
        </form>
      </Modal>
      <div className="resource-note">
        <LockKeyhole size={16} />
        <p>
          Akses diperiksa di server untuk setiap permintaan. Menonaktifkan
          pengguna juga mengakhiri seluruh sesi aktifnya.
        </p>
      </div>
    </>
  );
}
