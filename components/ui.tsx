"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Loader2,
  Search,
  ChevronDown,
  FileText,
  Download,
  ArrowUpRight,
  Inbox,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { useState } from "react";
import { toast } from "sonner";
export const cx = clsx;
export async function api<T = unknown>(
  url: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(
    `/api/${url}`,
    body !== undefined
      ? {
          method: "POST",
          headers:
            body instanceof FormData
              ? undefined
              : { "Content-Type": "application/json" },
          body: body instanceof FormData ? body : JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401 && url !== "auth/login")
      window.location.assign("/login");
    throw new Error(data.error || "Permintaan gagal.");
  }
  return data as T;
}
export const fmtDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";
export const fmtTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const roleLabel = {
  unit: "Admin Unit",
  region: "PIC Region",
  pam: "PAM / Document Control",
};
export function Button({
  children,
  variant = "default",
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx("button", variant, className)}
    >
      {loading && <Loader2 size={14} className="spin" />}
      {children}
    </button>
  );
}
export function IconButton({
  icon: Icon,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      {...props}
      type="button"
      className={cx("icon-button", props.className)}
      aria-label={label}
      title={label}
    >
      <Icon size={17} />
    </button>
  );
}
export function Badge({
  status,
  children,
}: {
  status?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={cx("badge", status)}>
      <i />
      {children || status}
    </span>
  );
}
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: "normal" | "small" | "large";
}) {
  return (
    <span className={cx("avatar", size)}>
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={cx("dialog-content", wide && "wide")}
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Tutup dialog" />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description
              id="dialog-description"
              className="muted dialog-description"
            >
              {description}
            </Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Drawer({
  open,
  onClose,
  title,
  children,
  fullHref,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  fullHref?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer" aria-describedby={undefined}>
          <div className="drawer-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <div className="flex gap-2">
              {fullHref && (
                <a
                  href={fullHref}
                  className="icon-button"
                  title="Buka halaman detail"
                  aria-label="Buka halaman detail"
                >
                  <ArrowUpRight size={17} />
                </a>
              )}
              <Dialog.Close asChild>
                <IconButton icon={X} label="Tutup panel" />
              </Dialog.Close>
            </div>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="error">{error}</small>}
    </label>
  );
}
export function Check({
  children,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  children: React.ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" {...props} />
      <span>{children}</span>
    </label>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning";
}) {
  return <div className={cx("notice", tone)}>{children}</div>;
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Cari...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={15} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Bersihkan pencarian">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select-wrap">
      <select {...props}>{children}</select>
      <ChevronDown size={13} />
    </span>
  );
}
export function FileLink({
  id,
  name,
  size,
  version,
  document = false,
}: {
  id: string;
  name: string;
  size?: number;
  version?: number;
  document?: boolean;
}) {
  return (
    <a
      className="file-link"
      href={`/api/${document ? "documents" : "files"}/${id}`}
      download
    >
      <span className="file-icon">
        <FileText size={18} />
      </span>
      <span>
        <strong>{name}</strong>
        <small>
          {size ? `${(size / 1024).toFixed(0)} KB` : "Dokumen referensi"}
          {version ? ` · v${version}` : ""}
        </small>
      </span>
      <Download size={15} />
    </a>
  );
}
export function UploadBox({
  ownerType,
  ownerId,
  kind,
  version,
  label,
  accept,
  onDone,
  documentVersion,
}: {
  ownerType: string;
  ownerId: string;
  kind: string;
  version?: number;
  label: string;
  accept: string;
  onDone: () => void;
  documentVersion?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={cx("upload-box", busy && "disabled")}>
      <span>
        {busy ? <Loader2 className="spin" size={18} /> : <FileText size={18} />}
      </span>
      <strong>{busy ? "Mengunggah…" : label}</strong>
      <small>Klik untuk memilih · maksimal 20 MB</small>
      <input
        type="file"
        disabled={busy}
        accept={accept}
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          const form = new FormData();
          form.set("file", file);
          form.set("owner_type", ownerType);
          form.set("owner_id", ownerId);
          form.set("kind", kind);
          if (version !== undefined) form.set("version", String(version));
          if (documentVersion) form.set("document_version", documentVersion);
          try {
            await api("files", form);
            toast.success("Berkas tersimpan.");
            onDone();
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button
          type="button"
          key={i.id}
          role="tab"
          aria-selected={value === i.id}
          onClick={() => onChange(i.id)}
          className={value === i.id ? "active" : ""}
        >
          {i.label}
          {i.count !== undefined && <span>{i.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function exportCsv(name: string, rows: (string | number)[][]) {
  const safe = (v: string | number) => {
    const s = String(v);
    return `"${/^[=+@\-\t\r]/.test(s) ? "'" : ""}${s.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    ["\ufeff" + rows.map((r) => r.map(safe).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
