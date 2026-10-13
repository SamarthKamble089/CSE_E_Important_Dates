/**
 * CSE - Section E Academic Schedules Portal
 * View-Only Page: Strictly displays Serial Number, Name, Subject, Due Date, Due Time, Duration.
 * Reads dynamically from schedules.xlsx in the folder.
 * 
 * Auto-filtering & Ordering Rules:
 * 1. Compares each entry's due date & time against the current date & time.
 * 2. Hides all data that is older than 1 day (overdue by > 24 hours).
 * 3. Any item whose due time has passed within that 1-day window (0 to 24h ago) is listed at the END.
 * 4. Active data is arranged chronologically by Due Date and Time (nearest first).
 */

// Fallback initial schedules if fetch is blocked or file not yet loaded
const FALLBACK_SCHEDULES = [
  { sn: 1, name: 'Mid-Semester Theory Exam', subject: 'Operating Systems', due: '2026-10-18', time: '10:00 AM', duration: '2 Hours' },
  { sn: 2, name: 'PL/SQL Queries & Lab Submission', subject: 'Database Management Systems', due: '2026-10-22', time: '11:59 PM', duration: '1 Day' },
  { sn: 3, name: 'Packet Tracer Subnetting Lab Quiz', subject: 'Computer Networks', due: '2026-10-25', time: '02:30 PM', duration: '1 Hour' },
  { sn: 4, name: 'Software Requirements Spec (SRS) Review', subject: 'Software Engineering', due: '2026-10-28', time: '09:30 AM', duration: '30 Minutes' },
  { sn: 5, name: 'Mini Project Phase 1 Code Submission', subject: 'Cloud & Full Stack Lab', due: '2026-11-02', time: '05:00 PM', duration: '3 Days' },
  { sn: 6, name: 'End-Term Practical Lab Exam', subject: 'Operating Systems', due: '2026-11-10', time: '09:00 AM', duration: '3 Hours' }
];

const STORAGE_KEY = 'csee_schedules_cache_v2';

// State
let rawSchedules = [];
let processedSchedules = [];
let searchQuery = '';
let selectedSubject = 'all';
let currentSort = 'datetime-asc';
let showHiddenPast = false; // Toggle to inspect older items if user clicks badge

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
const downloadCurrentXlsxBtn = document.getElementById('downloadCurrentXlsxBtn');
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
  startClock();
  setupEventListeners();
  loadSchedulesData();
});

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

