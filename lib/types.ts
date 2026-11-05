export type Role = "unit" | "region" | "pam";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  region_id: string | null;
  unit_id: string | null;
  active: number;
};
export type Region = { id: string; name: string; code: string };
export type Unit = {
  id: string;
  code: string;
  name: string;
  region_id: string;
  city: string;
  active: number;
};
export type UnitStatus = "draft" | "submitted" | "revision" | "verified";
export type BatchStatus =
  "draft" | "routing" | "memo" | "review" | "revision" | "reviewed";
export type Submission = {
  id: string;
  unit_id: string;
  period: string;
  year_from: number;
  year_to: number;
  description: string;
  boxes: number;
  status: UnitStatus;
  physical_sorted: number;
  photographed: number;
  signature_confirmed: number;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
};
export type Batch = {
  id: string;
  region_id: string;
  number: string;
  period: string;
  status: BatchStatus;
  manager_signed: number;
  vp_signed: number;
  memo_number: string;
  memo_date: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
};
export type Membership = {
  batch_id: string;
  submission_id: string;
  submission_version: number;
};
export type StoredFile = {
  id: string;
  owner_type: "submission" | "batch" | "issue";
  owner_id: string;
  kind: string;
  name: string;
  mime: string;
  size: number;
  version: number;
  created_at: string;
  created_by: string;
};
export type Event = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  note: string;
  actor_id: string;
  actor_name: string;
  created_at: string;
};
export type Capacity = {
  id: string;
  unit_id: string;
  total: number;
  used: number;
  condition: string;
  temperature: number | null;
  humidity: number | null;
  note: string;
  created_at: string;
  created_by: string;
};
export type Issue = {
  id: string;
  unit_id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
};
export type Document = {
  id: string;
  title: string;
  category: string;
  description: string;
  version: string;
  filename: string | null;
  available: boolean;
  unit_id?: string | null;
  is_demo?: boolean;
};
export type Notification = {
  id: string;
  title: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  read: boolean;
};
export type State = {
  user: User;
  users: User[];
  regions: Region[];
  units: Unit[];
  submissions: Submission[];
  batches: Batch[];
  memberships: Membership[];
  files: StoredFile[];
  events: Event[];
  capacities: Capacity[];
  issues: Issue[];
  documents: Document[];
  notifications: Notification[];
  settings: {
    region_upload_required: boolean;
    numbering_scope: string;
    pam_permission_separable: boolean;
  };
};
export const unitStatuses: Record<UnitStatus, string> = {
  draft: "Draft",
  submitted: "Menunggu review region",
  revision: "Perlu revisi",
  verified: "Berkas terverifikasi",
};
export const batchStatuses: Record<BatchStatus, string> = {
  draft: "Penyusunan FUPA",
  routing: "Persetujuan region",
  memo: "Memo tercatat",
  review: "Sedang dikaji PAM",
  revision: "Perlu revisi region",
  reviewed: "Pengkajian selesai",
};
