"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Download,
  FileText,
  Layers,
  CheckCircle2,
  Info,
} from "lucide-react";
import type { PageProps } from "./workspace";
import {
  Button,
  Badge,
  fmtDate,
  fmtTime,
  exportCsv,
  Select,
  Empty,
  Avatar,
} from "./ui";
import { unitStatuses, batchStatuses } from "@/lib/types";

export function Dashboard({ data: workspace }: PageProps) {
  const [period, setPeriod] = useState("all");
  const [queueView, setQueueView] = useState("pending");
  const data = {
    ...workspace,
    submissions: workspace.submissions.filter(
      (s) => period === "all" || s.period === period,
    ),
    batches: workspace.batches.filter(
      (b) => period === "all" || b.period === period,
    ),
  };
  const hasFile = (sid: string, kind: string) =>
    data.files.some(
      (f) =>
        f.owner_type === "submission" && f.owner_id === sid && f.kind === kind,
    );
  const uploaded = new Set(
    data.submissions
      .filter((s) => hasFile(s.id, "excel") && hasFile(s.id, "pdf"))
      .map((s) => s.unit_id),
  );
  const memoBatches = data.batches.filter((b) =>
    ["memo", "review", "reviewed"].includes(b.status),
  );
  const memoIds = new Set(
    data.memberships
      .filter((m) => memoBatches.some((b) => b.id === m.batch_id))
      .map((m) => m.submission_id),
  );
  const reviewedIds = new Set(
    data.memberships
      .filter((m) =>
        data.batches.some(
          (b) => b.id === m.batch_id && b.status === "reviewed",
        ),
      )
      .map((m) => m.submission_id),
  );
  const memoUnits = new Set(
    data.submissions.filter((s) => memoIds.has(s.id)).map((s) => s.unit_id),
  );
  const reviewedUnits = new Set(
    data.submissions.filter((s) => reviewedIds.has(s.id)).map((s) => s.unit_id),
  );
  const total = data.units.length;
  const periods = Array.from(
    new Set(
      [...workspace.submissions, ...workspace.batches].map(
        (record) => record.period,
      ),
    ),
  )
    .sort()
    .reverse();
  const metrics = [
    { label: "Unit terpantau", value: total, note: "SPBU dalam akses Anda" },
    {
      label: "Excel & PDF tersedia",
      value: uploaded.size,
      note: `Dari ${total} SPBU terpantau`,
    },
    {
      label: "Tercakup memo",
      value: memoUnits.size,
      note: `Dalam ${memoBatches.length} paket regional`,
    },
    {
      label: "Selesai dikaji PAM",
      value: reviewedUnits.size,
      note: "SPBU dalam paket selesai dikaji",
    },
  ];
  const submissionTasks =
    data.user.role === "pam"
      ? []
      : data.submissions.map((s) => {
          const unit = data.units.find((u) => u.id === s.unit_id);
          const pending =
            data.user.role === "unit"
              ? ["draft", "revision"].includes(s.status)
              : s.status === "submitted";
          return {
            id: s.id,
            title: unit?.name || s.id,
            subtitle: s.id,
            status: s.status,
            label: unitStatuses[s.status],
            updated: s.updated_at,
            quantity: `${s.boxes} box`,
            url: `/workspace/pengajuan/${s.id}`,
            action: data.user.role === "unit" ? "Lengkapi" : "Review berkas",
            pending,
            kind: "submission",
          };
        });
  const batchTasks =
    data.user.role === "unit"
      ? []
      : data.batches.map((b) => ({
          id: b.id,
          title: b.number,
          subtitle:
            data.regions
              .find((r) => r.id === b.region_id)
              ?.name.replace("Regional ", "") || "Regional",
          status: b.status,
          label: batchStatuses[b.status],
          updated: b.updated_at,
          quantity: `${
            new Set(
              data.memberships
                .filter((m) => m.batch_id === b.id)
                .map(
                  (m) =>
                    data.submissions.find((s) => s.id === m.submission_id)
                      ?.unit_id,
                )
                .filter(Boolean),
            ).size
          } SPBU`,
          url: `/workspace/regional/${b.id}`,
          action: data.user.role === "pam" ? "Tinjau paket" : "Lanjutkan",
          pending:
            data.user.role === "pam"
              ? ["memo", "review"].includes(b.status)
              : ["draft", "routing", "revision"].includes(b.status),
          kind: "batch",
        }));
  const tasks = [...submissionTasks, ...batchTasks].sort(
    (a, b) =>
      Number(b.pending) - Number(a.pending) ||
      b.updated.localeCompare(a.updated),
  );
  const pending = tasks.filter((t) => t.pending);
  const shown = (queueView === "pending" ? pending : tasks).slice(0, 5);
  const latestCap = data.units
    .map((u) => data.capacities.find((c) => c.unit_id === u.id))
    .filter((c) => !!c);
  const capacity = latestCap.reduce((sum, c) => sum + c.total, 0),
    used = latestCap.reduce((sum, c) => sum + c.used, 0);
  const queueUrl =
    data.user.role === "pam" ? "/workspace/regional" : "/workspace/pengajuan";
  const queueTitle =
    data.user.role === "pam"
      ? "Pengkajian regional"
      : data.user.role === "region"
        ? "Pekerjaan regional"
        : "Pengajuan Anda";
  const eventUrl = (type: string, id: string) =>
    type === "submission"
      ? `/workspace/pengajuan/${id}`
      : type === "batch"
        ? `/workspace/regional/${id}`
        : type === "issue"
          ? "/workspace/kendala"
          : type === "document"
            ? "/workspace/dokumen"
            : "/workspace/monitoring";
  return (
    <div className="overview-page">
      <div className="overview-navigation">
        <nav aria-label="Tampilan ringkasan" className="segmented-nav">
          <Link className="selected" href="/workspace" aria-current="page">
            Ringkasan
          </Link>
          <Link href="/workspace/pengajuan">Pengajuan unit</Link>
          <Link href="/workspace/regional">Regional</Link>
        </nav>
        <div className="overview-filters">
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Periode ringkasan"
          >
            <option value="all">Semua periode</option>
            {periods.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Button
            onClick={() =>
              exportCsv("ringkasan-arsip.csv", [
                ["Indikator", "SPBU"],
                ...metrics.map((m) => [m.label, m.value]),
              ])
            }
          >
            <Download size={15} />
            Ekspor
          </Button>
        </div>
      </div>
      <div className="overview-heading">
        <h1>Ringkasan arsip</h1>
        <span className="overview-scope">
          {data.user.role === "pam"
            ? "Seluruh regional"
            : data.user.role === "region"
              ? data.regions[0]?.name
              : data.units.find((u) => u.id === data.user.unit_id)?.name}
        </span>
      </div>
      <div className="overview-metrics">
        {metrics.map((m) => (
          <div key={m.label}>
            <span>{m.label}</span>
            <strong>
              {m.value}
              <small>SPBU</small>
            </strong>
            <p>{m.note}</p>
          </div>
        ))}
      </div>
      <section className="work-queue">
        <div className="overview-section-title">
          <h2>{queueTitle}</h2>
          <Link href={queueUrl}>
            Lihat semua
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="queue-tabs" aria-label="Filter pekerjaan">
          <button
            onClick={() => setQueueView("pending")}
            aria-pressed={queueView === "pending"}
            className={queueView === "pending" ? "active" : ""}
          >
            Perlu tindakan<span>{pending.length}</span>
          </button>
          <button
            onClick={() => setQueueView("all")}
            aria-pressed={queueView === "all"}
            className={queueView === "all" ? "active" : ""}
          >
            Semua<span>{tasks.length}</span>
          </button>
          <span className="queue-role">Sesuai peran Anda</span>
        </div>
        <div className="table-scroll">
          <table className="data-table queue-table">
            <thead>
              <tr>
                <th>
                  {data.user.role === "pam"
                    ? "Paket FUPA"
                    : "Pengajuan / paket"}
                </th>
                <th>Status</th>
                <th>{data.user.role === "pam" ? "Unit terlampir" : "Arsip"}</th>
                <th>Diperbarui</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="table-main-link" href={t.url}>
                      <span className="record-icon">
                        {t.kind === "batch" ? (
                          <Layers size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </span>
                      <span>
                        <strong>{t.title}</strong>
                        <small>{t.subtitle}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Badge status={t.status}>{t.label}</Badge>
                  </td>
                  <td className="nowrap">{t.quantity}</td>
                  <td className="nowrap muted">{fmtDate(t.updated)}</td>
                  <td>
                    <Link href={t.url} className="queue-action">
                      {t.pending ? t.action : "Buka"}
                      <ArrowRight size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shown.length && (
          <Empty
            title="Tidak ada pekerjaan yang menunggu Anda"
            description="Anda tetap dapat melihat seluruh pengajuan melalui tab Semua."
          />
        )}
        {(queueView === "pending" ? pending : tasks).length > 5 && (
          <Link className="queue-more" href={queueUrl}>
            Lihat seluruh daftar
            <ArrowRight size={14} />
          </Link>
        )}
      </section>
      <div className="overview-lower">
        <section className="regional-summary">
          <div className="overview-section-title">
            <h2>Progres regional</h2>
            <span
              className="info-label"
              title="SPBU unik. Memo dan kajian dihitung hanya dari anggota paket yang terkait."
            >
              <Info size={15} />
            </span>
          </div>
          <div className="table-scroll">
            <table className="data-table overview-region-table">
              <thead>
                <tr>
                  <th>Regional</th>
                  <th>SPBU</th>
                  <th>Excel + PDF</th>
                  <th>Ber-memo</th>
                  <th>Dikaji PAM</th>
                </tr>
              </thead>
              <tbody>
                {data.regions.map((r) => {
                  const units = data.units.filter((u) => u.region_id === r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link
                          href="/workspace/regional"
                          className="region-name"
                        >
                          <span className="region-mark">
                            {r.code.slice(0, 2)}
                          </span>
                          <span>
                            <strong>{r.code}</strong>
                            <small>{r.name.replace("Regional ", "")}</small>
                          </span>
                        </Link>
                      </td>
                      <td>{units.length}</td>
                      <td>
                        {units.filter((u) => uploaded.has(u.id)).length}
                        <span className="denominator"> / {units.length}</span>
                      </td>
                      <td>{units.filter((u) => memoUnits.has(u.id)).length}</td>
                      <td>
                        {units.filter((u) => reviewedUnits.has(u.id)).length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="table-caption">
            Berkas tersedia belum berarti terverifikasi oleh PIC Region.
          </p>
        </section>
        <aside className="overview-insights">
          <section>
            <div className="overview-section-title">
              <h2>Tahapan FUPA</h2>
              <Link
                href="/workspace/regional"
                aria-label="Lihat tahapan FUPA regional"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="process-summary">
              {[
                {
                  name: "Berkas unit tersedia",
                  value: uploaded.size,
                  icon: FileText,
                },
                {
                  name: "Memo regional tercatat",
                  value: memoUnits.size,
                  icon: Layers,
                },
                {
                  name: "Pengkajian PAM selesai",
                  value: reviewedUnits.size,
                  icon: CheckCircle2,
                },
              ].map((s) => (
                <div key={s.name}>
                  <s.icon size={16} />
                  <span>{s.name}</span>
                  <strong>
                    {s.value}
                    <small> / {total}</small>
                  </strong>
                </div>
              ))}
            </div>
          </section>
          <section className="storage-summary">
            <div className="overview-section-title">
              <h2>Penyimpanan arsip</h2>
              <Link
                href="/workspace/monitoring"
                aria-label="Buka monitoring penyimpanan"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="storage-reading">
              <strong>
                {used.toLocaleString("id-ID")}
                <span> / {capacity.toLocaleString("id-ID")} box</span>
              </strong>
              <span>{capacity ? Math.round((used / capacity) * 100) : 0}%</span>
            </div>
            <div className="storage-track">
              <i
                style={{ width: `${capacity ? (used / capacity) * 100 : 0}%` }}
              />
            </div>
            <p>
              {latestCap.filter((c) => c.condition !== "Baik").length} unit
              perlu perhatian
              <Link href="/workspace/monitoring">
                Lihat kondisi
                <ChevronRight size={13} />
              </Link>
            </p>
          </section>
        </aside>
      </div>
      <section className="recent-activity">
        <div className="overview-section-title">
          <h2>Aktivitas terbaru</h2>
          <span className="activity-count">
            {data.events.length} aktivitas tercatat
          </span>
        </div>
        <div>
          {data.events.slice(0, 3).map((e) => (
            <Link key={e.id} href={eventUrl(e.entity_type, e.entity_id)}>
              <Avatar name={e.actor_name} size="small" />
              <span>
                <strong>{e.action}</strong>
                <small>
                  {e.actor_name} · {e.entity_id}
                </small>
              </span>
              <time>{fmtTime(e.created_at)}</time>
              <ChevronRight size={14} />
            </Link>
          ))}
        </div>
      </section>
      <p className="overview-disclaimer">
        Data demonstrasi. Selesai dikaji PAM bukan izin pemusnahan fisik.
      </p>
    </div>
  );
}
