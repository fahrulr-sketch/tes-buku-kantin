// POST /api/tx    -> tambah transaksi
// DELETE /api/tx  -> hapus SEMUA transaksi
const { handler, clean, insertTx } = require('../../lib/kas');
module.exports = handler({
  POST: async (req, res, sql) => {
    const r = await insertTx(sql, clean(req.body));
    res.status(201).json({ id: Number(r[0].id) });
  },
  DELETE: async (req, res, sql) => {
    const r = await sql`DELETE FROM transaksi RETURNING id`;
    res.json({ ok: true, deleted: r.length });
  },
});
