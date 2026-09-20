# Resume proyek: ekstensi Chrome tab baru (sebelumnya "Custom NTP")

Dokumen ini adalah serah terima dari sesi sebelumnya dengan Claude. Baca seluruhnya sebelum menyentuh kode.

## 0. Cara memakai dokumen ini

**Kirim ke model baru, dalam urutan ini:**
1. Bagian "Prompt pembuka" (bagian 11) di bawah.
2. Isi **versi terkini** dari `index.html`, `style.css`, `script.js`, `manifest.json` milikku (bukan versi awal dari Claude, lihat peringatan di bawah).
3. Opsional: `design.md` dan screenshot mockup Stitch, jika model perlu acuan visual.

**Peringatan penting:** kode yang dibuat Claude di sesi ini hanya versi dasar. Aku sudah mengubah beberapa hal sendiri (lihat bagian 5), dan Claude belum pernah melihat versi akhirnya. **Sumber kebenaran adalah file di komputerku, bukan dokumen ini.** Kalau ada perbedaan, percayai file.

## 1. Ringkasan proyek

Ekstensi Chrome (Manifest V3) yang menggantikan halaman tab baru. Tampilannya mengikuti desain "Cozy Haven Tab": suasana hangat ala Animal Crossing dan Notion, palet hijau hutan + krem, tata letak bento-grid.

- **Nama lama:** Custom NTP. **Nama saat ini di manifest:** "Cozy Haven Tab" (akan diganti, lihat bagian 8).
- **Bahasa antarmuka:** Indonesia.
- **Batasan:** tanpa build tool, tanpa framework, tanpa server. HTML + CSS + JavaScript biasa, dimuat lewat "Load unpacked" di `chrome://extensions`.

## 2. Struktur file

```
manifest.json   MV3, name "Cozy Haven Tab", version "2.0"
index.html      kerangka halaman + 5 elemen <dialog> + toast
style.css       semua gaya (token warna dari design.md, tema terang/gelap, responsif)
script.js       semua logika (~700 baris)
```

`manifest.json`:
- `chrome_url_overrides.newtab = "index.html"`
- `permissions: ["topSites"]` (hanya untuk mengisi shortcut awal saat pertama kali dipakai)
- `host_permissions`: `https://api.open-meteo.com/*` dan `https://geocoding-api.open-meteo.com/*` (cuaca)
- Tidak ada service worker latar belakang dan tidak ada content script. Ini disengaja agar biaya CPU/memori nol di luar tab baru.

`index.html` memuat `script.js` di `<head>` **tanpa `defer`**, agar tema gelap/terang diterapkan sebelum halaman digambar (mencegah kedip). Aplikasi baru berjalan di event `DOMContentLoaded`.

## 3. Sejarah progres (kronologis)

1. Aku memberi kode awal (tab baru gelap, grid shortcut bulat, tombol "Add"), `design.md`, hasil Stitch, dan gambar inspirasi Animal Crossing. Minta: rombak kode agar sesuai tema.
2. Claude menulis ulang seluruh proyek menjadi 4 file (menambah `style.css`) dan menguji dengan jsdom (bukan Chrome sungguhan).
3. Bar hitam "My Custom New Tab" di bawah layar ternyata **footer bawaan Chrome** (sejak Chrome 138) yang menampilkan ekstensi pengganti tab baru. Tidak bisa dihapus dengan kode. **Sudah kusembunyikan** lewat klik kanan pada footer, lalu "Hide footer on New Tab page".
4. Diskusi beban CPU/memori. Estimasi Claude: mendekati 0% CPU saat idle, sekitar 50–100 MB memori untuk tab itu. **Ini perkiraan, belum diukur.** Aku akan mengukur sendiri.
5. Fitur batas 3 baris shortcut dengan scroll di dalam kartu. **Sudah kuterapkan.**
6. Diskusi celah kiri-kanan dan jumlah kolom otomatis. Penyebabnya `max-width: 1400px` pada `.app`, bukan zoom. **Perbaikan sudah kuterapkan.**
7. Bug sapaan header yang pecah baris (emoji jatuh ke baris baru) di zoom 100%. **Perbaikan sudah kuterapkan.**
8. Panduan `git init`, `.gitignore`, commit pertama, dan push ke GitHub via Git Bash (lihat bagian 7).
9. Daftar saran nama baru untuk proyek (lihat bagian 8).

