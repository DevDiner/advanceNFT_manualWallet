// api/health.js
const { setup } = require("./_common");

module.exports = async (_req, res) => {
  try {
    await setup();
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
