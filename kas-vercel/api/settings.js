// PUT /api/settings -> saldo awal, nama pihak, persen bagi hasil, nama kantin
const { handler, cleanSettings, readSettings, saveSettings } = require('../lib/kas');
module.exports = handler({
  PUT: async (req, res, sql) => {
    await saveSettings(sql, { ...(await readSettings(sql)), ...cleanSettings(req.body) });
    res.json({ ok: true });
  },
});
