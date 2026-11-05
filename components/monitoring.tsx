"use client";
import { useState } from "react";
import {
  Plus,
  Download,
  Archive,
  Thermometer,
  Droplets,
  ArrowUpRight,
  ChevronRight,
  TriangleAlert,
  Clock3,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
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
  Notice,
  Empty,
  SearchInput,
  Tabs,
  UploadBox,
  FileLink,
  fmtDate,
  fmtTime,
  exportCsv,
  cx,
} from "./ui";
import { Timeline } from "./submissions";
export function Monitoring({ data, refresh }: PageProps) {
  const [search, setSearch] = useState(""),
    [region, setRegion] = useState("all"),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const records = data.units
    .filter(
      (u) =>
        (region === "all" || u.region_id === region) &&
        `${u.name} ${u.code} ${u.city}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .map((u) => ({
      unit: u,
      capacity: data.capacities.find((c) => c.unit_id === u.id),
    }));
  const latest = data.units
      .map((u) => data.capacities.find((c) => c.unit_id === u.id))
      .filter((c) => !!c),
    total = latest.reduce((a, c) => a + c.total, 0),
    used = latest.reduce((a, c) => a + c.used, 0),
    attention = latest.filter((c) => c.condition !== "Baik").length;
  const history = data.capacities.filter((c) => c.unit_id === selected),
    unit = data.units.find((u) => u.id === selected);
  return (
    <>
      <PageTitle
        title="Monitoring arsip"
        description="Pantau kondisi ruang arsip dan ketersediaan box di setiap unit."
        action={
          <>
            <Button
              onClick={() =>
                exportCsv("monitoring-arsip.csv", [
                  [
                    "Kode SPBU",
                    "Unit",
                    "Kapasitas",
                    "Terisi",
                    "Kondisi",
                    "Suhu",
                    "Kelembapan",
                    "Tanggal",
                  ],
                  ...records.map(({ unit: u, capacity: c }) => [
                    u.code,
                    u.name,
                    c?.total || 0,
                    c?.used || 0,
                    c?.condition || "Belum dilaporkan",
                    c?.temperature ?? "",
                    c?.humidity ?? "",
                    c?.created_at || "",
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
                Laporan kondisi
              </Button>
            )}
          </>
        }
      />
      <div className="summary-row">
        {[
          [
            Archive,
            "Total kapasitas",
            `${total} box`,
            "Dari laporan terakhir setiap unit",
          ],
          [
            Archive,
            "Box terisi",
            `${used} box`,
            `${total ? Math.round((used / total) * 100) : 0}% dari kapasitas tersedia`,
          ],
          [
            TriangleAlert,
            "Perlu perhatian",
            `${attention} unit`,
            "Kondisi dilaporkan oleh Admin Unit",
          ],
          [
            CheckCircle2,
            "Unit melaporkan",
            `${latest.length}/${data.units.length}`,
            "Sesuai lingkup akses Anda",
          ],
        ].map(([Icon, title, value, caption]) => {
          const I = Icon as typeof Archive;
          return (
            <div key={String(title)}>
              <span>
                <I size={15} />
                {String(title)}
              </span>
              <strong>{String(value)}</strong>
              <small>{String(caption)}</small>
            </div>
          );
        })}
      </div>
      <div className="table-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari unit, kode SPBU, atau kota…"
        />
        <Select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Filter regional"
        >
          <option value="all">Semua regional</option>
          {data.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code}
            </option>
          ))}
        </Select>
      </div>
      <div className="table-container">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit SPBU</th>
                <th>Kapasitas box</th>
                <th>Kondisi</th>
                <th>Suhu</th>
                <th>Kelembapan</th>
                <th>Laporan terakhir</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map(({ unit: u, capacity: c }) => (
                <tr key={u.id}>
                  <td>
                    <button
                      className="table-main-link"
                      onClick={() => setSelected(u.id)}
                    >
                      <span className="record-icon">
                        <Archive size={16} />
                      </span>
                      <span>
                        <strong>{u.name}</strong>
                        <small>
                          {u.code} · {u.city}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {c ? (
                      <div className="capacity-cell">
                        <span>
                          <strong>{c.used}</strong> / {c.total}
                          <small>{Math.round((c.used / c.total) * 100)}%</small>
                        </span>
                        <div className="mini-progress">
                          <i
                            style={{ width: `${(c.used / c.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="muted">Belum dilaporkan</span>
                    )}
                  </td>
                  <td>
                    <Badge
                      status={
                        c?.condition === "Baik"
                          ? "verified"
                          : c
                            ? "revision"
                            : "draft"
                      }
                    >
                      {c?.condition || "Belum dilaporkan"}
                    </Badge>
                  </td>
                  <td>
                    {c?.temperature !== null && c?.temperature !== undefined
                      ? `${c.temperature}°C`
                      : "—"}
                  </td>
                  <td>
                    {c?.humidity !== null && c?.humidity !== undefined
                      ? `${c.humidity}%`
                      : "—"}
                  </td>
                  <td className="muted">{c ? fmtDate(c.created_at) : "—"}</td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => setSelected(u.id)}
                      aria-label={`Riwayat ${u.name}`}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!records.length && <Empty title="Unit tidak ditemukan" />}
      </div>
      <div className="list-help">
        Kondisi adalah penilaian petugas lapangan. Website tidak menerapkan
        ambang suhu/kelembapan sebagai ketentuan resmi secara otomatis.
      </div>
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="Catat kondisi ruang arsip"
        description="Setiap laporan menjadi catatan baru; laporan sebelumnya tetap tersimpan."
        wide
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const b = Object.fromEntries(f.entries());
            setBusy(true);
            try {
              await api("capacity", {
                ...b,
                unit_id: data.user.unit_id,
                temperature:
                  b.temperature === "" ? null : Number(b.temperature),
                humidity: b.humidity === "" ? null : Number(b.humidity),
              });
              toast.success("Laporan monitoring tersimpan.");
              refresh();
              setCreate(false);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Notice>
            {data.units.find((u) => u.id === data.user.unit_id)?.name} · Periksa
            jumlah box dan kondisi sesuai hasil pemeriksaan.
          </Notice>
          <div className="form-grid">
            <Field label="Kapasitas total · box">
              <input
                name="total"
                type="number"
                min={1}
                max={100000}
                required
                defaultValue={latest[0]?.total || 80}
              />
            </Field>
            <Field label="Box terisi">
              <input
                name="used"
                type="number"
                min={0}
                required
                defaultValue={latest[0]?.used || 0}
              />
            </Field>
            <Field label="Suhu · °C (opsional)">
              <input
                name="temperature"
                type="number"
                step="0.1"
                min={-10}
                max={60}
              />
            </Field>
            <Field label="Kelembapan · % (opsional)">
              <input
                name="humidity"
                type="number"
                step="0.1"
                min={0}
                max={100}
              />
            </Field>
          </div>
          <Field label="Kondisi ruang arsip">
            <Select name="condition">
              <option>Baik</option>
              <option>Perlu perhatian</option>
              <option>Kritis</option>
            </Select>
          </Field>
          <Field label="Catatan pemeriksaan">
            <textarea
              name="note"
              rows={3}
              placeholder="Kondisi rak, box, kebersihan, dan tindakan yang diperlukan…"
            />
          </Field>
          <div className="form-actions">
            <Button type="button" onClick={() => setCreate(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={busy}>
              Simpan laporan
            </Button>
          </div>
        </form>
      </Modal>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Riwayat monitoring"
      >
        <div className="detail-content in-drawer">
          <div className="detail-title">
            <span className="record-id">{unit?.code}</span>
            <h1>{unit?.name}</h1>
            <p>{history.length} laporan kondisi tersimpan</p>
          </div>
          {history.length ? (
            history.map((c) => (
              <section className="monitor-report" key={c.id}>
                <div>
                  <time>{fmtTime(c.created_at)}</time>
                  <Badge
                    status={c.condition === "Baik" ? "verified" : "revision"}
                  >
                    {c.condition}
                  </Badge>
                </div>
                <div className="monitor-reading">
                  <span>
                    <Archive size={16} />
                    <strong>
                      {c.used} / {c.total}
                    </strong>{" "}
                    box
                  </span>
                  <span>
                    <Thermometer size={16} />
                    {c.temperature ?? "—"}°C
                  </span>
                  <span>
                    <Droplets size={16} />
                    {c.humidity ?? "—"}%
                  </span>
                </div>
                <p>{c.note || "Tanpa catatan tambahan."}</p>
              </section>
            ))
          ) : (
            <Empty title="Belum ada laporan kondisi" />
          )}
        </div>
      </Drawer>
    </>
  );
}
const issueStatuses = {
  open: "Terbuka",
  progress: "Ditindaklanjuti",
  resolved: "Selesai",
};
export function Issues({ data, refresh }: PageProps) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const records = data.issues.filter(
    (i) =>
      (status === "all" || i.status === status) &&
      `${i.title} ${data.units.find((u) => u.id === i.unit_id)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const issue = data.issues.find((i) => i.id === selected);
  return (
    <>
      <PageTitle
        title="Kendala & tindak lanjut"
        description="Laporkan masalah di lapangan dan catat penyelesaiannya bersama."
        action={
          data.user.role === "unit" && (
            <Button variant="primary" onClick={() => setCreate(true)}>
              <Plus size={15} />
              Laporkan kendala
            </Button>
          )
        }
      />
      <Tabs
        value={status}
        onChange={setStatus}
        items={[
          { id: "all", label: "Semua kendala", count: data.issues.length },
          ...Object.entries(issueStatuses).map(([id, label]) => ({
            id,
            label,
            count: data.issues.filter((i) => i.status === id).length,
          })),
        ]}
      />
      <div className="table-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari kendala atau nama unit…"
        />
        <span className="results-count">{records.length} kendala</span>
      </div>
      <div className="table-container">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kendala</th>
                <th>Unit SPBU</th>
                <th>Kategori</th>
                <th>Prioritas</th>
                <th>Status</th>
                <th>Diperbarui</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((i) => (
                <tr key={i.id}>
                  <td>
                    <button
                      className="table-main-link"
                      onClick={() => setSelected(i.id)}
                    >
                      <span className="record-icon amber">
                        <TriangleAlert size={16} />
                      </span>
                      <span>
                        <strong>{i.title}</strong>
                        <small>{i.id}</small>
                      </span>
                    </button>
                  </td>
                  <td className="text-sm">
                    {data.units.find((u) => u.id === i.unit_id)?.name}
                  </td>
                  <td className="muted">{i.category}</td>
                  <td>
                    <Badge
                      status={i.priority === "Tinggi" ? "revision" : "draft"}
                    >
                      {i.priority}
                    </Badge>
                  </td>
                  <td>
                    <Badge status={i.status}>
                      {issueStatuses[i.status as keyof typeof issueStatuses]}
                    </Badge>
                  </td>
                  <td className="muted">{fmtDate(i.updated_at)}</td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => setSelected(i.id)}
                      aria-label={`Detail ${i.title}`}
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
            title="Tidak ada kendala"
            description="Semua laporan kendala akan tercatat di sini."
          />
        )}
      </div>
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="Laporkan kendala arsip"
        wide
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const b = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            try {
              const result = await api<{ id: string }>("issues", {
                ...b,
                unit_id: data.user.unit_id,
              });
              toast.success("Kendala berhasil dilaporkan.");
              refresh();
              setCreate(false);
              setSelected(result.id);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Judul kendala">
            <input
              name="title"
              required
              minLength={3}
              maxLength={150}
              placeholder="Contoh: box arsip lembap di rak bawah"
            />
          </Field>
          <div className="form-grid">
            <Field label="Kategori">
              <Select name="category">
                {[
                  "Kapasitas",
                  "Kondisi penyimpanan",
                  "Pemeliharaan",
                  "Administrasi",
                  "Lainnya",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Prioritas">
              <Select name="priority">
                <option>Normal</option>
                <option>Tinggi</option>
              </Select>
            </Field>
          </div>
          <Field label="Uraian kondisi">
            <textarea
              name="description"
              rows={4}
              required
              minLength={5}
              maxLength={3000}
              placeholder="Jelaskan lokasi, kondisi, dan bantuan yang dibutuhkan…"
            />
          </Field>
          <p className="muted text-sm">
            Foto pendukung dapat ditambahkan setelah laporan tersimpan.
          </p>
          <div className="form-actions">
            <Button type="button" onClick={() => setCreate(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Simpan laporan
            </Button>
          </div>
        </form>
      </Modal>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detail kendala"
      >
        {issue && (
          <div className="detail-content in-drawer">
            <div className="detail-title">
              <span className="record-id">{issue.id}</span>
              <h1>{issue.title}</h1>
              <p>{data.units.find((u) => u.id === issue.unit_id)?.name}</p>
              <Badge status={issue.status}>
                {issueStatuses[issue.status as keyof typeof issueStatuses]}
              </Badge>
            </div>
            <div className="property-list">
              <div>
                <span>Kategori</span>
                <strong>{issue.category}</strong>
              </div>
              <div>
                <span>Prioritas</span>
                <strong>{issue.priority}</strong>
              </div>
              <div>
                <span>Dilaporkan</span>
                <strong>{fmtTime(issue.created_at)}</strong>
              </div>
            </div>
            <section className="detail-section">
              <h3>Uraian kendala</h3>
              <p className="prose-text">{issue.description}</p>
              <h3>Foto pendukung</h3>
              {data.files
                .filter(
                  (f) => f.owner_type === "issue" && f.owner_id === issue.id,
                )
                .map((f) => (
                  <FileLink key={f.id} {...f} />
                ))}
              {data.user.role === "unit" && (
                <UploadBox
                  ownerType="issue"
                  ownerId={issue.id}
                  kind="photo"
                  label="Unggah foto pendukung"
                  accept=".jpg,.jpeg,.png"
                  onDone={refresh}
                />
              )}
            </section>
            <section className="detail-section">
              <h3>Catat tindak lanjut</h3>
              <form
                key={`${issue.id}-${issue.updated_at}`}
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const body = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  setBusy(true);
                  try {
                    await api(`issues/${issue.id}`, body);
                    toast.success("Tindak lanjut tersimpan.");
                    refresh();
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label="Status">
                  <Select name="status" defaultValue={issue.status}>
                    {Object.entries(issueStatuses).map(([id, s]) => (
                      <option key={id} value={id}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Catatan tindakan">
                  <textarea name="note" required minLength={3} rows={3} />
                </Field>
                <Button type="submit" variant="primary" loading={busy}>
                  Simpan tindak lanjut
                </Button>
              </form>
            </section>
            <section className="detail-section">
              <h3>Aktivitas kendala</h3>
              <Timeline
                events={data.events.filter(
                  (e) => e.entity_type === "issue" && e.entity_id === issue.id,
                )}
              />
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