## 4. Arsitektur kode (`script.js`)

Alur: **state → fungsi `render*()` → event handler mengubah state → simpan ke localStorage → render ulang.**

**Kunci localStorage** (semua di `KEYS`):

| Kunci | Isi |
|---|---|
| `myShortcuts` | array shortcut. **Kunci ini sama dengan versi lama** agar data lama tetap terbaca |
| `cozyCategories` | array nama kategori |
| `cozyTasks` | to-do |
| `cozyNotes` | teks catatan |
| `cozyHits` | riwayat klik per shortcut |
| `cozyXP` | poin XP |
| `cozyTheme` | `"light"` atau `"dark"` |
| `cozySettings` | nama panggilan, nama pulau, kota, lat/lon |
| `cozyWeather` | cache cuaca (30 menit) |

**Model data**
- Shortcut: `{id, name, url, desc, cat}`. Data lama tanpa `id`/`cat` dimigrasi otomatis oleh `sanitizeShortcuts()`. Kategori ditebak sekali dari `CATEGORY_HINTS` (kata kunci nama situs).
- Task: `{id, text, done, priority, doneOn}`. Task selesai dari hari sebelumnya dihapus otomatis saat dimuat. Yang belum selesai terbawa ke hari berikutnya.
- Hits: `{idShortcut: [timestamp, ...]}`, dipangkas ke 14 hari.

**Fitur yang ada**
- Header: sapaan menurut jam, chip musim (hujan Okt–Apr, kemarau Mei–Sep), tanggal, cuaca Open-Meteo, jam, tombol tema, avatar (membuka dialog Pengaturan).
- Pencarian: ke Google. Input yang mirip URL langsung dibuka. Tombol "AI Mode" memakai `udm=50`.
- Profil "Pulau Pribadi": jumlah shortcut, tugas selesai, peringkat bintang (`min(5, 1 + floor(xp/100))`, 10 XP per tugas).
- Kategori: filter, tambah, hapus (shortcut di dalamnya menjadi "tanpa kategori").
- Hub shortcut: tambah/ubah/hapus (hapus punya tombol Urungkan), seret-untuk-urut lewat "Urutan Kustom" (HTML5 drag and drop).
- To-do: tambah, centang, prioritas (bintang), hapus, "Bersihkan yang selesai".
- "Sering Dibuka Minggu Ini": 3 teratas dari `cozyHits` (7 hari), tren dibanding 7 hari sebelumnya.
- Meteran "Kerapian Tab": `chrome.tabs.query({currentWindow:true})`, hanya menghitung jumlah (tidak butuh izin `tabs`). Konstanta `IDEAL_TABS=5`, `MAX_TABS=25`.
- Catatan: autosave 400 ms, dengan Urungkan pada "Hapus Catatan".
- Backup: ekspor/impor JSON (menerima juga format lama berupa array polos).
- Pintasan keyboard: `/` cari, `N` tambah shortcut, `E` mode urutan, `T` tema, `Esc` tutup dialog.
- Dialog memakai elemen `<dialog>` bawaan: `#dlg-shortcut`, `#dlg-category`, `#dlg-settings`, `#dlg-backup`, `#dlg-keys`.

**Ikon shortcut:** `https://www.google.com/s2/favicons?domain_url=...&sz=128`. Jika lebar asli gambar < 32px (`MIN_ICON_PX`) atau hostnya lokal/IP/tanpa titik, diganti tile huruf berwarna.

**Keamanan input:** URL hanya menerima http/https (`normalizeUrl`). Semua teks pengguna dimasukkan lewat `textContent`, bukan `innerHTML`. `innerHTML` hanya dipakai untuk konstanta `ICONS`.

## 5. Perubahan yang sudah kuterapkan sendiri (dilaporkan, belum diverifikasi Claude)

Claude menuliskan ini sebagai panduan dan aku yang mengeditnya di file. Versi akhirnya mungkin sedikit berbeda.

