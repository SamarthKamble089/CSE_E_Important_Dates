/**
 * CSE - Section E Schedule Manager
 * Logic for updating, importing, and exporting schedules.xlsx
 * Columns: Serial Number, Name, Subject, Due Date, Due Time, Duration
 * Offline Git workflow enabled.
 */

const STORAGE_KEY = 'csee_schedules_cache_v2';

const INITIAL_SCHEDULES = [
  { sn: 1, name: 'Mid-Semester Theory Exam', subject: 'Operating Systems', due: '2026-10-18', time: '10:00 AM', duration: '2 Hours' },
  { sn: 2, name: 'PL/SQL Queries & Lab Submission', subject: 'Database Management Systems', due: '2026-10-22', time: '11:59 PM', duration: '1 Day' },
  { sn: 3, name: 'Packet Tracer Subnetting Lab Quiz', subject: 'Computer Networks', due: '2026-10-25', time: '02:30 PM', duration: '1 Hour' },
  { sn: 4, name: 'Software Requirements Spec (SRS) Review', subject: 'Software Engineering', due: '2026-10-28', time: '09:30 AM', duration: '30 Minutes' },
  { sn: 5, name: 'Mini Project Phase 1 Code Submission', subject: 'Cloud & Full Stack Lab', due: '2026-11-02', time: '05:00 PM', duration: '3 Days' },
  { sn: 6, name: 'End-Term Practical Lab Exam', subject: 'Operating Systems', due: '2026-11-10', time: '09:00 AM', duration: '3 Hours' }
];

// State
let schedules = [];

// DOM Elements
const editorTableBody = document.getElementById('editorTableBody');
const editorEmptyState = document.getElementById('editorEmptyState');
const scheduleCountBadge = document.getElementById('scheduleCountBadge');
const quickAddForm = document.getElementById('quickAddForm');
const quickSn = document.getElementById('quickSn');
const quickName = document.getElementById('quickName');
const quickSubject = document.getElementById('quickSubject');
const quickDue = document.getElementById('quickDue');
const quickTime = document.getElementById('quickTime');
const quickDuration = document.getElementById('quickDuration');

// Modal Elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const openAddModalBtn = document.getElementById('openAddModalBtn');
const editIndex = document.getElementById('editIndex');
const editSn = document.getElementById('editSn');
const editName = document.getElementById('editName');
const editSubject = document.getElementById('editSubject');
const editDue = document.getElementById('editDue');
const editTime = document.getElementById('editTime');
const editDuration = document.getElementById('editDuration');

// Action Buttons
const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');
const downloadXlsxTopBtn = document.getElementById('downloadXlsxTopBtn');
const importFileInput = document.getElementById('importFileInput');
const renumberBtn = document.getElementById('renumberBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const loadDefaultsBtn = document.getElementById('loadDefaultsBtn');
const copyGitCmdBtn = document.getElementById('copyGitCmdBtn');
const toastNotification = document.getElementById('toastNotification');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadData();
});

// Toast Helper
function showToast(message) {
  if (!toastNotification) return;
  toastNotification.textContent = message;
  toastNotification.classList.add('show');
  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3200);
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

// Format 12-hour string
function format12Hour(hours, minutes) {
  const h = hours % 12 || 12;
  const m = String(minutes).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

// Normalize Time string
function normalizeTimeString(rawTime) {
  if (!rawTime) return '11:59 PM';

  if (typeof rawTime === 'number') {
    const totalMinutes = Math.round(rawTime * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return format12Hour(hours, minutes);
  }

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

// Load Data
async function loadData() {
  // Try localStorage first
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        schedules = parsed;
        render();
        return;
      }
    }
  } catch (e) {
    console.warn('LocalStorage error', e);
  }

  // Try fetching schedules.xlsx from folder
  try {
    const response = await fetch('schedules.xlsx?t=' + Date.now());
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const parsed = parseExcelBuffer(buffer);
      if (parsed && parsed.length > 0) {
        schedules = parsed;
        saveData();
        render();
        return;
      }
    }
  } catch (e) {
    console.log('Direct fetch skipped/failed, using initial defaults', e);
  }

  // Fallback to sample data
  schedules = [...INITIAL_SCHEDULES];
  saveData();
  render();
}

// Save to localStorage
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

