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

---

# Perbaikan lanjutan — "Clock Out gagal, katanya belum Clock In"

## Penyebab paling mungkin: NIK tidak cocok saat dibandingkan

Baris Clock In dicari dengan `String(data[i][1]).trim() === String(payload.nik).trim()`.
Masalahnya, **Google Sheets menyimpan NIK yang ditulis lewat `appendRow` sebagai ANGKA**:

| NIK di MANPOWER | Tersimpan di ATTENDANCE | Hasil perbandingan |
|---|---|---|
| `0012` (teks) | `12` (angka) | ❌ tidak cocok |
| `1001` | `1001` | ✅ cocok |
| `202400123456789` | `2.02400123456789E+14` | ❌ tidak cocok |
| `1001 ` (ada spasi) | `1001` | ❌ tidak cocok |

Kalau NIK tidak pernah cocok, sistem tidak akan pernah menemukan baris Clock In —
sehingga Clock Out **selalu** ditolak dengan "Anda belum melakukan Clock In hari ini",
walaupun barisnya jelas terlihat ada di spreadsheet. Ini juga menjelaskan kenapa
fallback lama (yang memindai seluruh riwayat) pun tidak menolong: fallback itu juga
mencocokkan NIK dengan cara yang sama.

## Yang diubah

- `sameNik()` / `nikToText()` di Apps Script dan `nikEquals()` di aplikasi: membandingkan
  NIK dengan mengabaikan spasi, besar-kecil huruf, angka nol di depan, dan notasi ilmiah.
  Dipakai di pencarian absensi, template wajah, dan data karyawan.
- Kolom NIK pada baris absensi baru dipaksa berformat **teks**, jadi tidak berubah lagi.
- `repairAttendanceFormats()` — fungsi sekali jalan di `SetupSheets.gs` untuk membetulkan
  **data lama**: menulis ulang kolom NIK, Date, Time, Created At di ATTENDANCE serta NIK
  di MANPOWER & FACE_REGISTER sebagai teks.

## Alat diagnosa (kalau masih gagal)

Buka di browser, ganti `<NIK>` dengan NIK karyawan yang bermasalah:

```
<URL Web App Anda>/exec?action=diagnose&nik=<NIK>
```

Hasilnya JSON berisi:

- `spreadsheetIdUsed` & `spreadsheetMatchesApp` — memastikan Apps Script menulis ke
  spreadsheet yang sama dengan yang dibaca aplikasi. Kalau `false`, script ter-bind ke
  file lain: itu penyebabnya, dan yang perlu diperbaiki adalah ID/binding-nya.
- `spreadsheetTimeZone` — kalau bukan `Asia/Jakarta`, tanggal memang rawan bergeser.
- `todayStatusForNik` — apa yang dilihat server: `hasClockedIn` / `hasClockedOut`.
- `last10Rows` — 10 baris terakhir, lengkap dengan `nikRaw`, `nikType` (`number` vs
  `string`), `matchesQuery`, `dateRaw`, `dateNormalized`, `isToday`.

Kalau `nikType` bernilai `number` dan `matchesQuery` bernilai `false`, dugaan NIK di atas
terkonfirmasi — jalankan `repairAttendanceFormats()` sekali, lalu coba Clock Out lagi.

## Urutan langkah

1. Salin ulang **`Code.gs`** dan **`SetupSheets.gs`** ke editor Apps Script.
2. Jalankan **`repairAttendanceFormats()`** sekali dari editor (pilih fungsinya → Run).
3. **Deploy → Manage deployments → Edit → New version → Deploy.**
4. Coba Clock Out. Kalau masih gagal, buka URL `?action=diagnose&nik=<NIK>` dan kirimkan
   hasilnya ke saya.

---

# Perubahan ketiga — lokasi, zona waktu, clock out, dan UI

## 1. Lokasi tidak bisa diubah manual

Semua jalan untuk memindahkan lokasi dihapus dari sisi karyawan:

- Tombol **"Set Toko ke GPS Saya"**, **"Mode WFA / Bebas Radius"**, dan **"Simulasi Puri"**
  di modal absensi — dihapus.
- Fungsi `setSimulatedLocation()`, `calibrateLocation()`, dan `toggleUserFlexible()`
  dihapus dari `AppContext`, jadi tidak ada komponen yang bisa memanggilnya lagi.
- Koordinat awal palsu (`Ruko Puri 14m`) dihapus; titik selalu dari `navigator.geolocation`.

Lokasi absensi kini **selalu** hasil `findNearestLocation()`: kantor **ACTIVE** terdekat
dari titik GPS perangkat. Kalau di luar radius, karyawan hanya diberi tahu jaraknya dan
diarahkan mengajukan Izin/Revisi — tidak ada tombol untuk memaksa.

