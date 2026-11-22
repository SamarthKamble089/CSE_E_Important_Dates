const loginPanel = document.getElementById('loginPanel');
const adminShell = document.getElementById('adminShell');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const signInButton = loginForm.querySelector('button[type="submit"]');
const deadlineForm = document.getElementById('deadlineForm');
const addDialog = document.getElementById('addDialog');
const openAddDeadlineButton = document.getElementById('openAddDeadlineButton');
const cancelAddButton = document.getElementById('cancelAddButton');
const addMessage = document.getElementById('addMessage');
const saveMessage = document.getElementById('saveMessage');
const deadlineRows = document.getElementById('deadlineRows');
const deadlinePanel = document.getElementById('deadlinePanel');
const refreshButton = document.getElementById('refreshButton');
const deadlineCount = document.getElementById('deadlineCount');
const emptyMessage = document.getElementById('emptyMessage');
const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
const editMessage = document.getElementById('editMessage');
const confirmEditButton = document.getElementById('confirmEditButton');
const fieldTemplate = document.getElementById('deadlineFields');
const deleteDialog = document.getElementById('deleteDialog');
const deleteForm = document.getElementById('deleteForm');
const deleteMessage = document.getElementById('deleteMessage');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');
const deleteExpiredButton = document.getElementById('deleteExpiredButton');
let pendingDeletion = [];

for (const form of [deadlineForm, editForm]) {
  form.prepend(fieldTemplate.content.cloneNode(true));
  const { day, month } = form.elements;
  for (let i = 1; i <= 31; i++) day.add(new Option(i, String(i).padStart(2, '0')));
  const months = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' });
  for (let i = 0; i < 12; i++) {
    month.add(new Option(months.format(new Date(Date.UTC(2020, i, 1))), String(i + 1).padStart(2, '0')));
  }
}
const saveDeadlineButton = document.getElementById('saveDeadlineButton');
const cancelEditButton = document.getElementById('cancelEditButton');

let deadlines = [];
let editingIndex = -1;
let version = '';
let saving = false;
let idleTimer;
let expiresAt = 0;
let lastRenewal = 0;
let renewal;
let signingOut = false;

function showSignIn(message) {
  clearTimeout(idleTimer);
  expiresAt = 0;
  version = '';
  if (addDialog.open) addDialog.close();
  if (editDialog.open) editDialog.close();
  if (deleteDialog.open) deleteDialog.close();
  adminShell.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
  showMessage(loginMessage, message);
}

function watchSession(expiry) {
  expiresAt = expiry;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => showSignIn('Signed out after 5 minutes of inactivity.'), Math.max(0, expiry - Date.now()));
}

function recordActivity(event) {
  if (!event.isTrusted || adminShell.hidden || signingOut || renewal) return;
  const now = Date.now();
  if (now >= expiresAt) {
    showSignIn('Your session expired. Please sign in again.');
    return;
  }
  if (now - lastRenewal < 5000) return;
  lastRenewal = now;
  renewal = api('/api/admin/login', { method: 'PATCH', signal: AbortSignal.timeout(8000) })
    .then(({ expiresAt }) => {
      if (!adminShell.hidden && !signingOut) watchSession(expiresAt);
    })
    .catch((error) => {
      if (error.status === 401 && !signingOut) showSignIn(error.message);
    })
    .finally(() => { renewal = undefined; });
}

for (const event of ['pointerdown', 'keydown', 'input', 'wheel']) {
  document.addEventListener(event, recordActivity, { passive: true });
}

