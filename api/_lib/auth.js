const crypto = require('crypto');
const { sessionKey: previewSessionKey } = require('./preview-credentials');
const { sharedSchedule } = require('./shared-schedule');

const COOKIE_NAME = 'csee_admin_session';
const SESSION_SECONDS = 5 * 60;

const testingPreview = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'testing';
const demoMode = !sharedSchedule && (testingPreview || process.env.CSEE_LOCAL_PREVIEW === '1');
const sessionSecret = () => process.env.ADMIN_SESSION_SECRET || (demoMode && testingPreview ? previewSessionKey : undefined);

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

function createSession(id, idleExpires) {
  const payload = Buffer.from(JSON.stringify({ id, idleExpires })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  if (!sessionSecret()) return false;
  const token = getCookie(req, COOKIE_NAME);
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.id === 'string' && Number.isFinite(data.idleExpires) && data.idleExpires > Date.now()
      ? data : false;
  } catch {
    return false;
  }
}

function renewSession(res, id, expiresAt = Date.now() + SESSION_SECONDS * 1000) {
  setSessionCookie(res, createSession(id, expiresAt));
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

module.exports = { renewSession, readSession, clearSessionCookie, safeEqual, demoMode, sessionSecret, SESSION_SECONDS };
