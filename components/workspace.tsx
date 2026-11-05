"use client";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  LayoutDashboard,
  Files,
  Layers,
  ChartNoAxesCombined,
  TriangleAlert,
  BookOpen,
  Sparkles,
  Settings2,
  Search,
  Bell,
  ChevronsUpDown,
  Plus,
  LogOut,
  Menu,
  ArrowRight,
  Command,
  Loader2,
  ChevronRight,
  HelpCircle,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { State } from "@/lib/types";
import {
  api,
  Avatar,
  Button,
  IconButton,
  Modal,
  SearchInput,
  roleLabel,
  fmtTime,
  Empty,
  cx,
} from "./ui";
import { Dashboard } from "./dashboard";
import { Submissions, SubmissionDetail } from "./submissions";
import { Batches, BatchDetail } from "./batches";
import { Monitoring, Issues } from "./monitoring";
import { Documents, Assistant, Admin } from "./resources";
const nav = [
  { id: "", label: "Ringkasan", icon: LayoutDashboard },
  { id: "pengajuan", label: "Pengajuan unit", icon: Files },
  { id: "regional", label: "FUPA regional", icon: Layers },
  { id: "monitoring", label: "Monitoring arsip", icon: ChartNoAxesCombined },
  { id: "kendala", label: "Kendala & tindak lanjut", icon: TriangleAlert },
];
const resources = [
  { id: "dokumen", label: "Pusat dokumen", icon: BookOpen },
  { id: "asisten", label: "Asisten arsip", icon: Sparkles },
];
export type PageProps = { data: State; refresh: () => void };
export function Workspace() {
  const query = useQuery({
    queryKey: ["state"],
    queryFn: () => api<State>("state"),
    refetchInterval: 30000,
  });
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["state"] });
  };
  const pathname = usePathname(),
    router = useRouter();
  const parts = pathname.split("/").filter(Boolean),
    page = parts[1] || "",
    detail = parts[2];
  const [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(""),
    [notifications, setNotifications] = useState(false),
    [profile, setProfile] = useState(false),
    [mobile, setMobile] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => setMobile(false), [pathname]);
  if (query.isPending)
    return (
      <div className="loading-screen">
        <span className="brand-symbol">
          <Archive size={22} />
        </span>
        <Loader2 size={22} className="spin" />
        <p>Menyiapkan workspace…</p>
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="loading-screen">
        <Empty
          title="Workspace belum dapat dimuat"
          description={query.error?.message}
          action={<Button onClick={() => query.refetch()}>Coba lagi</Button>}
        />
      </div>
    );
  const data = query.data,
    props = { data, refresh },
    unread = data.notifications.filter((n) => !n.read).length;
  const currentPage = [
    ...nav,
    ...resources,
    { id: "admin", label: "Administrasi", icon: Settings2 },
  ].find((n) => n.id === page);
  const title = currentPage?.label || "Halaman tidak ditemukan";
  const PageIcon = currentPage?.icon || Archive;
  const goto = (path: string) => {
    setSearchOpen(false);
    router.push(path);
  };
  const matches = [
    ...data.submissions.map((s) => ({
      id: s.id,
      title: data.units.find((u) => u.id === s.unit_id)?.name || s.id,
      subtitle: `Pengajuan · ${s.id}`,
      url: `/workspace/pengajuan/${s.id}`,
    })),
    ...data.batches.map((b) => ({
      id: b.id,
      title: b.number,
      subtitle: "FUPA regional",
      url: `/workspace/regional/${b.id}`,
    })),
    ...data.documents
      .filter((d) => d.available)
      .map((d) => ({
        id: d.id,
        title: d.title,
        subtitle: "Dokumen referensi",
        url: "/workspace/dokumen",
      })),
  ]
    .filter((r) =>
      `${r.title} ${r.subtitle}`.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 9);
  return (
    <div className="app-shell">
      <aside className="icon-rail">
        <Link href="/workspace" className="rail-brand" aria-label="Arsip GS">
          <Archive size={21} />
        </Link>
        <Link href="/workspace" className="rail-active" title="Workspace arsip">
          <Layers size={19} />
        </Link>
        <button
          onClick={() => router.push("/workspace/dokumen")}
          title="Pusat dokumen"
          aria-label="Pusat dokumen"
        >
          <BookOpen size={19} />
        </button>
        <div className="rail-bottom">
          <button
            onClick={() => router.push("/workspace/asisten")}
            aria-label="Bantuan arsip"
            title="Bantuan arsip"
          >
            <HelpCircle size={19} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={cx("sidebar", mobile && "mobile-open")}>
        <button className="workspace-switcher" onClick={() => setProfile(true)}>
          <span className="workspace-icon">GS</span>
          <span>
            <strong>Arsip GS</strong>
            <small>Pertamina Retail</small>
          </span>
          <ChevronsUpDown size={14} />
        </button>
        <button className="sidebar-search" onClick={() => setSearchOpen(true)}>
          <Search size={15} />
          <span>Cari di workspace</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="sidebar-group">
          <span>Workspace</span>
          {nav.map((n) => (
            <Link
              key={n.id}
              href={`/workspace${n.id ? `/${n.id}` : ""}`}
              aria-current={page === n.id ? "page" : undefined}
              className={cx("nav-item", page === n.id && "active")}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {n.id === "pengajuan" &&
                data.submissions.some((s) => s.status === "submitted") && (
                  <b>
                    {
                      data.submissions.filter((s) => s.status === "submitted")
                        .length
                    }
                  </b>
                )}
            </Link>
          ))}
        </div>
        <div className="sidebar-group">
          <span>Sumber daya</span>
          {resources.map((n) => (
            <Link
              key={n.id}
              href={`/workspace/${n.id}`}
              aria-current={page === n.id ? "page" : undefined}
              className={cx("nav-item", page === n.id && "active")}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {n.id === "asisten" && <small className="mini-label">DEMO</small>}
            </Link>
          ))}
          {data.user.role === "pam" && (
            <Link
              href="/workspace/admin"
              className={cx("nav-item", page === "admin" && "active")}
            >
              <Settings2 size={17} />
              <span>Administrasi</span>
            </Link>
          )}
        </div>
        <button className="sidebar-user" onClick={() => setProfile(true)}>
          <Avatar name={data.user.name} />
          <span>
            <strong>{data.user.name}</strong>
            <small>{roleLabel[data.user.role]}</small>
          </span>
          <ChevronsUpDown size={14} />
        </button>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <IconButton
              icon={Menu}
              label="Buka navigasi"
              onClick={() => setMobile((v) => !v)}
              className="mobile-menu"
            />
            <PageIcon className="page-crumb-icon" size={16} />
            <strong>{title}</strong>
            {detail && (
              <>
                <ChevronRight size={13} />
                <span className="detail-crumb">{detail}</span>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <span className="local-pill">
              <i />
              Data demo · Lokal
            </span>
            <IconButton
              icon={Search}
              label="Pencarian global"
              onClick={() => setSearchOpen(true)}
            />
            <button
              className="icon-button notification-button"
              aria-label={`Notifikasi, ${unread} belum dibaca`}
              onClick={() => setNotifications(true)}
            >
              <Bell size={17} />
              {unread > 0 && <i />}
            </button>
            <span className="topbar-divider" />
            <button
              className="profile-button"
              onClick={() => setProfile(true)}
              aria-label="Buka profil"
            >
              <Avatar name={data.user.name} size="small" />
            </button>
          </div>
        </header>
        <main
          className={cx(
            "page-content",
            page === "asisten" && "assistant-content",
          )}
        >
          {page === "" ? (
            <Dashboard {...props} />
          ) : page === "pengajuan" ? (
            detail ? (
              <SubmissionDetail {...props} id={detail} />
            ) : (
              <Submissions {...props} />
            )
          ) : page === "regional" ? (
            detail ? (
              <BatchDetail {...props} id={detail} />
            ) : (
              <Batches {...props} />
            )
          ) : page === "monitoring" ? (
            <Monitoring {...props} />
          ) : page === "kendala" ? (
            <Issues {...props} />
          ) : page === "dokumen" ? (
            <Documents {...props} />
          ) : page === "asisten" ? (
            <Assistant {...props} />
          ) : page === "admin" && data.user.role === "pam" ? (
            <Admin {...props} />
          ) : (
            <Empty
              title="Halaman tidak tersedia"
              action={
                <Link className="button" href="/workspace">
                  Kembali ke ringkasan
                </Link>
              }
            />
          )}
        </main>
        <footer className="workspace-footer">
          <span>Arsip GS · General Services</span>
          <span>
            Lingkungan demonstrasi · Keputusan mengikuti dokumen resmi
          </span>
        </footer>
      </div>
      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Cari di workspace"
        description="Cari pengajuan, nomor FUPA, atau dokumen dalam akses Anda."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Ketik nama unit, nomor, atau dokumen…"
        />
        <div className="command-results">
          {matches.length ? (
            matches.map((m) => (
              <button key={m.id} onClick={() => goto(m.url)}>
                <Search size={16} />
                <span>
                  <strong>{m.title}</strong>
                  <small>{m.subtitle}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))
          ) : (
            <Empty
              title="Tidak ada hasil"
              description="Coba kata kunci yang berbeda."
            />
          )}
        </div>
        <small className="muted">Ctrl / ⌘ K untuk membuka pencarian</small>
      </Modal>
      <Modal
        open={notifications}
        onClose={() => setNotifications(false)}
        title="Notifikasi"
      >
        <div className="notification-toolbar">
          <span className="muted">Aktivitas dalam akses Anda</span>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await api("notifications", {});
                refresh();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <CheckCheck size={15} />
            Tandai dibaca
          </Button>
        </div>
        <div className="notification-list">
          {data.notifications.length ? (
            data.notifications.map((n) => (
              <button
                key={n.id}
                className={n.read ? "read" : ""}
                onClick={async () => {
                  await api("notifications", { ids: [n.id] });
                  refresh();
                  setNotifications(false);
                  router.push(
                    n.entity_type === "submission"
                      ? `/workspace/pengajuan/${n.entity_id}`
                      : n.entity_type === "batch"
                        ? `/workspace/regional/${n.entity_id}`
                        : n.entity_type === "issue"
                          ? "/workspace/kendala"
                          : "/workspace/monitoring",
                  );
                }}
              >
                <span className="notification-dot" />
                <span>
                  <strong>{n.title}</strong>
                  <small>
                    {n.entity_id} · {fmtTime(n.created_at)}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))
          ) : (
            <Empty title="Belum ada notifikasi" />
          )}
        </div>
      </Modal>
      <Modal
        open={profile}
        onClose={() => setProfile(false)}
        title="Profil workspace"
      >
        <div className="profile-card">
          <Avatar name={data.user.name} size="large" />
          <div>
            <h3>{data.user.name}</h3>
            <p>{data.user.email}</p>
            <span>{roleLabel[data.user.role]}</span>
          </div>
        </div>
        <div className="property-list">
          <div>
            <span>Lingkup akses</span>
            <strong>
              {data.user.role === "pam"
                ? "Seluruh unit & region"
                : data.user.role === "unit"
                  ? data.units[0]?.name
                  : data.regions[0]?.name}
            </strong>
          </div>
          <div>
            <span>Lingkungan</span>
            <strong>Demo lokal · SQLite</strong>
          </div>
        </div>
        <p className="muted text-sm">
          Untuk mencoba peran lain, keluar lalu pilih akun demo pada halaman
          masuk.
        </p>
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            await api("auth/logout", {});
            client.clear();
            window.location.assign("/login");
          }}
        >
          <LogOut size={15} />
          Keluar dari workspace
        </Button>
      </Modal>
    </div>
  );
}
