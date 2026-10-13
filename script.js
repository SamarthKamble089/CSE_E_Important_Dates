/**
 * CSE - Section E Academic Schedules Portal
 * View-Only Page: Strictly displays Serial Number, Name, Subject, Due Date, Duration.
 * Reads dynamically from schedules.xlsx in the folder.
 */

// Fallback initial schedules if fetch is blocked or file not yet loaded
const FALLBACK_SCHEDULES = [
  { sn: 1, name: 'Mid-Semester Theory Exam', subject: 'Operating Systems', due: '2026-10-18', duration: '2 Hours' },
  { sn: 2, name: 'PL/SQL Queries & Lab Submission', subject: 'Database Management Systems', due: '2026-10-22', duration: '1 Day' },
  { sn: 3, name: 'Packet Tracer Subnetting Lab Quiz', subject: 'Computer Networks', due: '2026-10-25', duration: '1 Hour' },
  { sn: 4, name: 'Software Requirements Spec (SRS) Review', subject: 'Software Engineering', due: '2026-10-28', duration: '30 Minutes' },
  { sn: 5, name: 'Mini Project Phase 1 Code Submission', subject: 'Cloud & Full Stack Lab', due: '2026-11-02', duration: '3 Days' },
  { sn: 6, name: 'End-Term Practical Lab Exam', subject: 'Operating Systems', due: '2026-11-10', duration: '3 Hours' }
];

const STORAGE_KEY = 'csee_schedules_cache_v2';

// State
let rawSchedules = [];
let filteredSchedules = [];
let searchQuery = '';
let selectedSubject = 'all';
let currentSort = 'sn-asc';

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
      showToast('Loaded latest schedules from Excel sheet');
      processAndRender();
      return;
    }
  } catch (err) {
    console.log('Direct fetch of schedules.xlsx not possible or restricted:', err);

    // If on file:// protocol, show helper banner
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

// Parse Excel ArrayBuffer with SheetJS
function parseExcelBuffer(buffer) {
  if (typeof XLSX === 'undefined') {
    console.error('SheetJS library is not available');
    return null;
  }

  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert sheet to JSON array
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  if (!rawRows || rawRows.length === 0) return null;

  // Normalize column headers to match the 5 fields
  return rawRows.map((row, index) => {
    // Look for matching keys flexibly
    const keys = Object.keys(row);

    const snKey = keys.find(k => /serial|s\.?no|sl\.?no|#/i.test(k));
    const nameKey = keys.find(k => /name|title|event|task|exam/i.test(k));
    const subjectKey = keys.find(k => /subject|course|sub/i.test(k));
    const dueKey = keys.find(k => /due|date|deadline/i.test(k));
    const durationKey = keys.find(k => /duration|time|period|hours/i.test(k));

    return {
      sn: Number(row[snKey]) || (index + 1),
      name: String(row[nameKey] || row['Name'] || `Schedule Item ${index + 1}`).trim(),
      subject: String(row[subjectKey] || row['Subject'] || 'General').trim(),
      due: normalizeDateString(String(row[dueKey] || row['Due Date'] || '').trim()),
      duration: String(row[durationKey] || row['Duration'] || '1 Day').trim()
    };
  });
}

// Date Normalizer
function normalizeDateString(rawDate) {
  if (!rawDate) return '';
  // Check if standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;

  // Try parsing date
  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return rawDate;
}

// Format Date for Display
function formatDisplayDate(dateStr) {
  if (!dateStr) return { formatted: 'TBD', countdown: null };

  const parsed = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(parsed.getTime())) {
    return { formatted: dateStr, countdown: null };
  }

  const formatted = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Calculate Countdown
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let countdown = { text: '', cls: 'normal' };
  if (diffDays < 0) {
    countdown = { text: `${Math.abs(diffDays)}d ago`, cls: 'overdue' };
  } else if (diffDays === 0) {
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

  return { formatted, countdown, diffDays };
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
  if (statTotalCount) statTotalCount.textContent = rawSchedules.length;

  const subjects = new Set(rawSchedules.map(item => item.subject).filter(Boolean));
  if (statSubjectsCount) statSubjectsCount.textContent = subjects.size;

  // Nearest upcoming due date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingItems = rawSchedules
    .filter(item => {
      if (!item.due) return false;
      const d = new Date(item.due + 'T00:00:00');
      return !isNaN(d.getTime()) && d.getTime() >= today.getTime();
    })
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  if (statDueSoon) {
    if (upcomingItems.length > 0) {
      const nearest = upcomingItems[0];
      const parsed = new Date(nearest.due + 'T00:00:00');
      statDueSoon.textContent = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      statDueSoon.textContent = 'None';
    }
  }
}

// Apply Filters, Sort and Render Table
function applyFiltersAndRender() {
  filteredSchedules = rawSchedules.filter(item => {
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
      const matchSn = String(item.sn).includes(q);
      if (!matchName && !matchSub && !matchDuration && !matchSn) return false;
    }

    return true;
  });

  // Sorting
  filteredSchedules.sort((a, b) => {
    switch (currentSort) {
      case 'sn-asc':
        return Number(a.sn) - Number(b.sn);
      case 'date-asc':
        return (new Date(a.due || '9999').getTime()) - (new Date(b.due || '9999').getTime());
      case 'date-desc':
        return (new Date(b.due || '1970').getTime()) - (new Date(a.due || '1970').getTime());
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'subject-asc':
        return a.subject.localeCompare(b.subject);
      default:
        return Number(a.sn) - Number(b.sn);
    }
  });

  renderTable();
}

// Render Table - STRICTLY 5 COLUMNS ONLY: Serial Number, Name, Subject, Due Date, Duration
function renderTable() {
  if (!schedulesTableBody) return;

  if (filteredSchedules.length === 0) {
    schedulesTableBody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    if (resultsCount) resultsCount.textContent = '0 schedules found';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (resultsCount) {
    resultsCount.textContent = `Showing ${filteredSchedules.length} of ${rawSchedules.length} schedules`;
  }

  const htmlRows = filteredSchedules.map(item => {
    const dateInfo = formatDisplayDate(item.due);

    return `
      <tr>
        <!-- Column 1: Serial Number -->
        <td class="col-sn">
          <span class="sn-pill">${escapeHtml(item.sn)}</span>
        </td>

        <!-- Column 2: Name -->
        <td class="col-name">
          <div class="cell-name-wrap">
            <span class="name-icon-bullet"></span>
            <span class="name-text">${escapeHtml(item.name)}</span>
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

        <!-- Column 5: Duration -->
        <td class="col-duration">
          <span class="duration-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
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
      currentSort = 'sn-asc';
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      if (subjectFilter) subjectFilter.value = 'all';
      if (sortSelect) sortSelect.value = 'sn-asc';
      applyFiltersAndRender();
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

// Export Current Schedules to Excel
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
    'Duration': item.duration
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 15 }, // Serial Number
    { wch: 38 }, // Name
    { wch: 32 }, // Subject
    { wch: 16 }, // Due Date
    { wch: 16 }  // Duration
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedules');
  XLSX.writeFile(workbook, 'schedules.xlsx');
  showToast('Downloaded schedules.xlsx');
}
