# Catatan Perbaikan — Retail Attendance Management

Dua masalah yang dilaporkan sudah diperbaiki. **Ada 2 langkah wajib setelah deploy** (lihat bagian paling bawah).

---

## 1. Clock Out tidak tercatat di spreadsheet

### Penyebab
Ada tiga hal yang saling menumpuk:

1. **Aplikasi melaporkan "berhasil" padahal tidak menulis apa pun.**
   Di `AppContext.tsx` ada cabang khusus: kalau Apps Script menjawab "belum melakukan Clock In",
   aplikasi menyimpan record hanya di `localStorage` lalu mengembalikan `success: true`
   dengan pesan *"Clock Out berhasil disimpan!"*. Jadi karyawan melihat centang hijau,
   sheet ATTENDANCE kosong. Ini sumber utama gejala yang Anda lihat.

2. **Clock Out diblokir di sisi browser sebelum sempat dikirim.**
   Syarat "harus sudah Clock In" dicek dari state lokal yang diisi lewat endpoint
   `docs.google.com/.../gviz/tq`. Endpoint itu **hanya bisa dibaca kalau spreadsheet
   di-share "Anyone with the link"**. Kalau tidak, pembacaan gagal diam-diam
   (`catch → return []`), daftar absensi jadi kosong, dan record Clock In yang barusan
   dibuat hanya bertahan 5 menit di memori (`grace period` 300000 ms). Lewat dari itu,
   Clock Out berhenti di browser dengan pesan "Anda belum Clock In hari ini".

3. **Tanggal bergeser satu hari.**
   `appendRow` menulis `"2026-09-21"` sebagai *string*, lalu Google Sheets mengubahnya
   menjadi objek tanggal memakai timezone spreadsheet. Saat dibaca ulang dan diformat
   ke `Asia/Jakarta`, tanggalnya bisa mundur/maju sehari sehingga baris IN tidak
   dikenali sebagai "hari ini". Tambahan: waktu absen diambil dari jam HP
   (`getLocalTodayDate()`), bukan WIB, jadi HP ber-timezone WITA/WIT geser lagi.

### Yang diubah
| Berkas | Perubahan |
|---|---|
| `src/context/AppContext.tsx` | Cabang "sukses palsu" **dihapus**. Kalau Apps Script menolak, aplikasi bilang GAGAL dan mencatat `Failed Clock Out` di audit log. |
| `src/context/AppContext.tsx` | Sebelum Clock Out, status hari ini ditanyakan langsung ke spreadsheet (`getTodayStatus`), bukan ditebak dari cache lokal. |
| `src/context/AppContext.tsx` | Tanggal & jam absen memakai WIB (`getJakartaTodayDate` / `getJakartaTimeString`), sama persis dengan yang dipakai Apps Script. |
| `src/context/AppContext.tsx` | Sinkronisasi punya jalur cadangan: kalau gviz kosong, seluruh tabel dibaca lewat Apps Script (`getAllData`). Spreadsheet **tidak perlu** dibuat publik lagi. |
| `src/utils/gasExporter.ts` | `Attendance_appendRow()` memaksa kolom Date, Time, Created At berformat teks `@` supaya tanggal tidak dikonversi Sheets. |
| `src/utils/gasExporter.ts` | `Attendance_findToday()` menggantikan logika lama. Baris dianggap hari ini bila tanggalnya = hari ini (WIB) **atau** Created At-nya < 18 jam lalu. |
| `src/utils/gasExporter.ts` | Fallback lama yang berbahaya dihapus: dulu, kalau tidak ketemu IN hari ini, script memindai **seluruh riwayat** dan menganggap IN kapan pun sebagai valid. |
| `src/utils/gasExporter.ts` | Setelah menulis Clock Out, script `flush()` lalu **membaca ulang baris itu** untuk memastikan benar-benar tersimpan sebelum menjawab sukses. |
| `src/utils/gasExporter.ts` | `Data_getAll()` yang tadinya hanya mengembalikan CONFIG kini mengembalikan ATTENDANCE, MANPOWER, LOCATION_MASTER, REQUEST, FACE_REGISTER. |
| `src/utils/dateUtils.ts` | Format `9/21/2026` vs `21/09/2026` kini dibedakan otomatis (angka > 12 pasti tanggal). |