**a. Grid shortcut dibatasi 3 baris** (di `style.css`, blok `.shortcut-grid`):

```css
.shortcut-grid {
    --rows: 3;  --tile-h: 120px;  --gap: 14px;  --pad: 8px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    grid-auto-rows: var(--tile-h);
    gap: var(--gap);
    max-height: calc(var(--rows) * var(--tile-h) + (var(--rows) - 1) * var(--gap) + 2 * var(--pad));
    overflow-y: auto;
    padding: var(--pad);
    margin: calc(-1 * var(--pad));
    scrollbar-width: thin;
    scrollbar-color: var(--stroke) transparent;
    scrollbar-gutter: stable;
}
```

Catatan: `--tile-h: 120px` dihitung dari CSS (tinggi tile ≈ 118px), belum diukur di browser. Jika baris ke-3 terpotong, ukur tinggi `.shortcut-wrap` dengan DevTools dan samakan.

**b. Layout lebih lebar dan responsif terhadap zoom**
- `:root` mendapat `--page-x: clamp(12px, 1.6vw, 28px);`
- `.app`: `max-width: 2000px; padding: 24px var(--page-x) 32px;`
- `.app-footer`: `padding: 12px var(--page-x);`

**c. Perbaikan sapaan header** (sudah kutempel dan Claude konfirmasi benar):

```css
.header { grid-template-columns: minmax(0, 1fr) minmax(320px, 480px) minmax(0, 1fr); }  /* dulu 560px */
.hello-text { min-width: 0; }
.hello h1 { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

Blok `@media (max-width: 1100px)` harus tetap **di bawah** `.header` agar menimpanya.

**d. Data dan pengaturan pribadiku**
- Punya 21 shortcut, dan menambah kategori sendiri "Sosial Media" (selain Koding & AI, Pekerjaan, Belajar, Hiburan & Games).
- Chrome kupakai di zoom 90%. Layar sekitar 1366px lebar.
- Footer Chrome disembunyikan lewat klik kanan.

## 6. Pengetahuan layout yang sudah divalidasi

Kolom grid: `kolom = floor((lebarGrid + 14) / (112 + 14))`. Model ini **cocok dengan dua screenshotku** (7 kolom di zoom 100% dan 7 kolom di 90% dengan kode lama). Proyeksi setelah perbaikan 5b, layar 1366px (perkiraan, bisa meleset satu kolom):

| Zoom | Kolom |
|---|---|
| 125% | 5 |
| 110% | 6 |
| 100% | 7 |
| 90% | 8 |
| 80% | 10 |
| 67% | 12 |

Zoom Chrome mengubah lebar viewport dalam CSS px (`lebar jendela ÷ zoom`). Tata letak sudah otomatis beradaptasi lewat `auto-fill` dan media query. Breakpoint di `style.css`: 1100px, 900px, 640px.

Struktur tata letak: `.app` → `.header` (grid 3 kolom) dan `.layout` (grid `272px` + `1fr`) → `.side` (profil, kategori, tips) dan `.main` (hub shortcut + `.widgets` 3 kolom).

## 7. Status Git / GitHub

- Sudah menjalankan `git init` di Git Bash. Terminal sudah punya akses ke akun GitHub, jadi tidak perlu setelan akun.
- Panduan yang sudah diberikan: buat repo di github.com/new **tanpa** README/.gitignore/license, `git add .`, `git commit`, `git branch -M main`, `git remote add origin <url>`, `git push -u origin main`.
- `.gitignore` yang dianjurkan (berisi file backup pribadi dari fitur Backup Shortcut):

```
cozy-tab-backup-*.json
Thumbs.db
desktop.ini
.DS_Store
```

- Status akhir (apakah sudah berhasil push atau belum) **tidak diketahui Claude**. Tanyakan padaku.
- `manifest.json` harus berada di akar folder yang dijadikan repo.

## 8. Penamaan proyek (belum diputuskan)

Aku ingin nama yang diawali "Ekstensi" atau "Extension", jelas bahwa ini ekstensi, dan **tidak terlalu spesifik pada tema**. Daftar saran:

- **Inggris:** Extension New Tab · Extension Tab Hub · Extension Start Page · Extension Shortcut Hub · Extension Custom Start · Extension Tab Dashboard
- **Indonesia:** Ekstensi Tab Baru · Ekstensi Tab Kustom · Ekstensi Beranda Kustom · Ekstensi Peluncur Shortcut · Ekstensi Pusat Shortcut · Ekstensi NTP Kustom

Jika sudah dipilih, ubah `"name"` di `manifest.json` (tampil di `chrome://extensions`) dan nama repo GitHub. Judul tab di `index.html` saat ini "Tab Baru".

