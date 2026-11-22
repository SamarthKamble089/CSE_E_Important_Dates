const { clearSessionCookie, readSession } = require('../_lib/auth');
const { releaseEditor, sharedSchedule } = require('../_lib/shared-schedule');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const session = readSession(req);
  try {
    if (sharedSchedule && session) await releaseEditor(session.id);
  } catch {
    return res.status(503).json({ error: 'Could not release the editing lock. Try signing out again.' });
  }
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
};
