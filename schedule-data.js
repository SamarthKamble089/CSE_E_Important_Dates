const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQna8mqQHD8QTbdWRZs2ab7kqoYn0aEC_PwzICdqFb5g3rvitO0GEmrhSah2YARstImEAwdNA5EBmy/pub?output=csv';

// Format 12-hour AM/PM string
function format12Hour(hours, minutes) {
  const h = hours % 12 || 12;
  const m = String(minutes).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

// Normalize Time string
function normalizeTimeString(rawTime) {
  if (!rawTime) return '11:59 PM';
  const str = String(rawTime).trim();
  if (!str) return '11:59 PM';

  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const period = match12[3] ? match12[3].toUpperCase() : null;
    if (period) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    } else {
      return format12Hour(h, m);
    }
  }

  return str;
}

// Normalize Date string (YYYY-MM-DD)
function normalizeDateString(rawDate) {
  if (!rawDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;

  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return rawDate;
}

// Parse Plain Text Schedules (schedules.txt or Google Sheets CSV)
// Supports Pipe (|), Tab (\t), or Comma (,) delimiters and # comments
function parseTxtContent(text) {
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const rows = [];

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    let parts = [];
    if (line.includes('|')) {
      parts = line.split('|').map(s => s.trim().replace(/^["']|["']$/g, ''));
    } else if (line.includes('\t')) {
      parts = line.split('\t').map(s => s.trim().replace(/^["']|["']$/g, ''));
    } else if (line.includes(',')) {
      // Split CSV respecting quotes
      const matches = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          matches.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += c;
        }
      }
      matches.push(current.trim().replace(/^["']|["']$/g, ''));
      parts = matches;
    } else {
      continue;
    }

    // Skip header line
    if (/^(?:#|serial(?: number)?|s\.?\s*no\.?|sn)$/i.test(parts[0]) || /^(?:name|deadline|event name)$/i.test(parts[1]) && !/^\d+$/.test(parts[0])) {
      continue;
    }

    if (parts.length >= 4) {
      const sn = parseInt(parts[0], 10) || (rows.length + 1);
      const name = parts[1] || `Schedule Item ${rows.length + 1}`;
      const subject = parts[2] || 'General';
      const due = normalizeDateString(parts[3] || '');

      let rawTime = parts[4] || '';
      let rawDuration = parts[5] || '';

      const isTimeNull = !rawTime || rawTime.trim().toUpperCase() === 'NULL';
      const isDurationNull = !rawDuration || rawDuration.trim().toUpperCase() === 'NULL';

      let time = isTimeNull ? '' : normalizeTimeString(rawTime);
      let duration = isDurationNull ? '--' : rawDuration;

      rows.push({ sn, name, subject, due, time, duration });
    }
  }

  return rows;
}

if (typeof module !== 'undefined') module.exports = { GOOGLE_SHEETS_CSV_URL, parseTxtContent };
const BROWSER_PREVIEW_KEY = 'csee-testing-preview-deadlines';
