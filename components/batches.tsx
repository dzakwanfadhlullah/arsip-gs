"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Layers,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Download,
  CheckCircle2,
  Send,
  RotateCcw,
  ClipboardCheck,
  FileText,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { batchStatuses, unitStatuses } from "@/lib/types";
import type { PageProps } from "./workspace";
import {
  api,
  Button,
  Badge,
  PageTitle,
  Modal,
  Drawer,
  Field,
  Check,
  Notice,
  Empty,
  SearchInput,
  Select,
  Tabs,
  UploadBox,
  FileLink,
  fmtDate,
  fmtTime,
  exportCsv,
  cx,
} from "./ui";
import { Timeline } from "./submissions";
function CreateBatch({
  data,
  refresh,
  onClose,
  onCreated,
}: PageProps & { onClose: () => void; onCreated: (id: string) => void }) {
  const [number, setNumber] = useState(""),
    [period, setPeriod] = useState("Semester II 2026"),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const eligible = data.submissions.filter(
    (s) =>
      s.status === "verified" &&
      !data.memberships.some((m) => m.submission_id === s.id) &&
      s.period === period,
  );
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const v = await api<{ id: string }>("batches", {
            number,
            period,
            submission_ids: selected,
          });
          toast.success("Paket FUPA regional dibuat.");
          refresh();
          onClose();
          onCreated(v.id);
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Notice>
        Satu nomor FUPA untuk satu paket regional. Isi nomor hasil koordinasi
        PIC Region. Nomor pengajuan unit tetap menjadi referensi internal.
      </Notice>
      <div className="form-grid">
        <Field label="Nomor FUPA">
          <input
            required
            minLength={3}
            maxLength={150}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Nomor sesuai koordinasi PIC"
          />
        </Field>
        <Field label="Periode">
          <Select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setSelected([]);
            }}
          >
            {Array.from(
              new Set([
                "Semester II 2026",
                ...data.submissions.map((s) => s.period),
              ]),
            ).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="selection-heading">
        <h3>Pilih pengajuan terverifikasi</h3>
        <span>{selected.length} dipilih</span>
      </div>
      <div className="unit-selection">
        {eligible.length ? (
          eligible.map((s) => (
            <Check
              key={s.id}
              checked={selected.includes(s.id)}
              onChange={(e) =>
                setSelected((v) =>
                  e.target.checked
                    ? [...v, s.id]
                    : v.filter((id) => id !== s.id),
                )
              }
            >
              <strong>
                {data.units.find((u) => u.id === s.unit_id)?.name}
              </strong>
              <small>
                {s.id} · {s.boxes} box · {s.year_from}–{s.year_to}
              </small>
            </Check>
          ))
        ) : (
          <Empty
            title="Belum ada unit yang dapat dipilih"
            description="Review pengajuan unit terlebih dahulu. Setiap pengajuan hanya dapat masuk satu paket regional."
          />
        )}
      </div>
      <div className="form-actions">
        <Button type="button" onClick={onClose}>
          Batal
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!selected.length}
          loading={busy}
        >
          Buat paket regional
        </Button>
      </div>
    </form>
  );
}
export function Batches({ data, refresh }: PageProps) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const records = data.batches.filter(
    (b) =>
      (status === "all" || b.status === status) &&
      `${b.number} ${b.memo_number} ${data.regions.find((r) => r.id === b.region_id)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="FUPA regional"
        description="Satukan pengajuan unit, catat memo, dan pantau pengkajian PAM."
        action={
          <>
            <Button
              onClick={() =>
                exportCsv("fupa-regional.csv", [
                  [
                    "FUPA",
                    "Regional",
                    "Periode",
                    "Status",
                    "Memo",
                    "Tanggal memo",
                    "Jumlah pengajuan",
                  ],
                  ...records.map((b) => [
                    b.number,
                    data.regions.find((r) => r.id === b.region_id)?.code || "",
                    b.period,
                    batchStatuses[b.status],
                    b.memo_number,
                    b.memo_date,
                    data.memberships.filter((m) => m.batch_id === b.id).length,
                  ]),
                ])
              }
            >
              <Download size={14} />
              Ekspor CSV
            </Button>
            {data.user.role === "region" && (
              <Button variant="primary" onClick={() => setCreate(true)}>
                <Plus size={15} />
                Paket FUPA baru
              </Button>
            )}
          </>
        }
      />
      <div className="flow-strip">
        {[
          ["01", "Unit menyiapkan", "Excel & PDF bertanda tangan"],
          ["02", "PIC menyusun FUPA", "Review dan routing eksternal"],
          ["03", "Region ber-memo", "Catat nomor & tanggal memo"],
          ["04", "PAM mengkaji", "Catatan, revisi, atau selesai"],
        ].map((s, i) => (
          <div key={s[0]}>
            <span>{s[0]}</span>
            <div>
              <strong>{s[1]}</strong>
              <small>{s[2]}</small>
            </div>
            {i < 3 && <ArrowRight size={15} />}
          </div>
        ))}
      </div>
      <Tabs
        value={status}
        onChange={setStatus}
        items={[
          { id: "all", label: "Semua paket", count: data.batches.length },
          { id: "routing", label: "Routing persetujuan" },
          { id: "memo", label: "Sudah ber-memo" },
          { id: "review", label: "Dalam kajian PAM" },
          { id: "revision", label: "Perlu revisi" },
          { id: "reviewed", label: "Selesai dikaji" },
        ]}
      />
      <div className="table-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nomor FUPA, memo, atau regional…"
        />
        <span className="results-count">{records.length} paket regional</span>
      </div>
      <div className="table-container">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nomor FUPA</th>
                <th>Regional</th>
                <th>Pengajuan unit</th>
                <th>Status</th>
                <th>Nomor memo</th>
                <th>Diperbarui</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((b) => (
                <tr key={b.id}>
                  <td>
                    <button
                      className="table-main-link"
                      onClick={() => setSelected(b.id)}
                    >
                      <span className="record-icon purple">
                        <Layers size={16} />
                      </span>
                      <span>
                        <strong>{b.number}</strong>
                        <small>{b.period}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {data.regions.find((r) => r.id === b.region_id)?.code}
                  </td>
                  <td>
                    {data.memberships.filter((m) => m.batch_id === b.id).length}{" "}
                    pengajuan
                  </td>
                  <td>
                    <Badge status={b.status}>{batchStatuses[b.status]}</Badge>
                  </td>
                  <td>
                    <span className={b.memo_number ? "text-sm" : "muted"}>
                      {b.memo_number || "Belum dicatat"}
                    </span>
                  </td>
                  <td className="muted nowrap">{fmtDate(b.updated_at)}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Detail ${b.number}`}
                      onClick={() => setSelected(b.id)}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!records.length && (
          <Empty
            title="Belum ada paket regional"
            description="PIC dapat menyusun paket dari pengajuan unit yang telah diverifikasi."
          />
        )}
      </div>
      <div className="list-help">
        Tanda tangan dan memo diproses di luar website. Status pengkajian PAM
        berlaku hanya pada unit di dalam paket terkait.
      </div>
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="Susun paket FUPA regional"
        wide
      >
        <CreateBatch
          data={data}
          refresh={refresh}
          onClose={() => setCreate(false)}
          onCreated={setSelected}
        />
      </Modal>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detail FUPA regional"
        fullHref={selected ? `/workspace/regional/${selected}` : undefined}
      >
        {selected && (
          <BatchDetail data={data} refresh={refresh} id={selected} drawer />
        )}
      </Drawer>
    </>
  );
}
export function BatchDetail({
  data,
  refresh,
  id,
  drawer = false,
}: PageProps & { id: string; drawer?: boolean }) {
  const b = data.batches.find((b) => b.id === id);
  const [tab, setTab] = useState("overview"),
    [action, setAction] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [memo, setMemo] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [newNumber, setNewNumber] = useState(""),
    [manager, setManager] = useState(false),
    [vp, setVp] = useState(false),
    [revised, setRevised] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  if (!b)
    return (
      <Empty
        title="Paket tidak ditemukan"
        description="Paket sedang diperbarui atau berada di luar akses Anda."
      />
    );
  const members = data.memberships.filter((m) => m.batch_id === id),
    subs = members
      .map((m) => data.submissions.find((s) => s.id === m.submission_id))
      .filter((s) => !!s),
    files = data.files.filter(
      (f) => f.owner_type === "batch" && f.owner_id === id,
    ),
    events = data.events.filter(
      (e) => e.entity_type === "batch" && e.entity_id === id,
    ),
    editable =
      data.user.role === "region" &&
      ["draft", "routing", "revision"].includes(b.status),
    stale = members.some(
      (m) =>
        subs.find((s) => s.id === m.submission_id)?.version !==
        m.submission_version,
    );
  const mutate = async (a: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await api(`batches/${id}`, { action: a, version: b.version, ...extra });
      toast.success("Paket regional diperbarui.");
      refresh();
      setAction(null);
      setNote("");
      setRevised([]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openEdit = () => {
    setNewNumber(b.number);
    setManager(!!b.manager_signed);
    setVp(!!b.vp_signed);
    setAction("save");
  };
  const actionTitle: Record<string, string> = {
    save: "Nomor FUPA & persetujuan eksternal",
    routing: "Mulai routing persetujuan",
    memo: "Catat memo ke fungsi PAM",
    review: "Mulai pengkajian PAM",
    revision: "Kembalikan paket untuk revisi",
    reviewed: "Selesaikan pengkajian PAM",
    draft: "Kembalikan ke draft",
  };
  return (
    <div className={cx("detail-content", drawer && "in-drawer")}>
      {!drawer && (
        <Link className="back-link" href="/workspace/regional">
          <ArrowLeft size={14} />
          Semua FUPA regional
        </Link>
      )}
      <div className="detail-title">
        <span className="record-id">
          {b.id}
          <small>v{b.version}</small>
        </span>
        <h1>{b.number}</h1>
        <p>{data.regions.find((r) => r.id === b.region_id)?.name}</p>
        <div className="detail-status">
          <Badge status={b.status}>{batchStatuses[b.status]}</Badge>
          <span>{b.period}</span>
          {editable && (
            <Button variant="ghost" onClick={openEdit}>
              Ubah persetujuan
            </Button>
          )}
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "overview", label: "Ringkasan" },
          { id: "units", label: "Unit terlampir", count: subs.length },
          { id: "files", label: "Lampiran regional", count: files.length },
          { id: "activity", label: "Aktivitas", count: events.length },
        ]}
      />
      {b.status === "revision" && (
        <Notice tone="warning">
          Paket perlu diperbaiki. Unit yang ditandai PAM harus mengirim ulang
          dan diverifikasi PIC. Routing serta konfirmasi tanda tangan dilakukan
          kembali sebelum mencatat memo.
        </Notice>
      )}
      {stale && b.status !== "reviewed" && (
        <Notice tone="warning">
          Ada versi pengajuan unit yang berubah sejak dimasukkan ke paket.
          Jalankan routing kembali setelah semua unit terverifikasi.
        </Notice>
      )}
      {tab === "overview" && (
        <>
          <div className="property-list">
            <div>
              <span>Nomor FUPA</span>
              <strong>{b.number}</strong>
            </div>
            <div>
              <span>Periode</span>
              <strong>{b.period}</strong>
            </div>
            <div>
              <span>Unit terlampir</span>
              <strong>
                {new Set(subs.map((s) => s.unit_id)).size} SPBU · {subs.length}{" "}
                pengajuan
              </strong>
            </div>
            <div>
              <span>Jumlah box</span>
              <strong>{subs.reduce((a, s) => a + s.boxes, 0)} box</strong>
            </div>
            <div>
              <span>Persetujuan Manager</span>
              <Badge status={b.manager_signed ? "verified" : "draft"}>
                {b.manager_signed ? "Dikonfirmasi PIC" : "Belum dikonfirmasi"}
              </Badge>
            </div>
            <div>
              <span>Persetujuan VP</span>
              <Badge status={b.vp_signed ? "verified" : "draft"}>
                {b.vp_signed ? "Dikonfirmasi PIC" : "Belum dikonfirmasi"}
              </Badge>
            </div>
            <div>
              <span>Nomor memo</span>
              <strong>{b.memo_number || "Belum dicatat"}</strong>
            </div>
            <div>
              <span>Tanggal memo</span>
              <strong>{b.memo_date ? fmtDate(b.memo_date) : "—"}</strong>
            </div>
          </div>
          <Notice>
            Tanda tangan dan pengiriman memo dilakukan di luar Web Arsip GS.
            Konfirmasi di sini merupakan pencatatan administratif oleh PIC
            Region.
          </Notice>
          <section className="detail-section">
            <h3>Langkah selanjutnya</h3>
            <p className="muted detail-guidance">
              {b.status === "draft"
                ? "Periksa unit terlampir, lalu mulai routing persetujuan Manager dan VP di luar website."
                : b.status === "routing"
                  ? "Setelah tanda tangan Manager dan VP selesai, perbarui konfirmasinya dan catat nomor memo yang telah dikirim ke PAM."
                  : b.status === "memo"
                    ? "Memo regional telah dicatat. Menunggu fungsi PAM memulai pengkajian."
                    : b.status === "review"
                      ? "PAM meninjau administrasi dan kelengkapan paket, kemudian mencatat hasil atau meminta perbaikan."
                      : b.status === "revision"
                        ? "Tindak lanjuti catatan PAM, review ulang unit yang direvisi, lalu mulai routing persetujuan kembali."
                        : "Pengkajian administrasi selesai. Pelaksanaan pemusnahan fisik mengikuti persetujuan dan ketentuan resmi tersendiri."}
            </p>
            <div className="detail-actions">
              {data.user.role === "region" && (
                <>
                  {["draft", "revision"].includes(b.status) && (
                    <Button
                      variant="primary"
                      onClick={() => setAction("routing")}
                    >
                      <Send size={14} />
                      Mulai routing
                    </Button>
                  )}
                  {b.status === "routing" && (
                    <>
                      <Button onClick={() => setAction("draft")}>
                        Kembali ke draft
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setMemo(b.memo_number);
                          setAction("memo");
                        }}
                        disabled={!b.manager_signed || !b.vp_signed || stale}
                      >
                        <FileText size={14} />
                        Catat memo
                      </Button>
                    </>
                  )}
                </>
              )}
              {data.user.role === "pam" && (
                <>
                  {b.status === "memo" && (
                    <Button
                      variant="primary"
                      onClick={() => setAction("review")}
                    >
                      <ClipboardCheck size={15} />
                      Mulai kajian
                    </Button>
                  )}
                  {b.status === "review" && (
                    <>
                      <Button onClick={() => setAction("revision")}>
                        <RotateCcw size={14} />
                        Minta revisi
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => setAction("reviewed")}
                      >
                        <CheckCircle2 size={14} />
                        Selesai dikaji
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
            {data.user.role === "unit" && (
              <p className="muted text-sm">
                Status paket diperbarui oleh PIC Region dan PAM.
              </p>
            )}
          </section>
          {b.status === "reviewed" && (
            <Notice>
              “Selesai dikaji” adalah hasil pengkajian administrasi. Status ini
              bukan izin pemusnahan fisik.
            </Notice>
          )}
        </>
      )}
      {tab === "units" && (
        <section className="detail-section">
          <h3>Pengajuan yang tercakup paket ini</h3>
          <div className="batch-members">
            {subs.map((s) => (
              <Link key={s.id} href={`/workspace/pengajuan/${s.id}`}>
                <span className="record-icon">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>
                    {data.units.find((u) => u.id === s.unit_id)?.name}
                  </strong>
                  <small>
                    {s.id} · {s.boxes} box · versi lampiran{" "}
                    {
                      members.find((m) => m.submission_id === s.id)
                        ?.submission_version
                    }
                  </small>
                </span>
                <Badge status={s.status}>{unitStatuses[s.status]}</Badge>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
          <Notice>
            Memo dan hasil kajian paket ini hanya berlaku pada pengajuan unit
            yang terlampir di atas.
          </Notice>
        </section>
      )}
      {tab === "files" && (
        <section className="detail-section">
          <h3>PDF FUPA regional & lampiran gabungan</h3>
          <p className="muted text-sm">
            {data.settings.region_upload_required
              ? "Lampiran PDF regional wajib sebelum pencatatan memo."
              : "Unggahan PDF regional opsional. Nomor dan tanggal memo tetap wajib dicatat."}
          </p>
          {files.map((f) => (
            <FileLink key={f.id} {...f} />
          ))}
          {!files.length && !editable && (
            <Empty
              title={
                data.user.role === "unit"
                  ? "Lampiran regional dikelola PIC"
                  : "Belum ada lampiran regional"
              }
              description="Konfirmasi persetujuan dan memo tersedia di tab ringkasan."
            />
          )}
          {editable && (
            <UploadBox
              ownerType="batch"
              ownerId={id}
              kind="regional"
              version={b.version}
              label="Unggah PDF FUPA regional"
              accept=".pdf"
              onDone={refresh}
            />
          )}
          <Notice>
            Website tidak membuat atau mengirim memo dan tidak merouting tanda
            tangan elektronik.
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
            <Field label="Catatan koordinasi">
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
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
        open={!!action}
        onClose={() => setAction(null)}
        title={actionTitle[action || ""] || "Perbarui paket"}
      >
        <div className="form-stack">
          {action === "save" ? (
            <>
              <Field label="Nomor FUPA">
                <input
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                />
              </Field>
              <Check
                checked={manager}
                onChange={(e) => setManager(e.target.checked)}
              >
                Persetujuan Manager telah ditandatangani di luar web.
              </Check>
              <Check checked={vp} onChange={(e) => setVp(e.target.checked)}>
                Persetujuan VP telah ditandatangani di luar web.
              </Check>
              <Notice>
                Konfirmasi oleh PIC Region, bukan validasi digital tanda tangan.
              </Notice>
            </>
          ) : action === "memo" ? (
            <>
              <Notice>
                Catat memo yang sudah dikirim ke fungsi PAM setelah seluruh
                tanda tangan eksternal lengkap.
              </Notice>
              <Field label="Nomor memo">
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Nomor memo yang telah diterbitkan"
                />
              </Field>
              <Field label="Tanggal memo">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Notice>
                {action === "reviewed"
                  ? "Pengkajian administrasi selesai. Status ini tidak mengizinkan pemusnahan fisik."
                  : action === "routing"
                    ? "Semua unit harus terverifikasi. Versi lampiran diperbarui dan konfirmasi persetujuan direset agar routing dilaksanakan untuk versi terbaru."
                    : action === "revision"
                      ? "Jelaskan perbaikan paket. Pilih unit yang perlu memperbarui pengajuannya; unit lain tetap terverifikasi."
                      : "Status proses akan diperbarui dan dicatat di riwayat aktivitas."}
              </Notice>
              <Field
                label={
                  action === "revision"
                    ? "Catatan revisi · wajib"
                    : "Catatan · opsional"
                }
              >
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              {action === "revision" && (
                <div className="unit-selection">
                  {subs.map((s) => (
                    <Check
                      key={s.id}
                      checked={revised.includes(s.id)}
                      onChange={(e) =>
                        setRevised((v) =>
                          e.target.checked
                            ? [...v, s.id]
                            : v.filter((id) => id !== s.id),
                        )
                      }
                    >
                      {data.units.find((u) => u.id === s.unit_id)?.name}
                      <small>
                        Aktifkan revisi Admin Unit untuk pengajuan ini
                      </small>
                    </Check>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="form-actions">
            <Button onClick={() => setAction(null)}>Batal</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={
                (action === "revision" && note.trim().length < 3) ||
                (action === "memo" && memo.trim().length < 3)
              }
              onClick={() =>
                action &&
                mutate(
                  action,
                  action === "save"
                    ? {
                        number: newNumber,
                        manager_signed: manager,
                        vp_signed: vp,
                      }
                    : action === "memo"
                      ? { memo_number: memo, memo_date: date }
                      : { note, submission_ids: revised },
                )
              }
            >
              {action === "save" ? "Simpan perubahan" : "Konfirmasi & simpan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
