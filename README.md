# Arsip GS · Pertamina Retail

Workspace arsip lokal dengan tampilan terinspirasi Plane: sidebar, tabel, filter, panel detail, halaman detail, dan riwayat aktivitas. Login, perubahan data, unggahan, serta unduhan memakai server dan database sungguhan. Seluruh nama, kode SPBU, angka, status, dan akun awal adalah data demonstrasi.

## Jalankan

Prasyarat: Node.js 22.13+ (diuji dengan 22.20.0) dan npm.

```powershell
npm ci
npm run dev
```

Buka **http://127.0.0.1:3000** dari komputer ini. Jalankan perintah di folder project ini. Untuk mode produksi lokal:

```powershell
npm run build
npm run start
```

Jangan menjalankan `build` bersamaan dengan `dev` pada folder yang sama. Keduanya menggunakan folder keluaran `.next`. Server terikat ke `127.0.0.1`, sehingga belum dapat diakses komputer lain. Hentikan server dengan Ctrl+C.

## Akun demo

Semua akun awal memakai kata sandi **ArsipDemo2026!**. Tiga peran utama dapat dipilih pada halaman login.

| Peran                  | Email                  | Lingkup                       |
| ---------------------- | ---------------------- | ----------------------------- |
| Admin Unit             | admin.spbu@demo.test   | SPBU COCO Kuningan            |
| Admin Unit pembanding  | admin.bekasi@demo.test | SPBU COCO Bekasi              |
| PIC Region             | pic.region@demo.test   | Jawa Bagian Barat             |
| PIC Region pembanding  | pic.jateng@demo.test   | Jawa Bagian Tengah            |
| PAM / Document Control | pam@demo.test          | Semua regional + administrasi |

Untuk berganti akun, buka profil di kanan atas → Keluar. Ini menghapus sesi di server, lalu kembali ke login.

## Yang berfungsi

- Ringkasan berdasarkan lingkup akses dan periode: SPBU unik dengan Excel/PDF, unit tercakup memo, hasil kajian PAM, progres regional, kapasitas, aktivitas, dan pekerjaan berikutnya. Berkas tersedia dibedakan dari verifikasi PIC.
- Pengajuan unit: draft, ubah data, checklist, Excel/PDF wajib, foto opsional, unggahan versi baru, riwayat berkas, kirim, review PIC, permintaan revisi, catatan, tabel dengan pencarian, filter, urutan, pagination, serta ekspor CSV.
- FUPA regional: pilih pengajuan terverifikasi yang belum masuk paket lain, penomoran manual PIC, routing eksternal, konfirmasi Manager/VP, lampiran regional, pencatatan nomor/tanggal memo, kajian PAM, revisi unit terpilih, routing ulang, dan penyelesaian kajian.
- Monitoring: laporan kapasitas/kondisi per unit, suhu/kelembapan opsional, serta riwayat pemeriksaan. Penilaian kondisi dilakukan petugas, tanpa mengarang ambang resmi.
- Kendala: laporan unit, prioritas/kategori, foto pendukung, tindak lanjut lintas peran, status, dan riwayat.
- Pusat dokumen: unduhan berkas asli, ketersediaan yang jujur, unggah/ganti versi oleh PAM, dan data unit sesuai akses. Template FUPA dan Daftar Arsip memakai workbook yang sama; pembaruan berkas keduanya disinkronkan.
- Asisten: FAQ demonstrasi dengan riwayat per pengguna dan tautan referensi. **Belum menggunakan AI, RAG, atau pembacaan isi PDF otomatis.**
- Administrasi: tambah region/unit/pengguna, aktif/nonaktif pengguna beserta pencabutan sesi, pengaturan kewajiban PDF regional, dan jejak audit.
- Pencarian global (Ctrl/⌘ K), notifikasi, penandaan dibaca, tampilan desktop/ponsel, dialog yang dapat ditutup dengan Escape, serta dukungan pengurangan animasi.

## Keputusan alur

1. **Satu FUPA per paket regional.** Pengajuan unit punya ID internal sendiri. Nomor FUPA diisi berdasarkan koordinasi PIC; website tidak membuat nomor resmi secara otomatis.
2. **Lampiran regional opsional secara default.** PAM dapat menjadikannya wajib dari Administrasi → Pengaturan alur. Nomor/tanggal memo serta konfirmasi persetujuan tetap wajib.
3. **Document Control menjadi operator PAM.** Hak kajian dipusatkan di lapisan layanan, sehingga pemisahan peran DC/PAM nantinya dapat ditambahkan tanpa merombak seluruh UI.

Tidak ada integrasi I-BOS. Ekspor, pemisahan fisik, pemotretan, penandatanganan, routing persetujuan, serta pembuatan/pengiriman memo dilakukan di luar website. Website menerima Excel dan PDF yang telah ditandatangani ABH/PIC, mencatat konfirmasi dan nomor memo, serta menampilkan pengkajian. Foto wajib dibuat sebagai persiapan; mengunggah fotonya opsional.

Verifikasi PIC merupakan pemeriksaan administratif. Website tidak memvalidasi tanda tangan secara digital, membaca isi Excel untuk membuktikan kelayakan musnah, atau menetapkan retensi otomatis. **“Selesai dikaji PAM” bukan izin pemusnahan fisik.** Aturan bisnis mengikuti dokumen resmi dan fungsi berwenang; Plane/Mobbin hanya menjadi inspirasi visual.

