/**
 * CSE - Section E Schedule Manager
 * Logic for updating, importing, and exporting schedules.txt
 * Directly saves to disk when running with start_editor.bat!
 */

const STORAGE_KEY = 'csee_schedules_cache_v3';

// State
let schedules = [];
let isServerConnected = false;

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

// Status & Action Banner Elements
const connectionCard = document.getElementById('connectionCard');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const gitPushBtn = document.getElementById('gitPushBtn');

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
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadTxtTopBtn = document.getElementById('downloadTxtTopBtn');
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
  checkConnection();
});

// Toast Helper
function showToast(message) {
  if (!toastNotification) return;
  toastNotification.textContent = message;
  toastNotification.classList.add('show');
  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3500);
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

// Parse Plain Text Content
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
      parts = line.split('|').map(s => s.trim());
    } else if (line.includes('\t')) {
      parts = line.split('\t').map(s => s.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map(s => s.trim());
    } else {
      continue;
    }

    if (/serial|s\.?no|subject|due/i.test(parts[0]) || /name/i.test(parts[1])) {
      continue;
    }

    if (parts.length >= 4) {
      const sn = parseInt(parts[0], 10) || (rows.length + 1);
      const name = parts[1] || `Schedule Item ${rows.length + 1}`;
      const subject = parts[2] || 'General';
      const due = parts[3] || '';

      let time = '11:59 PM';
      let duration = '1 Day';

      if (parts.length >= 6) {
        time = normalizeTimeString(parts[4]);
        duration = parts[5] || '1 Day';
      } else if (parts.length === 5) {
        if (/hour|day|min|week/i.test(parts[4])) {
          duration = parts[4];
          time = '11:59 PM';
        } else {
          time = normalizeTimeString(parts[4]);
          duration = '1 Day';
        }
      }

      rows.push({ sn, name, subject, due, time, duration });
    }
  }

  return rows;
}

// Generate Plain Text formatted string
function generateTxtContent() {
  const lines = [
    '# CSE - Section E Important Dates & Schedules',
    '# Format: Serial Number | Name | Subject | Due Date | Due Time | Duration',
    '# Lines starting with # are comments. You can edit this file offline in Notepad or any text editor.',
    ''
  ];

  schedules.forEach(item => {
    lines.push(`${item.sn} | ${item.name} | ${item.subject} | ${item.due} | ${item.time || '11:59 PM'} | ${item.duration}`);
  });

  return lines.join('\n') + '\n';
}

// Check Connection to local server (app.py)
async function checkConnection() {
  const isFileProto = window.location.protocol === 'file:';

  if (isFileProto) {
    isServerConnected = false;
    updateStatusUI(false, '⚠️ Running via file://. Browser blocks direct disk editing. Double-click start_editor.bat to auto-save directly to schedules.txt!');
    return;
  }

  try {
    const res = await fetch('/schedules.txt?ping=' + Date.now());
    if (res.ok) {
      isServerConnected = true;
      updateStatusUI(true, '🟢 Connected to local file server: All edits save DIRECTLY to schedules.txt on your disk!');
      return;
    }
  } catch (e) {
    // not running server
  }

  isServerConnected = false;
  updateStatusUI(false, '⚠️ Standalone mode: To enable 1-click direct saves to schedules.txt, double-click start_editor.bat in the project folder.');
}

function updateStatusUI(online, message) {
  if (statusDot) {
    statusDot.className = 'status-dot ' + (online ? 'online' : 'offline');
  }
  if (statusText) {
    statusText.textContent = message;
  }
  if (connectionCard) {
    connectionCard.className = 'connection-status-card ' + (online ? 'connected' : 'disconnected');
  }
  if (gitPushBtn) {
    gitPushBtn.style.display = online ? 'inline-flex' : 'none';
  }
}

// Load Data from schedules.txt or localStorage
async function loadData() {
  // Try fetching schedules.txt from folder
  try {
    const response = await fetch('schedules.txt?t=' + Date.now());
    if (response.ok) {
      const text = await response.text();
      const parsed = parseTxtContent(text);
      if (parsed && parsed.length > 0) {
        schedules = parsed;
        saveToLocalStorage();
        render();
        return;
      }
    }
  } catch (e) {
    console.log('Direct fetch skipped/restricted:', e);
  }

  // Try localStorage
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

  // Initial fallback
  schedules = [
    { sn: 1, name: 'Math Assignment', subject: 'Math', due: '2026-10-18', time: '10:00 AM', duration: '2 Hours' },
    { sn: 2, name: 'Math Quiz', subject: 'Math', due: '2026-10-15', time: '11:59 PM', duration: '30 Minutes' },
    { sn: 3, name: 'Operating system CIE 1 Quiz', subject: 'OS', due: '2026-10-14', time: '02:00 PM', duration: '1 Hour' }
  ];
  saveToLocalStorage();
  render();
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

// Save directly to disk via app.py
async function saveDirectlyToDisk(showAlert = true) {
  saveToLocalStorage();
  const content = generateTxtContent();

  if (isServerConnected) {
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: content
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (showAlert) showToast('✅ Directly updated schedules.txt on your disk!');
          return true;
        }
      }
    } catch (e) {
      console.warn('Server save failed:', e);
    }
  }

  return false;
}

