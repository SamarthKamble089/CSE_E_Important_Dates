const { scrypt, randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const { renewSession, readSession, safeEqual, sessionSecret, demoMode, SESSION_SECONDS } = require('../_lib/auth');
const { sharedSchedule, acquireEditor, ownsEditor, renewEditor } = require('../_lib/shared-schedule');
const previewCredentials = require('../_lib/preview-credentials');
const derivePasswordHash = promisify(scrypt);

async function login(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const session = readSession(req);
  if (req.method === 'GET') {
    const authenticated = Boolean(session && (demoMode || (sharedSchedule && await ownsEditor(session.id))));
    return res.status(200).json({ authenticated, expiresAt: authenticated ? session.idleExpires : null });
  }
  if (req.method === 'PATCH') {
    const expiresAt = Date.now() + SESSION_SECONDS * 1000;
    if (!session || !(demoMode || (sharedSchedule && await renewEditor(session.id, SESSION_SECONDS)))) {
      return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    }
    return res.status(200).json({ expiresAt: renewSession(res, session.id, expiresAt) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const username = demoMode ? previewCredentials.username : process.env.ADMIN_USERNAME;
  const hashSetting = demoMode ? previewCredentials.passwordHash : process.env.ADMIN_PASSWORD_HASH;
  const hash = hashSetting?.match(/^([0-9a-f]{32}):([0-9a-f]{128})$/);
  const password = process.env.ADMIN_PASSWORD;
  if (!(demoMode || sharedSchedule) || !username || !(hashSetting ? hash : password) || !sessionSecret()) {
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

  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  const id = session ? session.id : randomUUID();
  if (sharedSchedule) {
    const acquired = await acquireEditor(id, SESSION_SECONDS);
    if (!acquired && !(session && await renewEditor(id, SESSION_SECONDS))) {
      return res.status(409).json({ error: 'Another admin is using the editor. Please wait and try again.' });
    }
  }
  return res.status(200).json({ success: true, expiresAt: renewSession(res, id, expiresAt) });
}

module.exports = async function handler(req, res) {
  try {
    return await login(req, res);
  } catch {
    return res.status(503).json({ error: 'Shared admin access is temporarily unavailable. Try again shortly.' });
  }
};
