/* Kode bersama untuk semua fungsi di /api: koneksi database, validasi, kata sandi. */
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const err = (status, msg) => Object.assign(new Error(msg), { status });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const METODE = ['rekening', 'qris', 'cash'];

// ---------- Database (Neon Postgres) ----------
let _sql, _ready;
function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw err(503, 'DATABASE_URL belum diatur (Vercel > Storage > sambungkan Neon Postgres ke project ini)');
  return (_sql ??= neon(url));
}
function ensureSchema(sql) {   // membuat tabel jika belum ada (sekali per instance fungsi)
  _ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS transaksi (
      id BIGSERIAL PRIMARY KEY,
      tanggal TEXT NOT NULL,
      jenis TEXT NOT NULL CHECK (jenis IN ('in','out')),
      status TEXT NOT NULL DEFAULT 'lunas' CHECK (status IN ('lunas','belum')),
      tanggal_lunas TEXT,
      metode TEXT NOT NULL DEFAULT '',
      kategori TEXT NOT NULL DEFAULT '',
      uraian TEXT NOT NULL DEFAULT '',
      pihak TEXT NOT NULL DEFAULT '',
      jumlah BIGINT NOT NULL CHECK (jumlah > 0),
      dibuat TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON transaksi (tanggal)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transaksi_status ON transaksi (status)`;
    await sql`CREATE TABLE IF NOT EXISTS pengaturan (kunci TEXT PRIMARY KEY, nilai TEXT NOT NULL)`;
  })().catch(e => { _ready = undefined; throw e; });
  return _ready;
}

// ---------- Kata sandi (wajib: alamat Vercel bisa dibuka siapa saja) ----------
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
function auth(req) {
  const key = process.env.KAS_KEY;
  if (!key) throw err(503, 'KAS_KEY belum diatur di Vercel (Settings > Environment Variables)');
  if (!crypto.timingSafeEqual(sha(req.headers['x-kas-key'] || ''), sha(key))) throw err(401, 'Kata sandi salah atau belum diisi');
}

// pembungkus semua endpoint: metode HTTP -> fungsi, kata sandi, skema, penanganan error
const handler = methods => async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const fn = methods[req.method];
    if (!fn) { res.setHeader('Allow', Object.keys(methods).join(', ')); throw err(405, 'Metode tidak didukung'); }
    auth(req);
    const sql = getSql();
    await ensureSchema(sql);
    await fn(req, res, sql);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Kesalahan server' });
  }
};

// ---------- Validasi & pemetaan (kolom DB <-> field frontend) ----------
function clean(b = {}) {
  const tanggal = String(b.d || '');
  const jenis = b.t;
  const status = b.s === 'belum' ? 'belum' : 'lunas';
  const jumlah = Math.round(Number(b.a));
  const pihak = String(b.p || '').trim().slice(0, 100);
  if (!DATE.test(tanggal)) throw err(400, 'Tanggal tidak valid (format YYYY-MM-DD)');
  if (jenis !== 'in' && jenis !== 'out') throw err(400, 'Jenis harus "in" (pemasukan) atau "out" (pengeluaran)');
  if (!(jumlah > 0)) throw err(400, 'Jumlah harus lebih dari 0');
  if (status === 'belum' && !pihak) throw err(400, 'Nama pelanggan/pemasok wajib untuk transaksi belum lunas');
  return {
    tanggal, jenis, status,
    tanggal_lunas: status === 'lunas' && DATE.test(b.dp || '') ? b.dp : null,
    metode: jenis === 'in' && METODE.includes(b.m) ? b.m : '',
    kategori: String(b.c || '').trim().slice(0, 100),
    uraian: String(b.k || '').trim().slice(0, 255),
    pihak, jumlah,
  };
}
const toApp = r => ({
  id: Number(r.id), d: r.tanggal, t: r.jenis, s: r.status, dp: r.tanggal_lunas || undefined,
  m: r.metode, c: r.kategori, k: r.uraian, p: r.pihak, a: Number(r.jumlah),   // BIGINT dari Postgres berupa string -> angka
});
function cleanSettings(b = {}) {
  const o = {};
  if (b.init !== undefined) o.init = Math.round(Number(b.init)) || 0;
  if (b.pA !== undefined) o.pA = Math.min(100, Math.max(0, Number(b.pA) || 0));
  for (const k of ['nA', 'nB', 'nk']) if (b[k] !== undefined) o[k] = String(b[k]).slice(0, 100);
  return o;
}
async function readSettings(sql) {
  const r = await sql`SELECT nilai FROM pengaturan WHERE kunci = 'app'`;
  return r.length ? JSON.parse(r[0].nilai) : {};
}
const saveSettings = (sql, obj) => sql`INSERT INTO pengaturan (kunci, nilai) VALUES ('app', ${JSON.stringify(obj)})
  ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai`;
const insertTx = (sql, c) => sql`INSERT INTO transaksi (tanggal, jenis, status, tanggal_lunas, metode, kategori, uraian, pihak, jumlah)
  VALUES (${c.tanggal}, ${c.jenis}, ${c.status}, ${c.tanggal_lunas}, ${c.metode}, ${c.kategori}, ${c.uraian}, ${c.pihak}, ${c.jumlah})
  RETURNING id`;
const idOf = req => { const id = Number(req.query.id); if (!Number.isInteger(id)) throw err(400, 'ID tidak valid'); return id; };

module.exports = { err, handler, clean, toApp, cleanSettings, readSettings, saveSettings, insertTx, idOf };