function showMessage(element, message, kind = '') {
  element.textContent = message;
  element.className = `message ${kind}`.trim();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
    credentials: 'same-origin'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function timeForInput(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return '23:59';
  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function displayTime(value) {
  const [hourText, minute] = String(value || '23:59').split(':');
  const hour = Number(hourText);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function deadlineTime(item) {
  const calendarDate = new Date(`${item.due}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== item.due) return NaN;
  if (item.time && !/^(?:(?:0?[1-9]|1[0-2]):[0-5]\d\s*(?:AM|PM)|(?:[01]?\d|2[0-3]):[0-5]\d)$/i.test(item.time)) return NaN;
  const time = item.time ? timeForInput(item.time) : '23:59';
  return Date.parse(`${item.due}T${time}:00+05:30`);
}

function deadlineStatus(item, now) {
  const due = deadlineTime(item);
  if (!Number.isFinite(due)) return 'Unknown';
  if (due >= now) return 'Upcoming';
  return now - due > 86400000 ? 'Expired' : 'Overdue';
}

function updateDeadlineStatuses() {
  const now = Date.now();
  let expiredCount = 0;
  for (const row of deadlineRows.rows) {
    const item = deadlines[Number(row.dataset.deadlineIndex)];
    const status = deadlineStatus(item, now);
    const badge = row.querySelector('.deadline-status');
    if (badge) {
      badge.textContent = status;
      badge.dataset.status = status;
    }
    if (status === 'Expired') expiredCount++;
  }
  deleteExpiredButton.disabled = !version || saving || expiredCount === 0;
  deleteExpiredButton.textContent = expiredCount ? `Delete all expired (${expiredCount})` : 'Delete all expired';
}

function render() {
  deadlineRows.replaceChildren();
  deadlineCount.textContent = `${deadlines.length} deadline${deadlines.length === 1 ? '' : 's'}`;
  emptyMessage.hidden = deadlines.length > 0;

  const now = Date.now();
  const ordered = deadlines.map((item, index) => {
    const time = deadlineTime(item);
    const group = !Number.isFinite(time) || time >= now ? 0 : now - time > 86400000 ? 2 : 1;
    return { item, index, time: Number.isFinite(time) ? time : Infinity, group };
  }).sort((a, b) => a.group - b.group || (a.group === 0 ? a.time - b.time : b.time - a.time));

  ordered.forEach(({ item, index }) => {
    const row = document.createElement('tr');
    row.dataset.deadlineIndex = index;
    const values = [item.name, item.subject, `${item.due} · ${item.time ? displayTime(timeForInput(item.time)) : '--'}`, item.duration];
    values.forEach((value, column) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (column === 2) {
        const badge = document.createElement('span');
        badge.className = 'deadline-status';
        cell.appendChild(badge);
      }
      row.appendChild(cell);
    });

    const actions = document.createElement('td');
    const actionButtons = document.createElement('div');
    actionButtons.className = 'row-actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'secondary';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => startEdit(index));
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => confirmDeletion([item]));
    actionButtons.append(editButton, deleteButton);
    actions.appendChild(actionButtons);
    row.appendChild(actions);
    deadlineRows.appendChild(row);
  });
  updateDeadlineStatuses();
}

async function loadDeadlines() {
  showMessage(saveMessage, 'Loading deadlines…');
  version = '';
  deleteExpiredButton.disabled = true;
  openAddDeadlineButton.disabled = true;
  const data = await api('/api/deadlines').catch((error) => {
    deadlineCount.textContent = 'Schedule unavailable';
    throw error;
  });
  if (adminShell.hidden) return;
  if (typeof data.version !== 'string' || !data.version || !Array.isArray(data.items)) {
    deadlineCount.textContent = 'Schedule unavailable';
    throw new Error('The schedule server returned invalid data. Try Refresh.');
  }
  const preview = data.version === 'browser-preview';
  const stored = preview ? readBrowserPreviewDeadlines() : null;
  deadlines = (stored ?? data.items).map((item, index) => ({
    sn: Number(item.sn) || index + 1,
    name: item.name || '',
    subject: item.subject || '',
    due: String(item.due || ''),
    time: item.time || '',
    duration: item.duration || ''
  }));
  version = data.version;
  render();
  openAddDeadlineButton.disabled = false;
  showMessage(saveMessage, preview ? 'Save your changes, then open Preview to see them in this browser.' : '');
}

function loadDeadlinesWithFeedback(message) {
  return showScheduleLoading(deadlinePanel, refreshButton, message, loadDeadlines)
    .catch(error => showMessage(saveMessage, error.message, 'error'));
}

async function saveDeadlines(next, message = saveMessage) {
  if (!version || saving) return false;
  saving = true;
  deleteExpiredButton.disabled = true;
  confirmEditButton.disabled = true;
  cancelEditButton.disabled = true;
  saveDeadlineButton.disabled = true;
  cancelAddButton.disabled = true;
  openAddDeadlineButton.disabled = true;
  showMessage(message, 'Saving to the website…');
  try {
    const normalized = next.map((item, index) => ({ ...item, sn: index + 1 }));
    if (version === 'browser-preview') {
      try {
        localStorage.setItem(BROWSER_PREVIEW_KEY, JSON.stringify(normalized));
      } catch {
        throw new Error('This browser could not save preview edits. Check that site storage is enabled.');
      }
    } else {
      const result = await api('/api/deadlines', {
        method: 'PUT',
        body: JSON.stringify({ items: normalized, version })
      });
      version = result.version;
      try { localStorage.setItem(SHARED_SCHEDULE_UPDATE_KEY, version); } catch {}
    }
    deadlines = normalized;
    render();
    showMessage(message, version === 'browser-preview' ? 'Saved in this browser.' : 'Saved.', 'success');
    return true;
  } catch (error) {
    if (error.status === 401) {
      showSignIn(error.message);
      return false;
    }
    showMessage(message, error.message, 'error');
    return false;
  } finally {
    saving = false;
    updateDeadlineStatuses();
    confirmEditButton.disabled = false;
    cancelEditButton.disabled = false;
    saveDeadlineButton.disabled = false;
    cancelAddButton.disabled = false;
    openAddDeadlineButton.disabled = !version;
  }
}

function resetAddForm() {
  deadlineForm.reset();
  deadlineForm.elements.year.value = new Intl.DateTimeFormat('en-IN', {
    year: 'numeric', timeZone: 'Asia/Kolkata'
  }).format(new Date());
  deadlineForm.elements.clock.value = '11:59';
}

function readDeadline(form) {
  const { title, subject, day, month, year, clock, period, duration } = form.elements;
  const due = [year.value, month.value, day.value].join('-');
  const date = new Date(due + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== due || year.value === '0000') {
    throw new Error('Choose a valid due date.');
  }
  if (!title.value.trim() || !subject.value.trim()) {
    throw new Error('Enter a deadline name and subject.');
  }
  return {
    name: title.value.trim(),
    subject: subject.value.trim(),
    due,
    time: clock.value ? timeForInput(clock.value + ' ' + period.value) : '',
    duration: duration.value.trim()
  };
}

function startEdit(index) {
  if (!version || saving || editDialog.open) return;
  const item = deadlines[index];
  editingIndex = index;
  const { title, subject, day, month, year, clock, period, duration } = editForm.elements;
  [year.value, month.value, day.value] = item.due.split('-');
  title.value = item.name;
  subject.value = item.subject;
  [clock.value, period.value] = item.time
    ? displayTime(timeForInput(item.time)).split(' ')
    : ['', 'PM'];
  duration.value = item.duration;
  showMessage(editMessage, '');
  editDialog.showModal();
}

function confirmDeletion(items, bulk = false) {
  if (!version || saving || !items.length) return;
  pendingDeletion = items;
  const label = items.length === 1 ? 'deadline' : 'deadlines';
  document.getElementById('deleteDescription').textContent = bulk
    ? `Delete ${items.length} expired ${label}? This only includes deadlines that passed more than 24 hours ago.`
    : `Delete "${items[0].name}"?`;
  confirmDeleteButton.textContent = bulk ? `Delete ${items.length} ${label}` : 'Delete deadline';
  showMessage(deleteMessage, '');
  deleteDialog.showModal();
}

deleteExpiredButton.addEventListener('click', () => {
  const now = Date.now();
  confirmDeletion(deadlines.filter((item) => deadlineStatus(item, now) === 'Expired'), true);
});
cancelDeleteButton.addEventListener('click', () => deleteDialog.close());
deleteDialog.addEventListener('cancel', (event) => {
  if (saving) event.preventDefault();
});
deleteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!version || saving || !pendingDeletion.length) return;
  const selected = new Set(pendingDeletion);
  const next = deadlines.filter((item) => !selected.has(item));
  const count = deadlines.length - next.length;
  if (!count) return;
  confirmDeleteButton.disabled = true;
  cancelDeleteButton.disabled = true;
  try {
    if (await saveDeadlines(next, deleteMessage)) {
      deleteDialog.close();
      showMessage(saveMessage, `Deleted ${count} ${count === 1 ? 'deadline' : 'deadlines'}.`, 'success');
      refreshButton.focus();
    }
  } finally {
    confirmDeleteButton.disabled = false;
    cancelDeleteButton.disabled = false;
  }
});
setInterval(() => {
  if (!adminShell.hidden) updateDeadlineStatuses();
}, 30000);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (signInButton.disabled) return;
  signInButton.disabled = true;
  showMessage(loginMessage, 'Signing in…');
  try {
    const session = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value
      })
    });
    loginPanel.hidden = true;
    adminShell.hidden = false;
    lastRenewal = Date.now();
    watchSession(session.expiresAt);
    await loadDeadlinesWithFeedback('Loading deadlines');
  } catch (error) {
    showMessage(loginMessage, error.message, 'error');
  } finally {
    signInButton.disabled = false;
  }
});

openAddDeadlineButton.addEventListener('click', () => {
  if (!version || saving || addDialog.open) return;
  resetAddForm();
  showMessage(addMessage, '');
  addDialog.showModal();
});
cancelAddButton.addEventListener('click', () => addDialog.close());
addDialog.addEventListener('cancel', (event) => {
  if (saving) event.preventDefault();
});

deadlineForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!addDialog.open || saving) return;
  try {
    if (await saveDeadlines([...deadlines, readDeadline(deadlineForm)], addMessage)) {
      addDialog.close();
      showMessage(saveMessage, 'Deadline added.', 'success');
      openAddDeadlineButton.focus();
    }
  } catch (error) {
    showMessage(addMessage, error.message, 'error');
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (editingIndex < 0 || saving) return;
  try {
    const next = [...deadlines];
    next[editingIndex] = readDeadline(editForm);
    if (await saveDeadlines(next, editMessage)) {
      editDialog.close();
      showMessage(saveMessage, 'Deadline updated.', 'success');
      deadlineRows.querySelector(`[data-deadline-index="${editingIndex}"] button`)?.focus();
    }
  } catch (error) {
    showMessage(editMessage, error.message, 'error');
  }
});

cancelEditButton.addEventListener('click', () => editDialog.close());
editDialog.addEventListener('cancel', (event) => {
  if (saving) event.preventDefault();
});
refreshButton.addEventListener('click', () => {
  if (!saving) return loadDeadlinesWithFeedback('Refreshing');
});
document.getElementById('logoutButton').addEventListener('click', async () => {
  if (saving || signingOut) return;
  signingOut = true;
  try {
    await renewal;
    await api('/api/admin/logout', { method: 'POST', body: '{}' });
    showSignIn('Signed out.');
  } catch (error) {
    showMessage(saveMessage, error.message, 'error');
  } finally {
    signingOut = false;
  }
});

api('/api/admin/login').then(({ authenticated, expiresAt }) => {
  if (!authenticated || !adminShell.hidden) return;
  loginPanel.hidden = true;
  adminShell.hidden = false;
  watchSession(expiresAt);
  return loadDeadlinesWithFeedback('Loading deadlines');
}).catch((error) => showMessage(loginMessage, error.message, 'error'));
