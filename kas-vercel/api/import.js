// POST /api/import -> impor {settings, tx} (dari localStorage atau file cadangan); hanya jika database kosong
const { handler, err, clean, cleanSettings, readSettings, saveSettings, insertTx } = require('../lib/kas');
module.exports = handler({
  POST: async (req, res, sql) => {
    const { settings, tx } = req.body || {};
    if (!Array.isArray(tx)) throw err(400, 'Format data tidak valid');
    if ((await sql`SELECT COUNT(*)::int AS n FROM transaksi`)[0].n > 0)
      throw err(409, 'Database sudah berisi data; impor dibatalkan agar tidak ganda');
    const rows = []; let skipped = 0;
    for (const x of tx) { try { rows.push(clean(x)); } catch { skipped++; } }
    const stmts = rows.map(c => insertTx(sql, c));
    if (settings) stmts.push(saveSettings(sql, { ...(await readSettings(sql)), ...cleanSettings(settings) }));
    if (stmts.length) await sql.transaction(stmts);   // semua berhasil, atau tidak sama sekali
    res.json({ ok: true, imported: rows.length, skipped });
  },
});
