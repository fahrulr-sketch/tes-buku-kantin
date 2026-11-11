// GET /api/data  -> seluruh transaksi + pengaturan
const { handler, toApp, readSettings } = require('../lib/kas');
module.exports = handler({
  GET: async (req, res, sql) => {
    const [rows, settings] = await Promise.all([sql`SELECT * FROM transaksi ORDER BY tanggal, id`, readSettings(sql)]);
    res.json({ settings, tx: rows.map(toApp) });
  },
});
