// Cek konfigurasi (tanpa kata sandi, tidak membuka data): /api/health
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    database: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    kunci: Boolean(process.env.KAS_KEY),
  });
};