// Parse Excel Buffer
function parseExcelBuffer(buffer) {
  if (typeof XLSX === 'undefined') return null;

  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  if (!rawRows || rawRows.length === 0) return null;

  return rawRows.map((row, index) => {
    const keys = Object.keys(row);
    const snKey = keys.find(k => /serial|s\.?no|sl\.?no|#/i.test(k));
    const nameKey = keys.find(k => /name|title|event|task/i.test(k));
    const subjectKey = keys.find(k => /subject|course/i.test(k));
    const dueKey = keys.find(k => /due\s*date|^date$|deadline/i.test(k));
    const timeKey = keys.find(k => /(due\s*time|timing|^time$)/i.test(k) && !/duration/i.test(k));
    const durationKey = keys.find(k => /duration|period|hours/i.test(k));

    return {
      sn: Number(row[snKey]) || (index + 1),
      name: String(row[nameKey] || row['Name'] || `Schedule Item ${index + 1}`).trim(),
      subject: String(row[subjectKey] || row['Subject'] || 'General').trim(),
      due: String(row[dueKey] || row['Due Date'] || '').trim(),
      time: normalizeTimeString(row[timeKey] || row['Due Time'] || ''),
      duration: String(row[durationKey] || row['Duration'] || '1 Day').trim()
    };
  });
}

// Render Table
function render() {
  if (scheduleCountBadge) {
    scheduleCountBadge.textContent = `${schedules.length} Rows`;
  }

  // Update next quick add serial number
  if (quickSn) {
    const maxSn = schedules.reduce((max, item) => Math.max(max, Number(item.sn) || 0), 0);
    quickSn.value = maxSn + 1;
  }

  if (schedules.length === 0) {
    editorTableBody.innerHTML = '';
    if (editorEmptyState) editorEmptyState.style.display = 'flex';
    return;
  }

  if (editorEmptyState) editorEmptyState.style.display = 'none';

  const rowsHtml = schedules.map((item, idx) => {
    return `
      <tr data-index="${idx}">
        <td class="col-sn">
          <span class="sn-pill">${escapeHtml(item.sn)}</span>
        </td>
        <td class="col-name">
          <div class="cell-name-wrap">
            <span class="name-icon-bullet"></span>
            <span class="name-text">${escapeHtml(item.name)}</span>
          </div>
        </td>
        <td class="col-subject">
          <span class="subject-pill">
            <span class="subject-dot"></span>
            <span>${escapeHtml(item.subject)}</span>
          </span>
        </td>
        <td class="col-due">
          <span class="due-date-main">${escapeHtml(item.due || 'TBD')}</span>
        </td>
        <td class="col-time">
          <span class="due-time-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${escapeHtml(item.time || '11:59 PM')}</span>
          </span>
        </td>
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
        <td class="col-actions">
          <div class="action-btn-group">
            <button class="action-icon-btn edit-btn" onclick="openEditModal(${idx})" title="Edit schedule row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="action-icon-btn" onclick="moveRow(${idx}, -1)" title="Move up" ${idx === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <button class="action-icon-btn" onclick="moveRow(${idx}, 1)" title="Move down" ${idx === schedules.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <button class="action-icon-btn delete-btn" onclick="deleteRow(${idx})" title="Delete row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  editorTableBody.innerHTML = rowsHtml;
}

// Move Row Up or Down
window.moveRow = function(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= schedules.length) return;

  const temp = schedules[index];
  schedules[index] = schedules[targetIndex];
  schedules[targetIndex] = temp;

  saveData();
  render();
};

// Delete Row
window.deleteRow = function(index) {
  const item = schedules[index];
  if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

  schedules.splice(index, 1);
  saveData();
  render();
  showToast(`Deleted schedule "${item.name}"`);
};

// Open Edit / Add Modal
window.openEditModal = function(index) {
  if (typeof index === 'number') {
    modalTitle.textContent = 'Edit Schedule Entry';
    editIndex.value = index;
    const item = schedules[index];
    editSn.value = item.sn;
    editName.value = item.name;
    editSubject.value = item.subject;
    editDue.value = item.due;
    editTime.value = item.time || '10:00 AM';
    editDuration.value = item.duration;
  } else {
    modalTitle.textContent = 'Add New Schedule Entry';
    editIndex.value = '-1';
    const maxSn = schedules.reduce((max, item) => Math.max(max, Number(item.sn) || 0), 0);
    editSn.value = maxSn + 1;
    editName.value = '';
    editSubject.value = '';
    editDue.value = '';
    editTime.value = '10:00 AM';
    editDuration.value = '2 Hours';
  }
  editModal.classList.add('active');
  editName.focus();
};

function closeModal() {
  editModal.classList.remove('active');
}

// Export to Excel file schedules.xlsx (6 Columns)
function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS library is loading, please try again.');
    return;
  }

  if (schedules.length === 0) {
    showToast('Add at least one schedule before exporting.');
    return;
  }

  // Format exactly into the 6 columns
  const exportRows = schedules.map(item => ({
    'Serial Number': Number(item.sn) || 1,
    'Name': item.name,
    'Subject': item.subject,
    'Due Date': item.due,
    'Due Time': item.time || '11:59 PM',
    'Duration': item.duration
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  worksheet['!cols'] = [
    { wch: 16 }, // Serial Number
    { wch: 40 }, // Name
    { wch: 30 }, // Subject
    { wch: 16 }, // Due Date
    { wch: 16 }, // Due Time
    { wch: 18 }  // Duration
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedules');
  XLSX.writeFile(workbook, 'schedules.xlsx');
  saveData();

  showToast('✅ Downloaded schedules.xlsx! Replace it in your project folder.');
}

// Setup Event Listeners
function setupEventListeners() {
  // Quick Add Form
  if (quickAddForm) {
    quickAddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newEntry = {
        sn: Number(quickSn.value) || (schedules.length + 1),
        name: quickName.value.trim(),
        subject: quickSubject.value.trim(),
        due: quickDue.value.trim(),
        time: normalizeTimeString(quickTime.value.trim()),
        duration: quickDuration.value.trim()
      };

      schedules.push(newEntry);
      saveData();
      render();

      quickName.value = '';
      quickSubject.value = '';
      quickDue.value = '';
      quickTime.value = '';
      quickDuration.value = '';
      quickName.focus();

      showToast(`Added schedule "${newEntry.name}"`);
    });
  }

  // Modal Save
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const idx = parseInt(editIndex.value, 10);
      const entry = {
        sn: Number(editSn.value) || 1,
        name: editName.value.trim(),
        subject: editSubject.value.trim(),
        due: editDue.value.trim(),
        time: normalizeTimeString(editTime.value.trim()),
        duration: editDuration.value.trim()
      };

      if (idx >= 0 && idx < schedules.length) {
        schedules[idx] = entry;
        showToast(`Updated "${entry.name}"`);
      } else {
        schedules.push(entry);
        showToast(`Added "${entry.name}"`);
      }

      saveData();
      render();
      closeModal();
    });
  }

  // Modal open & close
  if (openAddModalBtn) {
    openAddModalBtn.addEventListener('click', () => openEditModal());
  }
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

  // Close modal on click outside
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeModal();
    });
  }

  // Download XLSX buttons
  if (downloadXlsxBtn) downloadXlsxBtn.addEventListener('click', exportToExcel);
  if (downloadXlsxTopBtn) downloadXlsxTopBtn.addEventListener('click', exportToExcel);

  // Import / Open Excel File
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const parsed = parseExcelBuffer(data);
        if (parsed && parsed.length > 0) {
          schedules = parsed;
          saveData();
          render();
          showToast(`Imported ${parsed.length} schedules from ${file.name}`);
        } else {
          showToast('Could not find schedule rows in that file.');
        }
        importFileInput.value = '';
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Auto-Renumber
  if (renumberBtn) {
    renumberBtn.addEventListener('click', () => {
      schedules.forEach((item, i) => {
        item.sn = i + 1;
      });
      saveData();
      render();
      showToast('Renumbered Serial Numbers 1 to ' + schedules.length);
    });
  }

  // Clear All
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all schedule items?')) {
        schedules = [];
        saveData();
        render();
        showToast('Cleared all items');
      }
    });
  }

  // Load Defaults
  if (loadDefaultsBtn) {
    loadDefaultsBtn.addEventListener('click', () => {
      schedules = [...INITIAL_SCHEDULES];
      saveData();
      render();
      showToast('Loaded sample schedules');
    });
  }

  // Copy Git Commands
  if (copyGitCmdBtn) {
    copyGitCmdBtn.addEventListener('click', () => {
      const gitCmds = `git add schedules.xlsx\ngit commit -m "Update schedules.xlsx"\ngit push origin main`;
      navigator.clipboard.writeText(gitCmds).then(() => {
        showToast('Copied Git commands to clipboard!');
      }).catch(() => {
        showToast('Could not copy automatically. See command box above.');
      });
    });
  }
}
