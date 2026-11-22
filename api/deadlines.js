const { readFile: readBundledFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { GOOGLE_SHEETS_CSV_URL, parseTxtContent } = require('../schedule-data');
const { readSession, demoMode } = require('./_lib/auth');
const { sharedSchedule, readSharedSchedule, writeSharedSchedule } = require('./_lib/shared-schedule');
const googleSchedule = require('../site-config');

const OWNER = process.env.GITHUB_OWNER || 'SamarthKamble089';
const REPOSITORY = process.env.GITHUB_REPOSITORY || 'CSE_E_Important_Dates';
const FILE_PATH = process.env.SCHEDULES_FILE || 'schedules.txt';

const BRANCH = 'testing';
const MANAGED_MARKER = '# Managed by the deadline editor.';

function parseScheduleText(text) {
  return String(text).split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const parts = trimmed.split('|').map((part) => part.trim());
    if (parts.length < 4) return [];
    return [{
      sn: Number(parts[0]) || 0,
      name: parts[1] || '',
      subject: parts[2] || 'General',
      due: parts[3] || '',
      time: parts[4] || '',
      duration: parts[5] || '--'
    }];
  });
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length > 500) return 'Send a list of at most 500 deadlines.';
  for (const [index, item] of items.entries()) {
    if (!item || !Number.isInteger(Number(item.sn)) || Number(item.sn) < 1) return `Row ${index + 1}: serial number must be a positive number.`;
    for (const field of ['name', 'subject', 'due', 'time', 'duration']) {
      const value = String(item[field] ?? '').trim();
      if (!value && field !== 'time' && field !== 'duration') return `Row ${index + 1}: ${field} is required.`;
      if (/[|\r\n]/.test(value)) return `Row ${index + 1}: ${field} cannot contain a pipe or line break.`;
      if (value.length > 160) return `Row ${index + 1}: ${field} is too long.`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.due))) return `Row ${index + 1}: choose a valid due date.`;
  }
  return '';
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

async function readSheet() {
  const sheet = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!sheet.ok || sheet.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Could not load the published Google Sheet.');
  }
  return parseTxtContent(await sheet.text());
}

async function readFile(token) {
  const url = `https://api.github.com/repos/${OWNER}/${REPOSITORY}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const response = await fetch(url, { headers: githubHeaders(token), cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read schedules from GitHub (${response.status}).`);
  const file = await response.json();
  const content = Buffer.from(file.content, 'base64').toString('utf8');
  if (content.split(/\r?\n/).includes(MANAGED_MARKER)) {
    return { items: parseScheduleText(content), sha: file.sha };
  }
  return { items: await readSheet(), sha: file.sha };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const token = process.env.GITHUB_TOKEN;
  if (googleSchedule.feedUrl && process.env.CSEE_LOCAL_PREVIEW !== '1') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Use the Google-hosted editor to save deadlines.' });
    try {
      const response = await fetch(googleSchedule.feedUrl, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Schedule feed unavailable.');
      const { text } = await response.json();
      if (typeof text !== 'string') throw new Error('Invalid schedule feed.');
      return res.status(200).json({ items: parseTxtContent(text), shared: true });
    } catch {
      return res.status(502).json({ error: 'Could not load the Drive schedule.', shared: true });
    }
  }
  if (req.method === 'GET') {
    try {
      if (sharedSchedule) {
        const [version, items] = await readSharedSchedule();
        if (version) return res.status(200).json({ items: JSON.parse(items), version, shared: true });
      }
      if (sharedSchedule || demoMode) {
        const snapshot = await readBundledFile(path.join(__dirname, '..', 'schedules.txt'), 'utf8');
        return res.status(200).json({
          items: parseTxtContent(snapshot),
          version: sharedSchedule ? 'initial' : 'browser-preview',
          shared: sharedSchedule
        });
      }
      if (!token) return res.status(503).json({ error: 'Schedule storage is not configured for this deployment.' });
      const { items, sha } = await readFile(token);
      return res.status(200).json({ items, version: sha });
    } catch {
      return res.status(502).json({ error: 'Could not load the schedule.', shared: sharedSchedule });
    }
  }

  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed.' });
  if (!sharedSchedule) return res.status(405).json({ error: 'Shared editing is not configured.' });
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid schedule request.' });
  }
  const items = body?.items;
  if (typeof body?.version !== 'string' || !/^(initial|[a-f0-9-]{36})$/.test(body.version)) {
    return res.status(400).json({ error: 'Refresh the schedule before saving.' });
  }
  const validationError = validateItems(items);
  if (validationError) return res.status(400).json({ error: validationError });
  const sanitized = items.map((item, index) => ({
    sn: index + 1,
    name: String(item.name).trim(),
    subject: String(item.subject).trim(),
    due: String(item.due),
    time: String(item.time ?? '').trim(),
    duration: String(item.duration ?? '').trim()
  }));

  try {
    const version = randomUUID();
    const result = await writeSharedSchedule(session.id, body.version, version, sanitized);
    if (result === 'expired') return res.status(401).json({ error: 'Your editing session expired. Please sign in again.' });
    if (result === 'conflict') return res.status(409).json({ error: 'The schedule changed. Refresh the editor before saving again.' });
    if (result !== 'saved') throw new Error('Unexpected storage response.');
    return res.status(200).json({ version });
  } catch {
    return res.status(502).json({ error: 'Could not save the shared schedule. Try refreshing before retrying.' });
  }
};
