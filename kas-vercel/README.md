# Buku Kas Harian – Versi Vercel

Frontend statis (`public/`) + fungsi serverless (`api/`) + database **Neon Postgres**.
Vercel tidak punya disk permanen, jadi database SQLite pada `kas-server` diganti Postgres.
Seluruh API dilindungi **kata sandi** (`KAS_KEY`) karena alamat Vercel bisa dibuka siapa saja.

```
kas-vercel/
├─ api/              ← fungsi serverless (satu berkas = satu endpoint)
│  ├─ data.js        GET  /api/data
│  ├─ export.js      GET  /api/export      (cadangan JSON)
│  ├─ import.js      POST /api/import      (hanya jika database kosong)
│  ├─ settings.js    PUT  /api/settings
│  ├─ health.js      GET  /api/health      (cek konfigurasi, tanpa sandi)
│  └─ tx/index.js, tx/[id].js   POST/DELETE /api/tx, PUT/DELETE /api/tx/:id
├─ lib/kas.js        ← koneksi database, validasi, cek kata sandi
├─ public/           ← frontend (index.html, style.css, app.js, config.js)
├─ schema.sql        ← skema tabel (opsional; dibuat otomatis oleh API)
├─ vercel.json
└─ package.json
```

## Deploy (lewat GitHub – paling mudah)

1. Unggah isi folder ini ke repositori GitHub (disarankan **private**).
2. Di vercel.com: **Add New → Project** → pilih repositori.
   *Framework Preset*: **Other**. Kosongkan *Build Command*. Klik **Deploy**.
3. Buka project → tab **Storage** → **Create Database** → pilih **Neon (Postgres)** → pilih region **Singapore** → **Connect to Project**.
   Langkah ini menambahkan `DATABASE_URL` ke project secara otomatis.
4. **Settings → Environment Variables** → tambahkan `KAS_KEY` berisi kata sandi pilihan Anda (centang Production, Preview, Development).
5. **Deployments →** titik tiga di deployment terbaru **→ Redeploy** (variabel baru baru terbaca setelah redeploy).
6. Buka alamat project. Masukkan kata sandi saat diminta; di bawah judul akan tertulis **● Database terhubung**.

Cek cepat: buka `https://NAMA-PROJECT.vercel.app/api/health` → harus `{"ok":true,"database":true,"kunci":true}`.
Kalau `database` atau `kunci` bernilai `false`, langkah 3 atau 4 belum terbaca (ulangi Redeploy).

Tips: di **Settings → Functions → Function Region** pilih **Singapore (sin1)** agar dekat dengan database dan Jakarta.

### Deploy lewat CLI (alternatif)

```
npm i -g vercel
vercel login
vercel              # sambungkan / buat project
# tambahkan Neon lewat dashboard (langkah 3), lalu:
vercel env add KAS_KEY
vercel --prod
```

## Menjalankan di komputer (opsional)

```
npm i -g vercel
vercel link
vercel env pull .env.local     # mengunduh DATABASE_URL & KAS_KEY
vercel dev                     # http://localhost:3000
```

## Memindahkan data

- **Dari browser (versi tanpa server):** buka tab *Unduh Excel → Pengaturan* → **Kirim data lokal (browser) ke database**.
- **Dari `kas-server` (SQLite lokal):** di sana klik **Unduh cadangan (.json)**, lalu di situs Vercel klik **Pulihkan dari file cadangan (.json)**.

Keduanya hanya berjalan jika database masih **kosong** (agar data tidak ganda).

## Kata sandi

- Kata sandi diminta sekali per perangkat lalu disimpan di browser (`localStorage`, kunci `kas_key`).
- Mengganti kata sandi: ubah `KAS_KEY` di Vercel → Redeploy. Browser akan meminta kata sandi baru.
- Ini satu kata sandi bersama, bukan akun per pengguna. Gunakan kata sandi yang panjang dan unik. HTTPS sudah otomatis dari Vercel.
- Jika `KAS_KEY` belum diatur, API sengaja menolak semua permintaan (503) supaya data tidak terbuka.

## Catatan penting

- **Paket Vercel:** menurut ketentuan Vercel, paket *Hobby* untuk penggunaan pribadi/non-komersial. Jika aplikasi dipakai untuk usaha, cek ketentuan terbaru Vercel dan paket yang sesuai.
- **Neon gratis** akan "tidur" saat lama tidak dipakai, jadi permintaan pertama bisa terasa lebih lambat (sekitar 1–2 detik).
- **Cadangan:** unduh JSON secara berkala lewat **Unduh cadangan (.json)**. Neon juga menyediakan fitur pemulihan data sendiri di dashboard-nya.
- Library Excel (ExcelJS) dimuat dari internet (jsdelivr) oleh `public/index.html`.