---

## 2. Wajah teman bisa dipakai login

### Penyebab
Ini bukan bug kecil — **sistem lama memang tidak mengenali wajah sama sekali.**

`faceBiometrics.ts` yang lama membagi frame kamera menjadi grid 6×6, lalu untuk tiap sel
menghitung tiga angka: rata-rata kecerahan relatif, gradien horizontal, gradien vertikal
(6 × 6 × 3 = 108 dimensi). Yang terekam adalah **pencahayaan ruangan dan posisi kepala**,
bukan bentuk wajah. Dua orang berbeda yang duduk di kursi yang sama dengan lampu yang sama
menghasilkan vektor yang nyaris identik, sehingga cosine similarity-nya selalu di atas
ambang 0.65. Komentar di kode yang menyebut "orang berbeda menghasilkan 0.10–0.35" tidak
pernah benar. Menaikkan ambang juga tidak menolong — yang salah bukan angkanya, tapi
apa yang diukur.

### Yang diubah
`src/utils/faceBiometrics.ts` ditulis ulang memakai model pengenalan wajah sungguhan
(face-api.js / TensorFlow.js), dimuat dari CDN saat modal absensi dibuka:

- **TinyFaceDetector** — memastikan memang ada wajah, menolak frame kosong/tertutup.
- **FaceLandmark68** — meluruskan wajah sebelum diukur.
- **FaceRecognitionNet** — menghasilkan descriptor **128 dimensi** yang khas per individu.

Pencocokan memakai jarak Euclidean antar descriptor:

| Kondisi | Jarak khas |
|---|---|
| Orang yang sama | 0.20 – 0.45 |
| Orang berbeda | 0.60 – 1.10 |

Ambang default **0.45**, bisa diatur di Pengaturan → *Face Match Max Distance*
(0.38 = sangat ketat, 0.50 = longgar).

Pengetatan lain:
- Registrasi mengambil **5 sampel**; kalau selisih antar sampel > 0.40 registrasi ditolak
  (mencegah dua orang berbeda terekam dalam satu template).
- Verifikasi mengambil **2 pemindaian berjarak 400 ms**; keduanya wajib lolos.
- Kalau terdeteksi **lebih dari satu wajah** di kamera, absensi ditolak.
- Wajah terlalu jauh (lebar < 18% frame) ditolak.
- Template lama (108 dimensi) otomatis dikenali sebagai versi tidak aman dan
  karyawan diminta registrasi ulang — template lama **tidak akan pernah lolos** lagi.
- Registrasi wajah kini gagal kalau penulisan ke Google Sheets gagal (dulu tetap
  dinyatakan "berhasil" walau hanya tersimpan di perangkat).

### Yang masih perlu Anda ketahui
Ini pengenalan wajah, **bukan deteksi anti-foto (liveness)**. Foto wajah di layar HP
yang diarahkan ke kamera masih bisa lolos. Kalau titipan absen lewat foto jadi risiko
nyata di 70 klinik, langkah berikutnya adalah menambahkan liveness challenge
(kedip/menoleh) atau memakai layanan verifikasi berbayar — bisa saya kerjakan terpisah.

---

## Langkah wajib setelah deploy

**1. Deploy ulang Apps Script.**
Buka aplikasi → menu **GAS Code** → salin isi `Code.gs` (dan `SetupSheets.gs` bila perlu)
ke editor Apps Script, lalu **Deploy → Manage deployments → Edit → New version → Deploy**.
Kode lama tidak punya `getTodayStatus` maupun `getAllData` yang baru. Akses tetap:
*Execute as: Me*, *Who has access: Anyone*.

**2. Semua karyawan wajib registrasi ulang wajah.**
Template lama tidak bisa dikonversi karena memang tidak pernah berisi ciri wajah.
Saat Clock In, karyawan dengan template lama otomatis diarahkan ke Registrasi Wajah.

**Catatan jaringan:** model wajah (± 6 MB) diunduh sekali per perangkat dari
`cdn.jsdelivr.net` lalu di-cache browser. Kalau klinik ingin bebas CDN, unduh folder
`model` dari paket `@vladmandic/face-api` ke `public/models/` — kode otomatis memakai
folder lokal itu kalau ada.
