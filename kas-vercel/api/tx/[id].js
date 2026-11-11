// PUT /api/tx/:id     -> ubah transaksi (mis. Lunasi)
// DELETE /api/tx/:id  -> hapus satu transaksi
const { handler, err, clean, idOf } = require('../../lib/kas');
module.exports = handler({
  PUT: async (req, res, sql) => {
    const id = idOf(req), c = clean(req.body);
    const r = await sql`UPDATE transaksi SET tanggal = ${c.tanggal}, jenis = ${c.jenis}, status = ${c.status},
      tanggal_lunas = ${c.tanggal_lunas}, metode = ${c.metode}, kategori = ${c.kategori}, uraian = ${c.uraian},
      pihak = ${c.pihak}, jumlah = ${c.jumlah} WHERE id = ${id} RETURNING id`;
    if (!r.length) throw err(404, 'Transaksi tidak ditemukan');
    res.json({ ok: true });
  },
  DELETE: async (req, res, sql) => {
    const r = await sql`DELETE FROM transaksi WHERE id = ${idOf(req)} RETURNING id`;
    if (!r.length) throw err(404, 'Transaksi tidak ditemukan');
    res.json({ ok: true });
  },
});
