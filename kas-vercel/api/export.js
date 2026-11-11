// GET /api/export  -> seluruh data sebagai JSON (cadangan)
const { handler, toApp, readSettings } = require('../lib/kas');
module.exports = handler({
  GET: async (req, res, sql) => {
    const [rows, settings] = await Promise.all([sql`SELECT * FROM transaksi ORDER BY tanggal, id`, readSettings(sql)]);
    res.json({ versi: 1, diekspor: new Date().toISOString(), settings, tx: rows.map(toApp) });
  },
});
