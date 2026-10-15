/**
 * CSE - Section E Academic Schedules Portal
 * View-Only Page: Strictly displays Serial Number, Name, Subject, Due Date, Due Time, Duration.
 * Reads dynamically from schedules.txt in the folder.
 * 
 * Auto-filtering & Ordering Rules:
 * 1. Compares each entry's due date & time against the current date & time.
 * 2. Hides all data that is older than 1 day (overdue by > 24 hours).
 * 3. Any item whose due time has passed within that 1-day window (0 to 24h ago) is listed at the END.
 * 4. Active data is arranged chronologically by Due Date and Time (nearest first).
 */

// Fallback initial schedules if fetch is blocked or file not yet loaded
const FALLBACK_SCHEDULES = [
  { sn: 1, name: 'Math Assignment', subject: 'Math', due: '2026-10-18', time: '10:00 AM', duration: '2 Hours' },
  { sn: 2, name: 'Math Quiz', subject: 'Math', due: '2026-10-15', time: '11:59 PM', duration: '30 Minutes' },
  { sn: 3, name: 'Operating system CIE 1 Quiz', subject: 'OS', due: '2026-10-14', time: '02:00 PM', duration: '1 Hour' },
  { sn: 4, name: 'Software Requirements Spec (SRS) Review', subject: 'Software Engineering', due: '2026-10-28', time: '09:30 AM', duration: '30 Minutes' },
  { sn: 5, name: 'Mini Project Phase 1 Code Submission', subject: 'Cloud & Full Stack Lab', due: '2026-11-02', time: '05:00 PM', duration: '3 Days' },
  { sn: 6, name: 'End-Term Practical Lab Exam', subject: 'Operating Systems', due: '2026-11-10', time: '09:00 AM', duration: '3 Hours' }
];

const STORAGE_KEY = 'csee_schedules_cache_v3';
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQna8mqQHD8QTbdWRZs2ab7kqoYn0aEC_PwzICdqFb5g3rvitO0GEmrhSah2YARstImEAwdNA5EBmy/pub?output=csv';

// State
let rawSchedules = [];
let processedSchedules = [];
let searchQuery = '';
let selectedSubject = 'all';
let currentSort = 'datetime-asc';
let showHiddenPast = false;

// DOM Elements
const schedulesTableBody = document.getElementById('schedulesTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const subjectFilter = document.getElementById('subjectFilter');
const sortSelect = document.getElementById('sortSelect');
const refreshBtn = document.getElementById('refreshBtn');
const resultsCount = document.getElementById('resultsCount');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const fileProtocolBanner = document.getElementById('fileProtocolBanner');
const localFileInput = document.getElementById('localFileInput');
const downloadCurrentTxtBtn = document.getElementById('downloadCurrentTxtBtn');
const toastNotification = document.getElementById('toastNotification');
const hiddenStatusBadge = document.getElementById('hiddenStatusBadge');

// Stats Elements
const statTotalCount = document.getElementById('statTotalCount');
const statDueSoon = document.getElementById('statDueSoon');
const statSubjectsCount = document.getElementById('statSubjectsCount');
const syncStatus = document.getElementById('syncStatus');
const syncStatusSub = document.getElementById('syncStatusSub');

// Clock Elements
const liveClock = document.getElementById('liveClock');
const liveDate = document.getElementById('liveDate');

// Init
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTableScale();
  startClock();
  setupEventListeners();
  setupTimetableModal();
  loadSchedulesData();
});

// Theme Manager (Dark & Light Mode, default: Dark)
function initTheme() {
  const darkBtn = document.getElementById('themeDarkBtn');
  const lightBtn = document.getElementById('themeLightBtn');

  function applyTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      try {
        localStorage.setItem('csee_theme', theme);
      } catch (e) {
        console.warn('LocalStorage error saving theme', e);
      }
    }
    if (darkBtn && lightBtn) {
      if (theme === 'light') {
        lightBtn.classList.add('active');
        darkBtn.classList.remove('active');
      } else {
        darkBtn.classList.add('active');
        lightBtn.classList.remove('active');
      }
    }
  }

  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('csee_theme') || 'dark';
  } catch (e) {}

  applyTheme(savedTheme, false);

  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      applyTheme('dark');
      showToast('Switched to Dark Mode 🌙');
    });
  }

  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      applyTheme('light');
      showToast('Switched to Light Mode ☀️');
    });
  }
}