Keanggotaan paket menyimpan versi pengajuan. Satu pengajuan hanya masuk satu paket. Revisi dari PAM dapat membuka kembali unit terpilih; routing ulang mensyaratkan semua unit terverifikasi dan mereset konfirmasi tanda tangan/nomor memo aktif. Memo sebelumnya tetap tercatat dalam aktivitas. Angka memo/kajian hanya dihitung dari unit yang menjadi anggota paket terkait.

## Dokumen sumber

Repositori memuat kode dan berkas demonstrasi sintetis. Salinan dokumen resmi disimpan lokal di `seed-assets/docs` dan dikecualikan dari Git. Setelah clone, akun demo dan alur kerja langsung tersedia. Dokumen resmi tampil sebagai belum tersedia sampai PAM menyediakan berkas melalui Pusat Dokumen atau salinan lokal ditempatkan dengan nama berikut.

| Berkas                                             | Penggunaan                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| TEMPLATE FUPA.xlsx                                 | `template-fupa.xlsx` untuk Form FUPA dan sheet “Template FUPA” berisi Daftar Arsip |
| TKI C001 hardpaper aktif                           | `tki-c001.pdf` sebagai referensi resmi                                             |
| TKI C002 hardpaper inaktif                         | `tki-c002.pdf` sebagai referensi resmi                                             |
| TEMPLATE DOK ARSIP.pdf                             | `template-dok-arsip.pdf` berisi JRDP pada halaman pertama dan formulir standar     |
| Pedoman, Buku Saku, Sprint tim arsip, Manual I-BOS | Belum tersedia; dapat diunggah PAM                                                 |

CSV data unit awal adalah **contoh**, bukan hasil ekspor I-BOS. Lampiran seed `DEMO_*` dibuat dari data sintetis di `seed-assets/fixtures` dan tidak memuat tanda tangan atau data operasional. Workbook asli tidak diubah, termasuk label kolom tahun yang perlu diperjelas jika nanti ada impor otomatis.

## Penyimpanan dan backup

SQLite tersimpan pada `data/arsip.sqlite`; unggahan privat pada `data/uploads`. Aplikasi mengisi data awal sekali saat database masih kosong. Restart tidak menghapus data. Dokumen sumber harus ikut dipindahkan jika memindahkan project karena path berkas disimpan di database.

Untuk backup, hentikan server, lalu salin **seluruh folder `data` dan `seed-assets`** ke lokasi backup. Jangan hanya menyalin SQLite ketika proses masih berjalan karena ada WAL. Simpan backup di luar folder project. Tidak ada perintah reset otomatis yang menghapus data pengguna.

`ARSIP_DATA_DIR` dapat menunjuk folder data lain. Cookie sesi menggunakan HTTP lokal; untuk server HTTPS, aktifkan `ARSIP_SECURE_COOKIES=true` sebelum mulai. `.env.example` memuat opsi lingkungan. `.gitignore` mengecualikan database, unggahan, rahasia, dan dependensi.

## Stack dan struktur

- Next.js 16 App Router, React 19, TypeScript strict.
- Tailwind CSS 4 + token dan komponen UI lokal, Radix Dialog untuk modal/panel, Lucide, Inter variable lokal.
- TanStack Query untuk sinkronisasi data, TanStack Table untuk tabel pengajuan.
- React Hook Form + Zod untuk form/validasi.
- SQLite bawaan Node, sesi HTTP-only, password scrypt, penyimpanan privat lokal, dan jejak audit.

```text
app/                    Halaman, route API, dan style
components/             Shell, dashboard, form, daftar, detail, dan modul
lib/auth.ts             Login, sesi, pembatasan percobaan masuk
lib/domain.ts           Izin akses dan aturan transisi inti
lib/service.ts          Akses data, alur kerja, unggahan, administrasi
lib/db.ts               Skema dan seed SQLite
lib/types.ts            Kontrak data bersama
seed-assets/            Berkas demo sintetis dan folder lokal dokumen resmi
tests/                  Uji aturan dan integrasi HTTP dengan database sementara
```

## Validasi

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration
```

Tes integrasi menjalankan build produksi di port 3101 dengan database sementara tersendiri, lalu membersihkannya. Port tersebut harus kosong. Meliputi isolasi unit/region, dokumen privat, berkas wajib, konflik versi, siklus revisi, memo, kajian, monitoring, kendala, akun baru, pencabutan sesi, dan FAQ privat.

UI juga diperiksa lewat browser untuk login, panel detail/aktivitas, form simpan Admin Unit, unggah Excel, asisten, unduhan, dan tampilan ponsel. Belum ada pengujian beban banyak pengguna atau audit keamanan eksternal.

## Jalur pengembangan berikutnya

Versi ini lengkap untuk demonstrasi lokal, **belum merupakan deployment multiuser produksi**. SQLite serta berkas lokal tidak cocok untuk filesystem sementara Vercel. Sebelum rollout, pindahkan database ke PostgreSQL/Supabase, unggahan ke bucket privat, dan sesi/login ke penyedia auth yang disetujui perusahaan. Pertahankan aturan domain dan tes akses; ganti fungsi penyimpanan pada lapisan layanan dengan query database/RLS dan unduhan bertanda tangan.

Untuk skala lebih besar: pagination/filter di server (saat ini state memuat seluruh data dalam scope), pekerjaan unggahan/scan berkas terpisah, batas request pada reverse proxy, backup teruji, observabilitas, migrasi schema berversi, serta uji beban dan pemulihan. Nomor FUPA per unit atau pemisahan DC/PAM memerlukan migrasi kontrak data/izin yang eksplisit. Tidak ada layanan cloud, SSO, AI, email, atau deployment yang dikonfigurasi diam-diam.

Lihat `VALIDATION.md` untuk hasil pengujian terakhir dan referensi desain.