// Render Table
function render() {
  if (scheduleCountBadge) {
    scheduleCountBadge.textContent = `${schedules.length} Rows`;
  }

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
window.moveRow = async function(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= schedules.length) return;

  const temp = schedules[index];
  schedules[index] = schedules[targetIndex];
  schedules[targetIndex] = temp;

  render();
  await saveDirectlyToDisk(false);
};

// Delete Row
window.deleteRow = async function(index) {
  const item = schedules[index];
  if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

  schedules.splice(index, 1);
  render();
  const saved = await saveDirectlyToDisk(true);
  if (!saved) {
    showToast(`Deleted schedule "${item.name}"`);
  }
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

// Export / Save schedules.txt
async function exportToTxt() {
  if (schedules.length === 0) {
    showToast('Add at least one schedule before saving.');
    return;
  }

  // Try direct server save first
  const directlySaved = await saveDirectlyToDisk(true);
  if (directlySaved) {
    return; // File updated directly on disk!
  }

  // Fallback: Trigger browser download if running offline without server
  const content = generateTxtContent();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schedules.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📁 Downloaded schedules.txt! Replace it in this project folder, or run start_editor.bat to auto-save directly.');
}

// Setup Event Listeners
function setupEventListeners() {
  // Quick Add Form
  if (quickAddForm) {
    quickAddForm.addEventListener('submit', async (e) => {
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
      render();

      quickName.value = '';
      quickSubject.value = '';
      quickDue.value = '';
      quickTime.value = '';
      quickDuration.value = '';
      quickName.focus();

      const saved = await saveDirectlyToDisk(true);
      if (!saved) {
        showToast(`Added schedule "${newEntry.name}"`);
      }
    });
  }

  // Modal Save
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
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
      } else {
        schedules.push(entry);
      }

      render();
      closeModal();

      const saved = await saveDirectlyToDisk(true);
      if (!saved) {
        showToast(`Saved "${entry.name}"`);
      }
    });
  }

  if (openAddModalBtn) {
    openAddModalBtn.addEventListener('click', () => openEditModal());
  }
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeModal();
    });
  }

  // Download / Save schedules.txt
  if (downloadTxtBtn) downloadTxtBtn.addEventListener('click', exportToTxt);
  if (downloadTxtTopBtn) downloadTxtTopBtn.addEventListener('click', exportToTxt);

  // 1-Click Git Push
  if (gitPushBtn) {
    gitPushBtn.addEventListener('click', async () => {
      showToast('Pushing schedules.txt to Git origin main...');
      try {
        const res = await fetch('/api/git-push', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            showToast('🚀 Pushed to Git successfully!');
          } else {
            showToast('Git error: ' + (data.error || 'Failed'));
          }
        }
      } catch (e) {
        showToast('Could not reach Git endpoint. Try terminal commands below.');
      }
    });
  }

  // Import Plain Text file
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const textContent = evt.target.result;
        const parsed = parseTxtContent(textContent);
        if (parsed && parsed.length > 0) {
          schedules = parsed;
          render();
          await saveDirectlyToDisk(true);
          showToast(`Imported ${parsed.length} schedules from ${file.name}`);
        } else {
          showToast('Could not find schedule rows in that file.');
        }
        importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Auto-Renumber
  if (renumberBtn) {
    renumberBtn.addEventListener('click', async () => {
      schedules.forEach((item, i) => {
        item.sn = i + 1;
      });
      render();
      await saveDirectlyToDisk(false);
      showToast('Renumbered Serial Numbers 1 to ' + schedules.length);
    });
  }

  // Clear All
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all schedule items?')) {
        schedules = [];
        render();
        await saveDirectlyToDisk(true);
        showToast('Cleared all items');
      }
    });
  }

  // Load Defaults
  if (loadDefaultsBtn) {
    loadDefaultsBtn.addEventListener('click', async () => {
      schedules = [
        { sn: 1, name: 'Math Assignment', subject: 'Math', due: '2026-10-18', time: '10:00 AM', duration: '2 Hours' },
        { sn: 2, name: 'Math Quiz', subject: 'Math', due: '2026-10-15', time: '11:59 PM', duration: '30 Minutes' },
        { sn: 3, name: 'Operating system CIE 1 Quiz', subject: 'OS', due: '2026-10-14', time: '02:00 PM', duration: '1 Hour' }
      ];
      render();
      await saveDirectlyToDisk(true);
      showToast('Loaded sample schedules');
    });
  }

  // Copy Git Commands
  if (copyGitCmdBtn) {
    copyGitCmdBtn.addEventListener('click', () => {
      const gitCmds = `git add schedules.txt\ngit commit -m "Update schedules.txt"\ngit push origin main`;
      navigator.clipboard.writeText(gitCmds).then(() => {
        showToast('Copied Git commands to clipboard!');
      }).catch(() => {
        showToast('Could not copy automatically. See command box above.');
      });
    });
  }
}
