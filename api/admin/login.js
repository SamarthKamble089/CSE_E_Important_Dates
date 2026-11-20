const { scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { renewSession, sessionExpiry, safeEqual, testingPreview, sessionSecret } = require('../_lib/auth');
const derivePasswordHash = promisify(scrypt);
const previewSalt = '7854465de7d9b7a68a90637e7e986322';
const previewPasswordHash = '7cfb70a11b8a94bb7ca7dfc5b46110f1313aa340e700987d43411792a4b1c491351657dc4c10d0a4e77711879e0aa29d8e74b687bc6b7b1dca9a44f7c63b58a5';

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

  const previewLogin = testingPreview || process.env.CSEE_LOCAL_PREVIEW === '1';
  const username = previewLogin ? 'admin' : process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || (!previewLogin && !password) || !sessionSecret()) {
    return res.status(503).json({ error: 'Admin login is not configured in the deployment environment.' });
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
    if (previewLogin) {
      const hash = await derivePasswordHash(suppliedPassword, previewSalt, 64);
      passwordMatches = safeEqual(hash.toString('hex'), previewPasswordHash);
    } else {
      passwordMatches = safeEqual(suppliedPassword, password);
    }
  }
  if (typeof body?.username !== 'string' || !safeEqual(body.username, username) || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  return res.status(200).json({ success: true, expiresAt: renewSession(res) });
};
