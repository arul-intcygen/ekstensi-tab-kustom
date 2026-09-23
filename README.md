# Cozy Haven Tab

Tab baru Chrome yang hangat: shortcut tanpa batas, to-do harian, catatan cepat, cuaca real-time, dan empat tema visual — semuanya berjalan 100% lokal tanpa server maupun akun.

> Dibangun dengan Vanilla JavaScript (ES Modules), tanpa framework, tanpa build step.

---

## Fitur

### Pusat Navigasi & Shortcut
- Tambah, ubah, hapus shortcut kustom dengan nama, URL, keterangan, dan kategori
- Pengelompokan shortcut ke dalam kategori yang bisa dibuat/dihapus bebas
- Mode urutan kustom — seret (drag & drop) untuk menyusun ulang shortcut
- Favicon otomatis via Google Favicon API, dengan fallback huruf berwarna untuk domain lokal/tanpa ikon
- Saat pertama kali dipakai, shortcut awal diambil otomatis dari situs teratas Chrome (`chrome.topSites`)
- Kategori terakhir yang dipilih otomatis tersimpan dan dimuat kembali di tab berikutnya

### Rencana & Target Harian
- To-do list dengan sistem prioritas (bintang)
- Sistem XP: +10 per tugas selesai, otomatis naik "peringkat bintang" pulau pribadi
- Tugas yang selesai dibersihkan otomatis keesokan harinya; yang belum selesai tetap terbawa
- Tombol "Bersihkan yang selesai" untuk merapikan daftar

### Statistik Penggunaan
- **Sering Dibuka Minggu Ini** — 3 shortcut paling sering diklik dalam 7 hari terakhir, lengkap dengan tren naik/turun dibanding minggu sebelumnya
- **Kerapian Tab** — meteran visual berdasarkan jumlah tab yang sedang terbuka (`chrome.tabs.query`)

### Catatan Meja Kerja
- Textarea bebas dengan auto-save ke penyimpanan lokal (debounce 400ms)
- Tombol hapus catatan dengan opsi "Urungkan"

### Cuaca & Waktu
- Cuaca real-time via [Open-Meteo](https://open-meteo.com/) (tanpa API key)
- Kota bisa diganti lewat pengaturan; pencarian lokasi otomatis via Open-Meteo Geocoding
- Cache cuaca 30 menit agar hemat request
- Jam, tanggal (format Indonesia), dan label zona waktu otomatis (WIB/WITA/WIT)
- Indikator musim kasar (hujan/kemarau) berdasarkan bulan berjalan

### Empat Tema Visual
| Tema | Mode | Deskripsi |
|---|---|---|
| **Cozy Haven** | Terang/Gelap | Hijau hutan & krem hangat (tema bawaan) |
| **Hollow Knight** | Terang/Gelap | Gua berkabut, teal & cahaya kunang-kunang |
| **Minimalist Focus** | Terang/Gelap | Monokrom bersih, ikon grayscale yang berwarna saat hover |
| **Moss Grotto Rest** | Satu mode | Gua lumut zamrud & sutra crimson (terinspirasi Hollow Knight: Silksong) |

Mode terang/gelap dan pilihan tema disimpan terpisah, sehingga bisa dikombinasikan bebas — kecuali *Moss Grotto* yang memang dirancang sebagai tema satu mode.

### Backup & Restore
- Ekspor seluruh data (shortcut, kategori, tugas, catatan, pengaturan, XP) ke satu file `.json`
- Impor kembali file backup, termasuk mendukung format lama (array shortcut polos)

### Keyboard Shortcuts
| Tombol | Aksi |
|---|---|
| `/` | Fokus ke kolom pencarian |
| `N` | Tambah shortcut baru |
| `E` | Aktifkan/matikan mode urutan kustom |
| `T` | Ganti mode terang/gelap |
| `Esc` | Tutup dialog aktif |

---

## Teknologi

- **Manifest V3** — menimpa `chrome_url_overrides.newtab`
- **Vanilla JavaScript (ES Modules)** — tanpa dependency, tanpa bundler
- **localStorage** sebagai lapisan penyimpanan tunggal (lihat `js/storage.js`)
- **Open-Meteo API** — cuaca & geocoding, tanpa API key
- Permission minimal: `topSites` (untuk shortcut awal) + host permission ke domain Open-Meteo

---

## Struktur Proyek

```
.
├── manifest.json              # Konfigurasi ekstensi (Manifest V3)
├── index.html                 # Struktur halaman tab baru
├── theme-init.js              # Memasang mode & tema sebelum halaman digambar (anti-kedip)
├── script.js                  # Logika utama: state, render, event handler
├── style.css                  # Token warna & layout dasar (tema Cozy Haven)
├── js/
│   ├── config.js               # Konstanta bersama (kunci storage, daftar tema)
│   ├── storage.js               # Satu-satunya pintu ke localStorage
│   ├── utils.js                  # Helper DOM & ikon SVG
│   └── features/
│       └── themes.js             # Logika mode terang/gelap & pemilihan tema
└── themes/
    ├── hollow-knight.css
    ├── moss-grotto.css
    └── minimalist.css
```

---

## Instalasi (Mode Developer)

1. Clone atau unduh repositori ini
2. Buka `chrome://extensions` di browser berbasis Chromium (Chrome, Brave, Edge, dll.)
3. Aktifkan **Developer mode** (pojok kanan atas)
4. Klik **Load unpacked**, lalu pilih folder proyek ini
5. Buka tab baru — ekstensi otomatis aktif menggantikan halaman tab baru bawaan

---

## Arsitektur Singkat

Alur kerja aplikasi mengikuti pola searah yang konsisten:

```
state (data) → render*() (menggambar ulang) → event handler (mengubah data) → simpan → render ulang
```

Beberapa prinsip desain yang dipegang di seluruh kode:

- **Satu pintu penyimpanan** — semua baca/tulis data melewati `js/storage.js`, memudahkan migrasi ke `chrome.storage` di masa depan tanpa menyentuh logika lain
- **Tema = variabel CSS** — setiap file di `themes/` hanya menimpa custom property warna; komponen tidak perlu tahu tema apa yang aktif
- **Anti-flicker tema** — `theme-init.js` berjalan sinkron sebelum `<body>` digambar, agar tidak ada kedipan warna tema yang salah saat halaman dimuat

---

## Menambah Tema Baru

1. Buat file baru di `themes/nama-tema.css`, menimpa custom property warna dengan selector `:root[data-skin="nama-tema"]`
2. Tambahkan satu `<link>` untuk file tersebut di `index.html`, setelah `style.css`
3. Daftarkan tema di array `THEMES` pada `js/config.js` (id, nama, deskripsi, warna pratinjau)

---

## Catatan & Keterbatasan

- Seluruh data tersimpan **lokal per perangkat** (`localStorage`) — belum ada sinkronisasi otomatis antar perangkat
- Backup/restore saat ini bersifat manual lewat file `.json`
- Kapasitas `localStorage` terbatas (umumnya 5–10MB tergantung browser), lebih dari cukup untuk penggunaan wajar

---

## Lisensi

Proyek pribadi — silakan sesuaikan lisensi sesuai kebutuhan sebelum dipublikasikan.