// Table Scale / Density Manager (Small/Phone scale by default)
function initTableScale() {
  const tableCard = document.getElementById('tableCard') || document.querySelector('.table-container-card');
  const compactBtn = document.getElementById('scaleCompactBtn');
  const normalBtn = document.getElementById('scaleNormalBtn');

  function setScale(scale, save = true) {
    if (!tableCard) return;
    if (scale === 'normal') {
      tableCard.classList.remove('scale-compact');
      tableCard.classList.add('scale-normal');
      if (compactBtn) compactBtn.classList.remove('active');
      if (normalBtn) normalBtn.classList.add('active');
    } else {
      tableCard.classList.remove('scale-normal');
      tableCard.classList.add('scale-compact');
      if (compactBtn) compactBtn.classList.add('active');
      if (normalBtn) normalBtn.classList.remove('active');
    }
    if (save) {
      try {
        localStorage.setItem('csee_table_scale', scale);
      } catch (e) {}
    }
  }

  let savedScale = 'compact';
  try {
    savedScale = localStorage.getItem('csee_table_scale') || 'compact';
  } catch (e) {}

  setScale(savedScale, false);

  if (compactBtn) {
    compactBtn.addEventListener('click', () => {
      setScale('compact');
      showToast('Switched to Small / Fit Phone scale 📱');
    });
  }

  if (normalBtn) {
    normalBtn.addEventListener('click', () => {
      setScale('normal');
      showToast('Switched to Regular scale 🖥️');
    });
  }
}

// Helper to abbreviate duration strings for mobile view
function getShortDuration(dur) {
  if (!dur || dur === '--' || dur.trim().toUpperCase() === 'NULL') return '--';
  const s = String(dur).trim();
  if (/^full\s*day/i.test(s)) return 'Full Day';
  return s
    .replace(/\s*minutes?/gi, 'm')
    .replace(/\s*hours?/gi, 'h')
    .replace(/\s*days?/gi, 'd')
    .trim();
}

// Live Clock
function startClock() {
  function updateTime() {
    const now = new Date();
    if (liveClock) {
      liveClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }
    if (liveDate) {
      liveDate.textContent = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// Toast Helper
function showToast(message) {
  if (!toastNotification) return;
  toastNotification.textContent = message;
  toastNotification.classList.add('show');
  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3200);
}

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

// Combine Due Date + Due Time into a JavaScript Date object
function getEventDateTime(dateStr, timeStr) {
  if (!dateStr) return null;

  let hours = 23;
  let minutes = 59;

  if (timeStr) {
    const match = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const period = match[3] ? match[3].toUpperCase() : null;
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    }
  }

  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;

  d.setHours(hours, minutes, 0, 0);
  return d;
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
        if (c === '"' || c === "'") {
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
    if (/serial|s\.?no|subject|due/i.test(parts[0]) || /name/i.test(parts[1])) {
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

// Load Schedules from Google Sheets / schedules.txt / Storage / Fallback
async function loadSchedulesData() {
  const isFileProtocol = window.location.protocol === 'file:';

  // 1. Check if cached in localStorage
  let cachedData = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedData = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not read cached schedules', e);
  }

  // 2. Try fetching from live Google Sheets CSV first
  if (GOOGLE_SHEETS_CSV_URL && !isFileProtocol) {
    try {
      const gResponse = await fetch(GOOGLE_SHEETS_CSV_URL + '&t=' + Date.now());
      if (gResponse.ok) {
        const csvData = await gResponse.text();
        const parsed = parseTxtContent(csvData);
        if (parsed && parsed.length > 0) {
          rawSchedules = parsed;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rawSchedules));
          showToast('Live synced with Google Sheet! 📊');
          processAndRender();
          return;
        }
      }
    } catch (gErr) {
      console.warn('Google Sheets live fetch skipped/unavailable, falling back to local file:', gErr);
    }
  }

  // 3. Fallback: Fetch schedules.txt from repository folder
  try {
    const response = await fetch('schedules.txt?t=' + Date.now());
    if (response.ok) {
      const textData = await response.text();
      const parsed = parseTxtContent(textData);
      if (parsed && parsed.length > 0) {
        rawSchedules = parsed;
        showToast('Loaded schedules from local file');
        processAndRender();
        return;
      }
    }
  } catch (err) {
    console.log('Direct fetch restricted or file not served via HTTP:', err);

    if (isFileProtocol && fileProtocolBanner) {
      fileProtocolBanner.style.display = 'flex';
    }
  }

  // 4. Fallback to cached or predefined data
  if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
    rawSchedules = cachedData;
  } else {
    rawSchedules = [...FALLBACK_SCHEDULES];
  }

  processAndRender();
}