## 9. Yang belum selesai / terbuka

1. **Fitur yang akan ditambah dan dihapus.** Aku akan memberi detailnya satu per satu di sesi berikutnya. Jangan berasumsi apa pun tentang itu.
2. **Pengukuran CPU/memori manual.** Aku akan mengukur sendiri dengan Task Manager Chrome (Shift+Esc, tunggu ±30 detik, bandingkan baris "Tab Baru" dengan tab baru bawaan Chrome) dan melapor. Estimasi Claude di atas belum terbukti.
3. **Keputusan nama proyek** (bagian 8).
4. **Push pertama ke GitHub** (bagian 7).

## 10. Keterbatasan yang perlu diwaspadai

- Claude **tidak pernah menjalankan kode ini di Chrome sungguhan**. Pengujian hanya smoke test di jsdom (inisialisasi, migrasi data lama, kategori, to-do, pelacakan klik, tema, urungkan hapus, validasi URL). Perilaku tata letak CSS diverifikasi lewat perhitungan dan screenshotku, bukan render.
- Jumlah kolom pada tabel bagian 6 mengasumsikan scrollbar halaman 15px dan scrollbar grid 11px.
- Drag-and-drop belum kucoba berulang di kartu yang bisa digulir. Auto-scroll saat menyeret ke tepi belum terverifikasi.
- Font Literata dan Plus Jakarta Sans dimuat dari Google Fonts (perlu internet, ada fallback Georgia dan font sistem). Ikon dan cuaca juga butuh internet. Jika offline, ikon jatuh ke tile huruf dan cuaca disembunyikan.
- Footer bawaan Chrome tidak bisa dihapus dari kode ekstensi. Hanya pengguna yang bisa menyembunyikannya.

## 11. Prompt pembuka (salin ke model baru)

```
Aku sedang mengembangkan ekstensi Chrome (Manifest V3) yang mengganti halaman tab baru
dengan tema "Cozy Haven Tab" (hangat ala Animal Crossing/Notion, hijau hutan + krem).
Tanpa framework atau build tool: HTML + CSS + JS biasa, dimuat lewat "Load unpacked".

Aku pindah dari model AI lain karena batas harian. Di bawah ini kulampirkan:
1. Dokumen resume lengkap (arsitektur, keputusan desain, riwayat progres, status).
2. Versi TERBARU keempat file: index.html, style.css, script.js, manifest.json.
Sumber kebenaran adalah file yang kulampirkan. Jika ada beda dengan resume, percayai file.

Cara kerja yang kuinginkan:
- Jawab dalam Bahasa Indonesia.
- Aku ingin mengetik dan menerapkan perubahan sendiri: pandu aku dengan potongan kode
  yang jelas (nama file + blok mana yang diganti), bukan menulis ulang seluruh file,
  kecuali kuminta.
- Jelaskan konsep dalam dua lapis: analogi sederhana dulu, lalu penjelasan teknis
  (gaya teknik Feynman).
- Jika kuminta "jawab singkat", jawab singkat.
- Beri tahu jika suatu klaim belum kamu uji, dan validasi rekomendasi dengan riset
  bila memungkinkan.
- Jangan mengubah hal di luar permintaan. Aku akan memberi daftar fitur untuk
  ditambah/dihapus satu per satu.

Tugas pertamamu: baca resume dan semua file, lalu ringkas ulang pemahamanmu dalam
maksimal 10 kalimat (struktur file, alur state→render, kunci localStorage, dan hal yang
belum selesai) supaya aku bisa memastikan kamu tidak salah paham. Setelah itu tunggu
instruksiku berikutnya.
```