Master lokasi (koordinat, radius, status) tetap bisa diubah admin lewat sheet
LOCATION_MASTER — itu data master, bukan pilihan karyawan.

## 2. Zona waktu WIB / WITA / WIT

Jam absensi **tidak lagi mengambil jam HP karyawan** (bisa diubah manual, bisa beda zona).
Yang dipakai adalah zona waktu **kantor terdekat**:

1. Kolom baru **`Time Zone`** di sheet LOCATION_MASTER (isi `WIB`, `WITA`, atau `WIT`), atau
2. kalau kolom itu kosong → dideteksi otomatis dari garis bujur kantor:
   `< 116°BT = WIB`, `116–134°BT = WITA`, `≥ 134°BT = WIT`.

Berkas baru `src/utils/timezone.ts` menyediakan `dateInZone()`, `timeInZone()`,
`longDateInZone()`, dan `greetingInZone()`. Apps Script ikut menerima tanggal acuan dari
aplikasi (`payload.date`), jadi absen jam 00:30 WITA tidak lagi dihitung sebagai hari
sebelumnya menurut WIB. Label zona tampil di topbar, modal absensi, dan pesan hasil absen.

## 3. Clock Out bisa diulang (menimpa)

Dulu Clock Out kedua ditolak. Sekarang: Clock Out jam 14:00 setelah sebelumnya jam 13:00
akan **menimpa baris OUT hari itu** — `Attendance_clockOut()` menulis ulang baris lama
(`setValues` pada baris yang sama), bukan menambah baris baru. Jadi tetap satu baris OUT
per karyawan per hari, dan yang tersimpan selalu jam terakhir.

Perubahan jamnya tetap tercatat di AUDIT_LOG sebagai **"Clock Out (Revisi)"** lengkap
dengan jam lama → jam baru, sehingga bisa diaudit. Aplikasi memberi pesan
`Clock Out diperbarui: 13:00:12 → 14:05:31 WIB`.

## 4. UI/UX baru

Layout diganti mengikuti contoh yang Anda kirim:

- **Sidebar kiri** (Dashboard, Attendance Log, Requests, Approvals, Admin Panel, plus
  Spreadsheet / GAS Code / Keluar). Di layar kecil jadi drawer dengan tombol hamburger.
- **Topbar** berisi judul halaman, tombol sinkronisasi, notifikasi, dan chip profil
  (nama, level, zona waktu).
- **Sapaan + tanggal**: "Selamat Pagi, <nama>" dengan tanggal panjang dan jam
  `08:42 WIB` yang ikut zona kantor.
- **Hero widget**: tombol besar Check-In/Check-Out (otomatis berubah sesuai status hari
  ini), ringkasan jam masuk/pulang, dan pratinjau kamera (klik untuk mengaktifkan — tidak
  meminta izin kamera diam-diam saat halaman dibuka).
- **Panel peta** memakai OpenStreetMap embed (tanpa API key), menampilkan titik GPS,
  kantor terdekat, jarak, radius, dan akurasi.
- **4 kartu statistik**: Kehadiran %, Tepat Waktu, Terlambat, Izin Disetujui — semuanya
  dihitung dari data nyata bulan berjalan, bukan angka contoh.
- **Log Kehadiran Hari Ini**: tabel Nama / Check-In / Check-Out / Total Jam / Status /
  Lokasi. Karyawan R1 hanya melihat dirinya; R2 ke atas melihat seluruh tim.
- **Grafik Kehadiran Mingguan**: batang 7 hari terakhir dengan tooltip saat disentuh.
- **Halaman Attendance Log** baru: filter bulan, pencarian nama/NIK, kolom verifikasi wajah.

Catatan: "Sisa Cuti" pada contoh Anda saya ganti menjadi **Izin Disetujui**, karena di
spreadsheet belum ada data kuota cuti per karyawan. Kalau kuota cuti mau ditampilkan,
tambahkan kolom (mis. `Leave Quota`) di sheet MANPOWER dan saya sambungkan.

## Deploy ulang lagi

Sheet LOCATION_MASTER dapat kolom baru dan Apps Script dapat logika baru, jadi:

1. Salin ulang `Code.gs` **dan** `SetupSheets.gs` (ada di folder `apps-script/`).
2. Tambahkan kolom **`Time Zone`** di kolom I sheet LOCATION_MASTER, isi `WIB`/`WITA`/`WIT`
   (boleh dikosongkan — akan dideteksi dari bujur).
3. Deploy → Manage deployments → Edit → **New version** → Deploy.
