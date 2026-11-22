const { scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { renewSession, sessionExpiry, safeEqual, sessionSecret, testingPreview } = require('../_lib/auth');
const previewCredentials = require('../_lib/preview-credentials');
const derivePasswordHash = promisify(scrypt);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const expiresAt = sessionExpiry(req);
    return res.status(200).json({ authenticated: Boolean(expiresAt), expiresAt });
  }
  if (req.method === 'PATCH') {
    if (!sessionExpiry(req)) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    return res.status(200).json({ expiresAt: renewSession(res) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const usePreviewCredentials = testingPreview || process.env.CSEE_LOCAL_PREVIEW === '1';
  const username = usePreviewCredentials ? previewCredentials.username : process.env.ADMIN_USERNAME;
  const hashSetting = usePreviewCredentials ? previewCredentials.passwordHash : process.env.ADMIN_PASSWORD_HASH;
  const hash = hashSetting?.match(/^([0-9a-f]{32}):([0-9a-f]{128})$/);
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !(hashSetting ? hash : password) || !sessionSecret()) {
    return res.status(503).json({ error: 'Admin sign-in settings are missing or invalid on this deployment.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid sign-in request.' });
  }
  const suppliedPassword = body?.password;
  let passwordMatches = false;
  if (typeof suppliedPassword === 'string' && suppliedPassword.length <= 256) {
    if (hash) {
      const [, salt, expected] = hash;
      const derived = await derivePasswordHash(suppliedPassword, Buffer.from(salt, 'hex'), 64);
      passwordMatches = safeEqual(derived.toString('hex'), expected);
    } else {
      passwordMatches = safeEqual(suppliedPassword, password);
    }
  }
  if (typeof body?.username !== 'string' || !safeEqual(body.username, username) || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  return res.status(200).json({ success: true, expiresAt: renewSession(res) });
};