// Helper: Format 12-hour AM/PM string
function format12Hour(hours, minutes) {
  const h = hours % 12 || 12;
  const m = String(minutes).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

// Normalize Time string
function normalizeTimeString(rawTime) {
  if (!rawTime) return '11:59 PM'; // Default end of day if missing

  // Check if Excel stored it as numeric fraction of a day (e.g. 0.4166667 for 10:00 AM)
  if (typeof rawTime === 'number') {
    const totalMinutes = Math.round(rawTime * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return format12Hour(hours, minutes);
  }

  const str = String(rawTime).trim();
  if (!str) return '11:59 PM';

  // Already 12-hour format e.g. "10:00 AM"
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const period = match12[3] ? match12[3].toUpperCase() : null;
    if (period) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    } else {
      // 24 hour string "14:30"
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

// Parse Excel ArrayBuffer with SheetJS
function parseExcelBuffer(buffer) {
  if (typeof XLSX === 'undefined') {
    console.error('SheetJS library is not available');
    return null;
  }

  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  if (!rawRows || rawRows.length === 0) return null;

  return rawRows.map((row, index) => {
    const keys = Object.keys(row);

    const snKey = keys.find(k => /serial|s\.?no|sl\.?no|#/i.test(k));
    const nameKey = keys.find(k => /name|title|event|task|exam/i.test(k));
    const subjectKey = keys.find(k => /subject|course|sub/i.test(k));
    const dueKey = keys.find(k => /due\s*date|date|deadline/i.test(k));
    const timeKey = keys.find(k => /(due\s*time|timing|^time$)/i.test(k) && !/duration/i.test(k));
    const durationKey = keys.find(k => /duration|period|hours/i.test(k));

    const dateVal = normalizeDateString(String(row[dueKey] || row['Due Date'] || '').trim());
    const timeVal = normalizeTimeString(row[timeKey] || row['Due Time'] || '');

    return {
      sn: Number(row[snKey]) || (index + 1),
      name: String(row[nameKey] || row['Name'] || `Schedule Item ${index + 1}`).trim(),
      subject: String(row[subjectKey] || row['Subject'] || 'General').trim(),
      due: dateVal,
      time: timeVal,
      duration: String(row[durationKey] || row['Duration'] || '1 Day').trim()
    };
  });
}

// Load Schedules from Excel / Storage / Fallback
async function loadSchedulesData() {
  const isFileProtocol = window.location.protocol === 'file:';

  // 1. Check if cached from editor in localStorage
  let cachedData = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedData = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not read cached schedules', e);
  }

  // 2. Try fetching schedules.xlsx from folder
  try {
    const response = await fetch('schedules.xlsx?t=' + Date.now());
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const parsed = parseExcelBuffer(arrayBuffer);
    if (parsed && parsed.length > 0) {
      rawSchedules = parsed;
      syncStatus.textContent = 'schedules.xlsx';
      syncStatusSub.textContent = 'Synced Live via Git';
      showToast('Loaded latest schedules with Due Time from Excel');
      processAndRender();
      return;
    }
  } catch (err) {
    console.log('Direct fetch restricted or file not served via HTTP:', err);

    if (isFileProtocol && fileProtocolBanner) {
      fileProtocolBanner.style.display = 'flex';
      syncStatus.textContent = 'Local file://';
      syncStatusSub.textContent = 'Select file above to sync';
    } else {
      syncStatus.textContent = 'Local Cache';
      syncStatusSub.textContent = 'From offline editor';
    }
  }

  // 3. Fallback to cached or predefined data
  if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
    rawSchedules = cachedData;
  } else {
    rawSchedules = [...FALLBACK_SCHEDULES];
  }

  processAndRender();
}

// Format Date & Time Countdown
function formatDisplayDate(dateStr, timeStr) {
  if (!dateStr) return { formatted: 'TBD', timeDisplay: timeStr || 'TBD', countdown: null, status: 'unknown' };

  const target = getEventDateTime(dateStr, timeStr);
  if (!target) {
    return { formatted: dateStr, timeDisplay: timeStr || 'TBD', countdown: null, status: 'unknown' };
  }

  const formatted = target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let countdown = { text: '', cls: 'normal' };
  let status = 'upcoming'; // 'upcoming' | 'recently-over' | 'expired'

  if (diffMs < 0) {
    // Past due
    const hoursAgo = Math.abs(diffHours);
    if (hoursAgo <= 24) {
      // Within 1 day gap
      status = 'recently-over';
      const roundedHours = Math.round(hoursAgo);
      countdown = { 
        text: roundedHours <= 1 ? 'Passed <1h ago' : `Passed ${roundedHours}h ago`, 
        cls: 'recently-over' 
      };
    } else {
      // Older than 1 day
      status = 'expired';
      const daysAgo = Math.floor(hoursAgo / 24);
      countdown = { text: `${daysAgo}d ago`, cls: 'overdue' };
    }
  } else {
    // Upcoming
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

  return { formatted, timeDisplay: timeStr || '11:59 PM', countdown, status, target };
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

  // Active or recently passed within 1 day
  const validItems = rawSchedules.filter(item => {
    const dt = getEventDateTime(item.due, item.time);
    return dt && dt >= oneDayAgo;
  });

  if (statTotalCount) statTotalCount.textContent = validItems.length;

  const subjects = new Set(validItems.map(item => item.subject).filter(Boolean));
  if (statSubjectsCount) statSubjectsCount.textContent = subjects.size;

  // Nearest upcoming due date
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
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago threshold

  // 1. Filter by search query and subject
  const searchFiltered = rawSchedules.filter(item => {
    // Subject filter
    if (selectedSubject !== 'all' && item.subject !== selectedSubject) {
      return false;
    }

    // Search query filter
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

  // 2. Separate into Active, Recently Over (within 1 day), and Expired (> 1 day older)
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
      // Active upcoming
      upcomingList.push(enriched);
    } else if (dt >= oneDayAgo) {
      // Overdue but within the 1-day grace gap -> will be listed at the end!
      recentlyOverList.push(enriched);
    } else {
      // Older than 1 day -> HIDE!
      olderThanOneDayList.push(enriched);
    }
  });

  // Update hidden items badge in UI
  if (hiddenStatusBadge) {
    if (olderThanOneDayList.length > 0) {
      hiddenStatusBadge.style.display = 'inline-flex';
      hiddenStatusBadge.innerHTML = showHiddenPast 
        ? `<span>Showing ${olderThanOneDayList.length} past items (>1d old)</span> &times;`
        : `<span>${olderThanOneDayList.length} past items hidden (&gt;1d old)</span>`;
      hiddenStatusBadge.title = showHiddenPast ? 'Click to re-hide past items' : 'Click to inspect hidden items';
    } else {
      hiddenStatusBadge.style.display = 'none';
    }
  }

  // 3. Sort upcoming events according to currentSort
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

  // Recently over items: sort chronologically
  recentlyOverList.sort((a, b) => (a.dt ? a.dt.getTime() : 0) - (b.dt ? b.dt.getTime() : 0));

  // 4. Combine: Upcoming items FIRST, Recently Over items AT THE END!
  let finalList = [...upcomingList, ...recentlyOverList];

  // If user explicitly toggled to show older items
  if (showHiddenPast && olderThanOneDayList.length > 0) {
    olderThanOneDayList.sort((a, b) => (b.dt ? b.dt.getTime() : 0) - (a.dt ? a.dt.getTime() : 0));
    finalList = [...finalList, ...olderThanOneDayList];
  }

  processedSchedules = finalList;
  renderTable(recentlyOverList.length, olderThanOneDayList.length);
}

// Render Table: 6 COLUMNS (Serial Number, Name, Subject, Due Date, Due Time, Duration)
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
        <!-- Column 1: Serial Number -->
        <td class="col-sn">
          <span class="sn-pill">${escapeHtml(item.sn)}</span>
        </td>

        <!-- Column 2: Name -->
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

        <!-- Column 3: Subject -->
        <td class="col-subject">
          <span class="subject-pill">
            <span class="subject-dot"></span>
            <span>${escapeHtml(item.subject)}</span>
          </span>
        </td>

        <!-- Column 4: Due Date -->
        <td class="col-due">
          <div class="due-date-cell">
            <span class="due-date-main">${dateInfo.formatted}</span>
            ${dateInfo.countdown ? `<span class="due-countdown-tag ${dateInfo.countdown.cls}">${dateInfo.countdown.text}</span>` : ''}
          </div>
        </td>

        <!-- Column 5: Due Time -->
        <td class="col-time">
          <span class="due-time-badge ${isRecentlyOver ? 'time-passed' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${escapeHtml(dateInfo.timeDisplay)}</span>
          </span>
        </td>

        <!-- Column 6: Duration -->
        <td class="col-duration">
          <span class="duration-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>${escapeHtml(item.duration)}</span>
          </span>
        </td>
      </tr>
    `;
  }).join('');

  schedulesTableBody.innerHTML = htmlRows;
}

// Event Listeners
function setupEventListeners() {
  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      }
      applyFiltersAndRender();
    });
  }

  // Clear search
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      applyFiltersAndRender();
      searchInput.focus();
    });
  }

  // Subject filter
  if (subjectFilter) {
    subjectFilter.addEventListener('change', (e) => {
      selectedSubject = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Sort selector
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Refresh Button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      showToast('Checking for latest schedules.xlsx...');
      loadSchedulesData();
    });
  }

  // Reset Filters
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

  // Hidden badge toggle
  if (hiddenStatusBadge) {
    hiddenStatusBadge.addEventListener('click', () => {
      showHiddenPast = !showHiddenPast;
      applyFiltersAndRender();
      showToast(showHiddenPast ? 'Displaying hidden past items' : 'Re-hid past items (> 1 day old)');
    });
  }

  // File Protocol Upload input
  if (localFileInput) {
    localFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const parsed = parseExcelBuffer(data);
        if (parsed && parsed.length > 0) {
          rawSchedules = parsed;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rawSchedules));
          syncStatus.textContent = file.name;
          syncStatusSub.textContent = 'Manually loaded file';
          showToast(`Successfully loaded ${parsed.length} schedules from ${file.name}`);
          processAndRender();
        } else {
          showToast('Could not find schedule rows in that file.');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Download Current schedules.xlsx
  if (downloadCurrentXlsxBtn) {
    downloadCurrentXlsxBtn.addEventListener('click', () => {
      exportCurrentSchedulesToExcel();
    });
  }
}

// Export Current Schedules to Excel (6 columns)
function exportCurrentSchedulesToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('XLSX library not loaded');
    return;
  }

  const exportData = rawSchedules.map(item => ({
    'Serial Number': item.sn,
    'Name': item.name,
    'Subject': item.subject,
    'Due Date': item.due,
    'Due Time': item.time || '11:59 PM',
    'Duration': item.duration
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 15 }, // Serial Number
    { wch: 38 }, // Name
    { wch: 30 }, // Subject
    { wch: 16 }, // Due Date
    { wch: 16 }, // Due Time
    { wch: 16 }  // Duration
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedules');
  XLSX.writeFile(workbook, 'schedules.xlsx');
  showToast('Downloaded schedules.xlsx');
}