// Format Date & Time Countdown
function formatDisplayDate(dateStr, timeStr) {
  const displayTime = (!timeStr || timeStr.trim().toUpperCase() === 'NULL') ? '--' : timeStr;
  if (!dateStr) return { formatted: 'TBD', timeDisplay: displayTime, countdown: null, status: 'unknown' };

  const target = getEventDateTime(dateStr, timeStr);
  if (!target) {
    return { formatted: dateStr, timeDisplay: displayTime, countdown: null, status: 'unknown' };
  }

  const formatted = target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const monthDay = target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const yearStr = String(target.getFullYear());

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let countdown = { text: '', cls: 'normal' };
  let status = 'upcoming';

  if (diffMs < 0) {
    const hoursAgo = Math.abs(diffHours);
    if (hoursAgo <= 24) {
      status = 'recently-over';
      const roundedHours = Math.round(hoursAgo);
      countdown = { 
        text: roundedHours <= 1 ? 'Passed <1h ago' : `Passed ${roundedHours}h ago`, 
        cls: 'recently-over' 
      };
    } else {
      status = 'expired';
      const daysAgo = Math.floor(hoursAgo / 24);
      countdown = { text: `${daysAgo}d ago`, cls: 'overdue' };
    }
  } else {
    if (diffHours <= 3) {
      countdown = { text: `In ${Math.max(1, Math.round(diffHours))}h!`, cls: 'urgent' };
    } else if (diffDays <= 0 || (diffHours <= 18 && target.getDate() === now.getDate())) {
      countdown = { text: 'Today!', cls: 'urgent' };
    } else if (diffDays === 1) {
      countdown = { text: 'Tomorrow', cls: 'urgent' };
    } else if (diffDays <= 4) {
      countdown = { text: `In ${diffDays} days`, cls: 'urgent' };
    } else if (diffDays <= 10) {
      countdown = { text: `In ${diffDays} days`, cls: 'soon' };
    } else {
      countdown = { text: `In ${diffDays} days`, cls: 'normal' };
    }
  }

  return { formatted, monthDay, yearStr, timeDisplay: timeStr || '11:59 PM', countdown, status, target };
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Process Data, Filter, Sort and Render Table
function processAndRender() {
  updateSubjectDropdown();
  updateStats();
  applyFiltersAndRender();
}

// Populate Subject Filter Dropdown
function updateSubjectDropdown() {
  if (!subjectFilter) return;

  const currentVal = subjectFilter.value || 'all';
  const subjects = [...new Set(rawSchedules.map(item => item.subject).filter(Boolean))].sort();

  subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
  subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub;
    opt.textContent = sub;
    if (sub === currentVal) opt.selected = true;
    subjectFilter.appendChild(opt);
  });
}

// Update Summary Stats Cards
function updateStats() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const validItems = rawSchedules.filter(item => {
    const dt = getEventDateTime(item.due, item.time);
    return dt && dt >= oneDayAgo;
  });

  if (statTotalCount) statTotalCount.textContent = validItems.length;

  const subjects = new Set(validItems.map(item => item.subject).filter(Boolean));
  if (statSubjectsCount) statSubjectsCount.textContent = subjects.size;

  const upcomingItems = validItems
    .map(item => ({ ...item, dt: getEventDateTime(item.due, item.time) }))
    .filter(item => item.dt && item.dt >= now)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime());

  if (statDueSoon) {
    if (upcomingItems.length > 0) {
      const nearest = upcomingItems[0];
      const parsed = nearest.dt;
      statDueSoon.textContent = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      statDueSoon.textContent = 'None';
    }
  }
}

