"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  Plus,
  Download,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Camera,
  Send,
  MessageSquare,
  History,
  ExternalLink,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { Submission, StoredFile, Event } from "@/lib/types";
import { unitStatuses, batchStatuses } from "@/lib/types";
import type { PageProps } from "./workspace";
import {
  api,
  Button,
  Badge,
  PageTitle,
  Modal,
  Drawer,
  Field,
  Select,
  Check,
  Notice,
  Empty,
  SearchInput,
  Tabs,
  UploadBox,
  FileLink,
  fmtDate,
  fmtTime,
  Avatar,
  exportCsv,
  cx,
} from "./ui";
const formSchema = z
  .object({
    unit_id: z.string(),
    period: z.string().min(3, "Isi periode pengajuan."),
    year_from: z.number().int().min(1900).max(2100),
    year_to: z.number().int().min(1900).max(2100),
    description: z.string().min(3, "Isi uraian arsip."),
    boxes: z.number().int().min(0).max(100000),
    physical_sorted: z.boolean(),
    photographed: z.boolean(),
    signature_confirmed: z.boolean(),
  })
  .refine((v) => v.year_from <= v.year_to, {
    message: "Tahun akhir harus sama atau setelah tahun awal.",
    path: ["year_to"],
  });
type FormValues = z.infer<typeof formSchema>;
export function SubmissionForm({
  data,
  refresh,
  onClose,
  initial,
  onCreated,
}: PageProps & {
  onClose: () => void;
  initial?: Submission;
  onCreated?: (id: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial
      ? {
          ...initial,
          physical_sorted: !!initial.physical_sorted,
          photographed: !!initial.photographed,
          signature_confirmed: !!initial.signature_confirmed,
        }
      : {
          unit_id: data.user.unit_id || "",
          period: "Semester II 2026",
          year_from: 2020,
          year_to: 2022,
          description: "",
          boxes: 0,
          physical_sorted: false,
          photographed: false,
          signature_confirmed: false,
        },
  });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          const result = await api<{ id: string }>(
            `submissions${initial ? `/${initial.id}` : ""}`,
            { ...v, action: "save", version: initial?.version },
          );
          toast.success(
            initial ? "Perubahan tersimpan." : "Draft pengajuan dibuat.",
          );
          refresh();
          onClose();
          onCreated?.(result.id);
        } catch (e) {
          toast.error((e as Error).message);
        }
      })}
      className="form-stack"
    >
      <div className="form-grid">
        <Field label="Unit SPBU">
          <Select {...register("unit_id")} aria-readonly="true">
            <option value={data.user.unit_id || initial?.unit_id}>
              {
                data.units.find(
                  (u) => u.id === (initial?.unit_id || data.user.unit_id),
                )?.name
              }
            </option>
          </Select>
        </Field>
        <Field label="Periode pengajuan" error={errors.period?.message}>
          <input {...register("period")} placeholder="Semester II 2026" />
        </Field>
        <Field label="Tahun arsip · awal" error={errors.year_from?.message}>
          <input
            type="number"
            {...register("year_from", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Tahun arsip · akhir" error={errors.year_to?.message}>
          <input
            type="number"
            {...register("year_to", { valueAsNumber: true })}
          />
        </Field>
      </div>
      <Field label="Uraian arsip" error={errors.description?.message}>
        <textarea
          rows={3}
          {...register("description")}
          placeholder="Contoh: dokumen penjualan dan administrasi operasional"
        />
      </Field>
      <Field label="Jumlah box diusulkan" error={errors.boxes?.message}>
        <input
          type="number"
          {...register("boxes", { valueAsNumber: true })}
          min={0}
        />
      </Field>
      <div className="form-section">
        <h3>Checklist persiapan unit</h3>
        <p className="muted text-sm">
          Konfirmasi sesuai kondisi sebenarnya. Excel dan PDF diunggah setelah
          draft tersimpan.
        </p>
        <Check {...register("physical_sorted")}>
          Arsip yang diusulkan sudah dipisahkan secara fisik.
        </Check>
        <Check {...register("photographed")}>
          Kondisi arsip sudah difoto dan dokumentasinya disimpan.
        </Check>
        <Check {...register("signature_confirmed")}>
          PDF daftar arsip sudah ditandatangani ABH dan PIC Region.
        </Check>
      </div>
      <Notice>
        Retensi dan kelayakan musnah diperiksa berdasarkan JRDP dan ketentuan
        resmi. Web tidak memutuskan kelayakan secara otomatis.
      </Notice>
      <div className="form-actions">
        <Button type="button" onClick={onClose}>
          Batal
        </Button>
        <Button variant="primary" loading={isSubmitting} type="submit">
          {initial ? "Simpan perubahan" : "Buat draft & lanjut unggah"}
        </Button>
      </div>
    </form>
  );
}
const col = createColumnHelper<Submission>();
export function Submissions({ data, refresh }: PageProps) {
  const params = useSearchParams(),
    router = useRouter();
  const status = params.get("status") || "all";
  const [search, setSearch] = useState(""),
    [region, setRegion] = useState("all"),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [sorting, setSorting] = useState<SortingState>([
      { id: "updated_at", desc: true },
    ]);
  const [pageSize, setPageSize] = useState(10);
  const records = useMemo(
    () =>
      data.submissions.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          (region === "all" ||
            data.units.find((u) => u.id === s.unit_id)?.region_id === region) &&
          `${s.id} ${s.description} ${data.units.find((u) => u.id === s.unit_id)?.name} ${data.units.find((u) => u.id === s.unit_id)?.code}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data.submissions, data.units, status, region, search],
  );
  const columns = [
    col.accessor("id", {
      header: "Pengajuan / unit",
      cell: (ctx) => {
        const s = ctx.row.original,
          u = data.units.find((u) => u.id === s.unit_id);
        return (
          <button className="table-main-link" onClick={() => setSelected(s.id)}>
            <span className="record-icon">
              <FileText size={16} />
            </span>
            <span>
              <strong>{u?.name}</strong>
              <small>
                {s.id} · {u?.code}
              </small>
            </span>
          </button>
        );
      },
    }),
    col.accessor("period", {
      header: "Periode",
      cell: (c) => <span className="nowrap">{c.getValue()}</span>,
    }),
    col.accessor("boxes", {
      header: "Box",
      cell: (c) => <span className="number-cell">{c.getValue()}</span>,
    }),
    col.accessor("status", {
      header: "Status",
      cell: (c) => (
        <Badge status={c.getValue()}>{unitStatuses[c.getValue()]}</Badge>
      ),
    }),
    col.display({
      id: "files",
      header: "Berkas",
      cell: (ctx) => (
        <div className="file-indicators">
          {(["excel", "pdf"] as const).map((k) => (
            <span
              key={k}
              title={
                data.files.some(
                  (f) => f.owner_id === ctx.row.original.id && f.kind === k,
                )
                  ? `${k.toUpperCase()} tersedia`
                  : `${k.toUpperCase()} belum tersedia`
              }
              className={
                data.files.some(
                  (f) => f.owner_id === ctx.row.original.id && f.kind === k,
                )
                  ? "available"
                  : ""
              }
            >
              {k === "excel" ? (
                <FileSpreadsheet size={15} />
              ) : (
                <FileText size={15} />
              )}
            </span>
          ))}
        </div>
      ),
    }),
    col.accessor("updated_at", {
      header: "Diperbarui",
      cell: (c) => (
        <span className="muted nowrap">{fmtDate(c.getValue())}</span>
      ),
    }),
    col.display({
      id: "open",
      header: "",
      cell: (ctx) => (
        <button
          className="icon-button"
          onClick={() => setSelected(ctx.row.original.id)}
          aria-label={`Detail ${ctx.row.original.id}`}
        >
          <ChevronRight size={15} />
        </button>
      ),
    }),
  ];
  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  return (
    <>
      <PageTitle
        title="Pengajuan unit"
        description="Daftar arsip yang diusulkan musnah oleh masing-masing SPBU."
        action={
          <>
            <Button
              onClick={() =>
                exportCsv("pengajuan-unit.csv", [
                  [
                    "ID",
                    "Unit",
                    "Periode",
                    "Tahun awal",
                    "Tahun akhir",
                    "Box",
                    "Status",
                  ],
                  ...records.map((s) => [
                    s.id,
                    data.units.find((u) => u.id === s.unit_id)?.name || "",
                    s.period,
                    s.year_from,
                    s.year_to,
                    s.boxes,
                    unitStatuses[s.status],
                  ]),
                ])
              }
            >
              <Download size={14} />
              Ekspor CSV
            </Button>
            {data.user.role === "unit" && (
              <Button variant="primary" onClick={() => setCreate(true)}>
                <Plus size={15} />
                Pengajuan baru
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={status}
        onChange={(s) =>
          router.replace(
            `/workspace/pengajuan${s === "all" ? "" : `?status=${s}`}`,
            { scroll: false },
          )
        }
        items={[
          {
            id: "all",
            label: "Semua pengajuan",
            count: data.submissions.length,
          },
          ...Object.entries(unitStatuses).map(([id, label]) => ({
            id,
            label,
            count: data.submissions.filter((s) => s.status === id).length,
          })),
        ]}
      />
      <div className="table-toolbar">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            table.setPageIndex(0);
          }}
          placeholder="Cari unit, ID, atau uraian arsip…"
        />
        <div className="flex gap-2">
          <Select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              table.setPageIndex(0);
            }}
            aria-label="Filter regional"
          >
            <option value="all">Semua regional</option>
            {data.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </Select>
          <span className="results-count">{records.length} pengajuan</span>
        </div>
      </div>
      <div className="table-container">
        <div className="table-scroll">
          <table className="data-table submission-table">
            <thead>
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((h) => (
                    <th key={h.id}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          <ArrowUpDown size={11} />
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((r) => (
                <tr key={r.id}>
                  {r.getVisibleCells().map((c) => (
                    <td key={c.id}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!records.length && (
          <Empty
            title="Tidak ada pengajuan"
            description="Ubah filter pencarian atau buat pengajuan unit baru."
          />
        )}
        <div className="pagination">
          <span>
            {records.length
              ? table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                1
              : 0}
            –
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              records.length,
            )}{" "}
            dari {records.length} pengajuan
          </span>
          <div>
            <Select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                setPageSize(+e.target.value);
                table.setPageSize(+e.target.value);
              }}
              aria-label="Jumlah baris per halaman"
            >
              <option value={10}>10 per halaman</option>
              <option value={25}>25 per halaman</option>
              <option value={50}>50 per halaman</option>
            </Select>
            <Button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={15} />
            </Button>
            <Button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </div>
      <div className="list-help">
        <span className="status-dot submitted" />
        Berkas tersedia belum berarti diverifikasi. PDF harus bertanda tangan
        ABH dan PIC Region sebelum dikirim.
      </div>
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="Buat pengajuan unit"
        description="Simpan draft terlebih dahulu, lalu unggah Excel dan PDF daftar arsip."
        wide
      >
        <SubmissionForm
          data={data}
          refresh={refresh}
          onClose={() => setCreate(false)}
          onCreated={(id) => setSelected(id)}
        />
      </Modal>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detail pengajuan"
        fullHref={selected ? `/workspace/pengajuan/${selected}` : undefined}
      >
        {selected && (
          <SubmissionDetail
            data={data}
            refresh={refresh}
            id={selected}
            drawer
          />
        )}
      </Drawer>
    </>
  );
}
export function Timeline({ events }: { events: Event[] }) {
  return (
    <div className="timeline">
      {events.length ? (
        events.map((e) => (
          <div key={e.id} className="timeline-item">
            <Avatar name={e.actor_name} size="small" />
            <div>
              <div>
                <strong>{e.action}</strong>
                <time>{fmtTime(e.created_at)}</time>
              </div>
              <span>{e.actor_name}</span>
              {e.note && <p>{e.note}</p>}
            </div>
          </div>
        ))
      ) : (
        <Empty title="Belum ada aktivitas" />
      )}
    </div>
  );
}
export function SubmissionDetail({
  data,
  refresh,
  id,
  drawer = false,
}: PageProps & { id: string; drawer?: boolean }) {
  const s = data.submissions.find((s) => s.id === id);
  const [tab, setTab] = useState("overview"),
    [edit, setEdit] = useState(false),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState<"verify" | "revision" | "submit" | null>(
      null,
    );
  if (!s)
    return (
      <Empty
        title="Pengajuan belum tersedia"
        description="Data sedang diperbarui atau di luar akses Anda."
      />
    );
  const unit = data.units.find((u) => u.id === s.unit_id),
    region = data.regions.find((r) => r.id === unit?.region_id),
    editable =
      data.user.role === "unit" && ["draft", "revision"].includes(s.status),
    files = data.files.filter(
      (f) => f.owner_type === "submission" && f.owner_id === id,
    ),
    batch = data.batches.find((b) =>
      data.memberships.some(
        (m) => m.batch_id === b.id && m.submission_id === id,
      ),
    ),
    latest = (kind: string) => files.find((f) => f.kind === kind),
    events = data.events.filter(
      (e) => e.entity_type === "submission" && e.entity_id === id,
    );
  const mutate = async (
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    setBusy(true);
    try {
      await api(`submissions/${id}`, { action, version: s.version, ...extra });
      toast.success("Pengajuan diperbarui.");
      refresh();
      setReview(null);
      setNote("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const checks = [
    {
      label: "Data I-BOS disusun menjadi daftar arsip",
      done: s.boxes > 0 && !!s.description,
    },
    {
      label: "Arsip dipisahkan & kondisi difoto",
      done: !!s.physical_sorted && !!s.photographed,
    },
    { label: "Excel daftar arsip tersedia", done: !!latest("excel") },
    {
      label: "PDF bertanda tangan ABH & PIC tersedia",
      done: !!latest("pdf") && !!s.signature_confirmed,
    },
  ];
  return (
    <div className={cx("detail-content", drawer && "in-drawer")}>
      {!drawer && (
        <Link className="back-link" href="/workspace/pengajuan">
          <ArrowLeft size={14} />
          Semua pengajuan
        </Link>
      )}
      <div className="detail-title">
        <span className="record-id">
          {s.id} <small>v{s.version}</small>
        </span>
        <h1>{unit?.name}</h1>
        <p>{s.description}</p>
        <div className="detail-status">
          <Badge status={s.status}>{unitStatuses[s.status]}</Badge>
          <span>{s.period}</span>
          {editable && (
            <Button variant="ghost" onClick={() => setEdit(true)}>
              <Pencil size={13} />
              Ubah data
            </Button>
          )}
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "overview", label: "Ringkasan" },
          { id: "files", label: "Berkas", count: files.length },
          { id: "activity", label: "Aktivitas", count: events.length },
        ]}
      />
      {s.status === "revision" && (
        <Notice tone="warning">
          Pengajuan perlu diperbaiki. Baca catatan aktivitas, perbarui data dan
          berkas, lalu kirim kembali.
        </Notice>
      )}
      {tab === "overview" && (
        <>
          <div className="property-list">
            <div>
              <span>Unit / kode SPBU</span>
              <strong>
                {unit?.code} · {unit?.city}
              </strong>
            </div>
            <div>
              <span>Regional</span>
              <strong>{region?.code}</strong>
            </div>
            <div>
              <span>Tahun arsip</span>
              <strong>
                {s.year_from} – {s.year_to}
              </strong>
            </div>
            <div>
              <span>Jumlah box</span>
              <strong>{s.boxes} box</strong>
            </div>
            <div>
              <span>Terakhir diperbarui</span>
              <strong>{fmtTime(s.updated_at)}</strong>
            </div>
            <div>
              <span>Paket FUPA</span>
              {batch ? (
                <Link
                  className="text-link"
                  href={`/workspace/regional/${batch.id}`}
                >
                  {batch.number}
                  <ExternalLink size={12} />
                </Link>
              ) : (
                <span>Belum masuk paket regional</span>
              )}
            </div>
            {batch && (
              <>
                <div>
                  <span>Status regional</span>
                  <Badge status={batch.status}>
                    {batchStatuses[batch.status]}
                  </Badge>
                </div>
                <div>
                  <span>Nomor memo</span>
                  <strong>{batch.memo_number || "Belum dicatat"}</strong>
                </div>
              </>
            )}
          </div>
          <section className="detail-section">
            <h3>
              Persiapan pengajuan{" "}
              <span>{checks.filter((c) => c.done).length}/4</span>
            </h3>
            <div className="step-checklist">
              {checks.map((c, i) => (
                <div key={c.label} className={c.done ? "done" : ""}>
                  <span>{c.done ? <CheckCircle2 size={17} /> : i + 1}</span>
                  <div>
                    <strong>{c.label}</strong>
                    {i === 3 && (
                      <small>
                        Konfirmasi administratif; bukan validasi digital tanda
                        tangan.
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <div className="section-title">
              <h3>Berkas utama</h3>
              <button onClick={() => setTab("files")} className="text-link">
                Lihat semua
                <ChevronRight size={13} />
              </button>
            </div>
            {latest("excel") ? (
              <FileLink {...latest("excel")!} />
            ) : (
              <div className="missing-file">
                <FileSpreadsheet size={17} />
                Excel belum diunggah
              </div>
            )}
            {latest("pdf") ? (
              <FileLink {...latest("pdf")!} />
            ) : (
              <div className="missing-file">
                <FileText size={17} />
                PDF belum diunggah
              </div>
            )}
          </section>
          {editable && (
            <div className="detail-actions">
              <Button onClick={() => setTab("files")}>Kelola berkas</Button>
              <Button
                variant="primary"
                onClick={() => setReview("submit")}
                disabled={!checks.every((c) => c.done)}
              >
                <Send size={14} />
                Kirim ke PIC Region
              </Button>
            </div>
          )}
          {data.user.role === "region" && s.status === "submitted" && (
            <div className="detail-actions">
              <Button onClick={() => setReview("revision")}>
                <RotateCcw size={14} />
                Minta revisi
              </Button>
              <Button variant="primary" onClick={() => setReview("verify")}>
                <CheckCircle2 size={14} />
                Verifikasi berkas
              </Button>
            </div>
          )}
          <div className="detail-note">
            Proses tanda tangan, pengecekan retensi, dan pemisahan fisik
            mengikuti dokumen resmi di luar website.
          </div>
        </>
      )}
      {tab === "files" && (
        <section className="detail-section">
          <h3>Excel & PDF daftar arsip</h3>
          <p className="muted text-sm">
            Versi sebelumnya tetap tersimpan dalam riwayat berkas.
          </p>
          {(["excel", "pdf"] as const).map((kind) => (
            <div className="file-group" key={kind}>
              <h4>
                {kind === "excel"
                  ? "Excel daftar arsip"
                  : "PDF bertanda tangan ABH & PIC"}
              </h4>
              {files
                .filter((f) => f.kind === kind)
                .map((f) => (
                  <FileLink key={f.id} {...f} />
                ))}
              {editable && (
                <UploadBox
                  ownerType="submission"
                  ownerId={id}
                  kind={kind}
                  version={s.version}
                  label={`Unggah ${kind === "excel" ? "Excel (.xlsx)" : "PDF bertanda tangan"}`}
                  accept={kind === "excel" ? ".xlsx" : ".pdf"}
                  onDone={refresh}
                />
              )}
            </div>
          ))}
          <h3>Dokumentasi kondisi · opsional</h3>
          {files
            .filter((f) => f.kind === "photo")
            .map((f) => (
              <FileLink key={f.id} {...f} />
            ))}
          {editable && (
            <UploadBox
              ownerType="submission"
              ownerId={id}
              kind="photo"
              version={s.version}
              label="Tambahkan foto kondisi arsip"
              accept=".jpg,.jpeg,.png"
              onDone={refresh}
            />
          )}
          <Notice>
            Foto kondisi wajib dibuat sebagai langkah persiapan. Mengunggah
            fotonya ke website bersifat opsional.
          </Notice>
        </section>
      )}
      {tab === "activity" && (
        <section className="detail-section">
          <Timeline events={events} />
          <form
            className="comment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              await mutate("comment", { note });
            }}
          >
            <Field label="Tambahkan catatan">
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan yang dapat dibaca unit, PIC, dan PAM…"
                required
              />
            </Field>
            <Button type="submit" loading={busy} disabled={!note.trim()}>
              <MessageSquare size={14} />
              Kirim catatan
            </Button>
          </form>
        </section>
      )}
      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Ubah pengajuan unit"
        wide
      >
        <SubmissionForm
          data={data}
          refresh={refresh}
          initial={s}
          onClose={() => setEdit(false)}
        />
      </Modal>
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={
          review === "submit"
            ? "Kirim pengajuan ke PIC Region"
            : review === "verify"
              ? "Verifikasi berkas unit"
              : "Minta perbaikan pengajuan"
        }
      >
        <div className="form-stack">
          <Notice>
            {review === "submit"
              ? "Pastikan Excel dan PDF yang diunggah sesuai daftar arsip yang telah ditandatangani. Setelah dikirim, data terkunci sampai ada permintaan revisi."
              : review === "verify"
                ? "Verifikasi berarti berkas telah direview PIC, bukan persetujuan pemusnahan. Pastikan kesesuaian daftar, tanda tangan, dan retensi sudah diperiksa."
                : "Jelaskan koreksi yang diperlukan agar Admin Unit dapat memperbaiki dan mengirim kembali."}
          </Notice>
          {review !== "submit" && (
            <Field
              label={
                review === "revision"
                  ? "Catatan revisi · wajib"
                  : "Catatan review · opsional"
              }
            >
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          )}
          <div className="form-actions">
            <Button onClick={() => setReview(null)}>Batal</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={review === "revision" && note.trim().length < 3}
              onClick={() => review && mutate(review, { note })}
            >
              {review === "submit"
                ? "Kirim pengajuan"
                : review === "verify"
                  ? "Tandai terverifikasi"
                  : "Kirim permintaan revisi"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
