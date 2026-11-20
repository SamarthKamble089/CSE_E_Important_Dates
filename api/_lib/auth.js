const crypto = require('crypto');

const COOKIE_NAME = 'csee_admin_session';
const SESSION_SECONDS = 5 * 60;

const testingPreview = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'testing';
const sessionSecret = () => testingPreview
  ? 'csee-testing-browser-preview-v2'
  : process.env.ADMIN_SESSION_SECRET;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('hex');
}

function createSession(idleExpires) {
  const payload = Buffer.from(JSON.stringify({ idleExpires })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function sessionExpiry(req) {
  if (!sessionSecret()) return false;
  const token = getCookie(req, COOKIE_NAME);
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.idleExpires) && data.idleExpires > Date.now() ? data.idleExpires : false;
  } catch {
    return false;
  }
}

function hasValidSession(req) {
  return Boolean(sessionExpiry(req));
}

function renewSession(res) {
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  setSessionCookie(res, createSession(expiresAt));
  return expiresAt;
}

function setSessionCookie(res, value) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`);
}

function requireAdmin(req, res) {
  if (!hasValidSession(req)) {
    res.status(401).json({ error: 'Please sign in again.' });
    return false;
  }
  return true;
}

module.exports = { renewSession, sessionExpiry, clearSessionCookie, requireAdmin, safeEqual, testingPreview, sessionSecret };