// Apply Filters, Automatic Expiration, and Smart Ordering
function applyFiltersAndRender() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const searchFiltered = rawSchedules.filter(item => {
    if (selectedSubject !== 'all' && item.subject !== selectedSubject) {
      return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name && item.name.toLowerCase().includes(q);
      const matchSub = item.subject && item.subject.toLowerCase().includes(q);
      const matchDuration = item.duration && item.duration.toLowerCase().includes(q);
      const matchTime = item.time && item.time.toLowerCase().includes(q);
      const matchSn = String(item.sn).includes(q);
      if (!matchName && !matchSub && !matchDuration && !matchTime && !matchSn) return false;
    }

    return true;
  });

  const upcomingList = [];
  const recentlyOverList = [];
  const olderThanOneDayList = [];

  searchFiltered.forEach(item => {
    const dt = getEventDateTime(item.due, item.time);
    const enriched = { ...item, dt };

    if (!dt) {
      upcomingList.push(enriched);
      return;
    }

    if (dt >= now) {
      upcomingList.push(enriched);
    } else if (dt >= oneDayAgo) {
      recentlyOverList.push(enriched);
    } else {
      olderThanOneDayList.push(enriched);
    }
  });

  if (hiddenStatusBadge) {
    if (olderThanOneDayList.length > 0) {
      hiddenStatusBadge.style.display = 'inline-flex';
      hiddenStatusBadge.innerHTML = showHiddenPast 
        ? `<span>Showing ${olderThanOneDayList.length} past items (&gt;1d old)</span> &times;`
        : `<span>${olderThanOneDayList.length} past items hidden (&gt;1d old)</span>`;
      hiddenStatusBadge.title = showHiddenPast ? 'Click to re-hide past items' : 'Click to inspect hidden items';
    } else {
      hiddenStatusBadge.style.display = 'none';
    }
  }

  upcomingList.sort((a, b) => {
    switch (currentSort) {
      case 'datetime-asc':
        return (a.dt ? a.dt.getTime() : 9999999999999) - (b.dt ? b.dt.getTime() : 9999999999999);
      case 'datetime-desc':
        return (b.dt ? b.dt.getTime() : 0) - (a.dt ? a.dt.getTime() : 0);
      case 'sn-asc':
        return Number(a.sn) - Number(b.sn);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'subject-asc':
        return a.subject.localeCompare(b.subject);
      default:
        return (a.dt ? a.dt.getTime() : 0) - (b.dt ? b.dt.getTime() : 0);
    }
  });

  recentlyOverList.sort((a, b) => (a.dt ? a.dt.getTime() : 0) - (b.dt ? b.dt.getTime() : 0));

  let finalList = [...upcomingList, ...recentlyOverList];

  if (showHiddenPast && olderThanOneDayList.length > 0) {
    olderThanOneDayList.sort((a, b) => (b.dt ? b.dt.getTime() : 0) - (a.dt ? a.dt.getTime() : 0));
    finalList = [...finalList, ...olderThanOneDayList];
  }

  processedSchedules = finalList;
  renderTable(recentlyOverList.length, olderThanOneDayList.length);
}

