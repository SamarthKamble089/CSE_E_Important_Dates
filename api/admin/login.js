const { createSession, setSessionCookie, safeEqual, hasValidSession, testingPreview, sessionSecret } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.status(200).json({ authenticated: hasValidSession(req) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const username = testingPreview ? 'admin' : process.env.ADMIN_USERNAME;
  const password = testingPreview ? 'admin' : process.env.ADMIN_PASSWORD;
  if (!username || !password || !sessionSecret()) {
    return res.status(503).json({ error: 'Admin login is not configured in the deployment environment.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid sign-in request.' });
  }
  if (!safeEqual(body?.username || '', username) || !safeEqual(body?.password || '', password)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  setSessionCookie(res, createSession());
  return res.status(200).json({ success: true });
};
