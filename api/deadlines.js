const { GOOGLE_SHEETS_CSV_URL, parseTxtContent } = require('../schedule-data');
const { requireAdmin, testingPreview } = require('./_lib/auth');

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

function serialize(items) {
  const lines = [
    '# CSE - Section E Important Dates & Schedules',
    '# Format: Serial Number | Name | Subject | Due Date | Due Time | Duration',
    MANAGED_MARKER,
    ''
  ];
  for (const item of items) {
    lines.push([item.sn, item.name, item.subject, item.due, item.time || '', item.duration || '--'].join(' | '));
  }
  return `${lines.join('\n')}\n`;
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
  const sheet = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: 'no-store' });
  if (!sheet.ok) throw new Error('Could not load the published Google Sheet.');
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
  if (testingPreview) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Preview edits are saved in your browser.' });
    try {
      return res.status(200).json({ items: await readSheet(), version: 'browser-preview' });
    } catch (error) {
      return res.status(502).json({ error: error.message });
    }
  }
  if (!token) return res.status(503).json({ error: 'Schedule storage is not configured for this deployment.' });

  if (req.method === 'GET') {
    try {
      const { items, sha } = await readFile(token);
      return res.status(200).json({ items, version: sha });
    } catch (error) {
      return res.status(502).json({ error: error.message });
    }
  }

  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAdmin(req, res)) return;

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid schedule request.' });
  }
  const items = body?.items;
  if (!/^[a-f0-9]{40}$/.test(body?.version || '')) {
    return res.status(400).json({ error: 'Refresh the schedule before saving.' });
  }
  const validationError = validateItems(items);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPOSITORY}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: 'Update important dates from admin',
        content: Buffer.from(serialize(items), 'utf8').toString('base64'),
        sha: body.version,
        branch: BRANCH
      })
    });
    const result = await response.json();
    if (response.status === 409 || response.status === 422) {
      return res.status(409).json({ error: 'The schedule changed in GitHub. Reload the page and try again.' });
    }
    if (!response.ok) return res.status(502).json({ error: result.message || 'GitHub could not save the schedule.' });
    return res.status(200).json({ version: result.content.sha });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
};