// Render Table: 6 COLUMNS
function renderTable(recentlyOverCount = 0, hiddenCount = 0) {
  if (!schedulesTableBody) return;

  if (processedSchedules.length === 0) {
    schedulesTableBody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    if (resultsCount) resultsCount.textContent = '0 active schedules';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  if (resultsCount) {
    let msg = `Showing ${processedSchedules.length} schedules`;
    if (recentlyOverCount > 0) {
      msg += ` (${recentlyOverCount} ended recently listed at bottom)`;
    }
    resultsCount.textContent = msg;
  }

  const htmlRows = processedSchedules.map(item => {
    const dateInfo = formatDisplayDate(item.due, item.time);
    const isRecentlyOver = dateInfo.status === 'recently-over';
    const isExpired = dateInfo.status === 'expired';

    const rowClass = isRecentlyOver 
      ? 'row-recently-passed' 
      : (isExpired ? 'row-expired' : '');

    return `
      <tr class="${rowClass}">
        <td class="col-sn">
          <span class="sn-pill">${escapeHtml(item.sn)}</span>
        </td>

        <td class="col-name">
          <div class="cell-name-wrap">
            <span class="name-icon-bullet ${isRecentlyOver ? 'bullet-overdue' : ''}"></span>
            <div class="name-details">
              <span class="name-text">${escapeHtml(item.name)}</span>
              ${isRecentlyOver ? `<span class="overdue-inline-tag">&bull; Due time passed (within 24h gap)</span>` : ''}
              ${isExpired ? `<span class="expired-inline-tag">&bull; Past item (> 1 day old)</span>` : ''}
            </div>
          </div>
        </td>

        <td class="col-subject">
          <span class="subject-pill" title="${escapeHtml(item.subject)}">
            <span class="subject-dot"></span>
            <span>${escapeHtml(item.subject)}</span>
          </span>
        </td>

        <td class="col-due">
          <div class="due-date-cell">
            <span class="due-date-main">
              <span class="date-md">${escapeHtml(dateInfo.monthDay || dateInfo.formatted)}</span><span class="date-yr">${dateInfo.yearStr ? ', ' + dateInfo.yearStr : ''}</span>
            </span>
            ${dateInfo.countdown ? `<span class="due-countdown-tag ${dateInfo.countdown.cls}">${dateInfo.countdown.text}</span>` : ''}
          </div>
        </td>

        <td class="col-time">
          <span class="due-time-badge ${isRecentlyOver ? 'time-passed' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="due-time-val">${escapeHtml(dateInfo.timeDisplay)}</span>
          </span>
        </td>

        <td class="col-duration">
          <span class="duration-chip" title="${escapeHtml(item.duration)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="dur-full">${escapeHtml(item.duration)}</span>
            <span class="dur-short">${escapeHtml(getShortDuration(item.duration))}</span>
          </span>
        </td>
      </tr>
    `;
  }).join('');

  schedulesTableBody.innerHTML = htmlRows;
}

// Event Listeners
function setupEventListeners() {
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      }
      applyFiltersAndRender();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      applyFiltersAndRender();
      searchInput.focus();
    });
  }

  if (subjectFilter) {
    subjectFilter.addEventListener('change', (e) => {
      selectedSubject = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      showToast('Checking for latest schedules.txt...');
      loadSchedulesData();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      searchQuery = '';
      selectedSubject = 'all';
      currentSort = 'datetime-asc';
      showHiddenPast = false;
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      if (subjectFilter) subjectFilter.value = 'all';
      if (sortSelect) sortSelect.value = 'datetime-asc';
      applyFiltersAndRender();
    });
  }

  if (hiddenStatusBadge) {
    hiddenStatusBadge.addEventListener('click', () => {
      showHiddenPast = !showHiddenPast;
      applyFiltersAndRender();
      showToast(showHiddenPast ? 'Displaying hidden past items' : 'Re-hid past items (> 1 day old)');
    });
  }

  // Local File Upload (.txt or .csv)
  if (localFileInput) {
    localFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const textContent = evt.target.result;
        const parsed = parseTxtContent(textContent);
        if (parsed && parsed.length > 0) {
          rawSchedules = parsed;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rawSchedules));
          if (syncStatus) syncStatus.textContent = file.name;
          if (syncStatusSub) syncStatusSub.textContent = 'Manually loaded text file';
          showToast(`Successfully loaded ${parsed.length} schedules from ${file.name}`);
          processAndRender();
        } else {
          showToast('Could not find schedule rows in that file.');
        }
      };
      reader.readAsText(file);
    });
  }

  // Download Current schedules.txt (if button present)
  if (downloadCurrentTxtBtn) {
    downloadCurrentTxtBtn.addEventListener('click', () => {
      exportCurrentSchedulesToTxt();
    });
  }
}

// Time Table Lightbox Modal
function setupTimetableModal() {
  const modal = document.getElementById('timetableModal');
  const openCard = document.getElementById('openTimetableCard');
  const openBtn = document.getElementById('openTimetableBtn');
  const openFooterBtn = document.getElementById('openTimetableFooterBtn');
  const closeBtn = document.getElementById('closeTimetableBtn');

  function openModal() {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (openCard) {
    openCard.addEventListener('click', openModal);
    openCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal();
      }
    });
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (openFooterBtn) openFooterBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

// Export Current Schedules to Plain Text (schedules.txt)
function exportCurrentSchedulesToTxt() {
  const lines = [
    '# CSE - Section E Important Dates & Schedules',
    '# Format: Serial Number | Name | Subject | Due Date | Due Time | Duration',
    ''
  ];

  rawSchedules.forEach(item => {
    lines.push(`${item.sn} | ${item.name} | ${item.subject} | ${item.due} | ${item.time || '11:59 PM'} | ${item.duration}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schedules.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded schedules.txt');
}
