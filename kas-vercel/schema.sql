-- Opsional: tabel dibuat OTOMATIS oleh API saat pertama dipakai.
-- Jalankan manual di Neon SQL Editor hanya jika ingin membuatnya lebih dulu.
CREATE TABLE IF NOT EXISTS transaksi (
  id            BIGSERIAL PRIMARY KEY,
  tanggal       TEXT        NOT NULL,                                 -- YYYY-MM-DD
  jenis         TEXT        NOT NULL CHECK (jenis IN ('in','out')),   -- in = pemasukan, out = pengeluaran
  status        TEXT        NOT NULL DEFAULT 'lunas' CHECK (status IN ('lunas','belum')),
  tanggal_lunas TEXT,                                                 -- NULL = sama dengan tanggal
  metode        TEXT        NOT NULL DEFAULT '',                      -- rekening | qris | cash
  kategori      TEXT        NOT NULL DEFAULT '',
  uraian        TEXT        NOT NULL DEFAULT '',
  pihak         TEXT        NOT NULL DEFAULT '',                      -- pelanggan / pemasok
  jumlah        BIGINT      NOT NULL CHECK (jumlah > 0),              -- Rupiah
  dibuat        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON transaksi (tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_status  ON transaksi (status);
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL
);
