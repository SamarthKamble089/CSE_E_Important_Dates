const loginPanel = document.getElementById('loginPanel');
const adminShell = document.getElementById('adminShell');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const deadlineForm = document.getElementById('deadlineForm');
const saveMessage = document.getElementById('saveMessage');
const deadlineRows = document.getElementById('deadlineRows');
const deadlineCount = document.getElementById('deadlineCount');
const emptyMessage = document.getElementById('emptyMessage');
const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
const editMessage = document.getElementById('editMessage');
const confirmEditButton = document.getElementById('confirmEditButton');
const fieldTemplate = document.getElementById('deadlineFields');

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
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
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

function render() {
  deadlineRows.replaceChildren();
  deadlineCount.textContent = `${deadlines.length} deadline${deadlines.length === 1 ? '' : 's'}`;
  emptyMessage.hidden = deadlines.length > 0;

  deadlines.forEach((item, index) => {
    const row = document.createElement('tr');
    const values = [item.name, item.subject, `${item.due} · ${item.time ? displayTime(timeForInput(item.time)) : '--'}`, item.duration];
    values.forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    const actions = document.createElement('td');
    actions.className = 'row-actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'secondary';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => startEdit(index));
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => removeDeadline(index));
    actions.append(editButton, deleteButton);
    row.appendChild(actions);
    deadlineRows.appendChild(row);
  });
}

async function loadDeadlines() {
  showMessage(saveMessage, 'Loading deadlines…');
  version = '';
  saveDeadlineButton.disabled = true;
  const data = await api('/api/deadlines');
  version = data.version;
  const stored = version === 'browser-preview' ? localStorage.getItem(BROWSER_PREVIEW_KEY) : null;
  const items = stored ? JSON.parse(stored) : data.items;
  deadlines = Array.isArray(items) ? items.map((item, index) => ({
    sn: Number(item.sn) || index + 1,
    name: item.name || '',
    subject: item.subject || '',
    due: item.due || '',
    time: item.time || '',
    duration: item.duration || ''
  })) : [];
  render();
  saveDeadlineButton.disabled = false;
  showMessage(saveMessage, version === 'browser-preview' ? 'Preview edits are saved in this browser.' : '');
}

async function saveDeadlines(next, message = saveMessage) {
  if (!version || saving) return false;
  saving = true;
  confirmEditButton.disabled = true;
  cancelEditButton.disabled = true;
  saveDeadlineButton.disabled = true;
  showMessage(message, 'Saving to the website…');
  try {
    const normalized = next.map((item, index) => ({ ...item, sn: index + 1 }));
    if (version === 'browser-preview') {
      localStorage.setItem(BROWSER_PREVIEW_KEY, JSON.stringify(normalized));
    } else {
      const result = await api('/api/deadlines', {
        method: 'PUT',
        body: JSON.stringify({ items: normalized, version })
      });
      version = result.version;
    }
    deadlines = normalized;
    render();
    showMessage(message, version === 'browser-preview' ? 'Saved in this browser.' : 'Saved.', 'success');
    return true;
  } catch (error) {
    showMessage(message, error.message, 'error');
    return false;
  } finally {
    saving = false;
    confirmEditButton.disabled = false;
    cancelEditButton.disabled = false;
    saveDeadlineButton.disabled = false;
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

async function removeDeadline(index) {
  if (!version || saving) return;
  if (!window.confirm(`Delete "${deadlines[index].name}"?`)) return;
  const next = deadlines.filter((_, current) => current !== index);
  await saveDeadlines(next);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(loginMessage, 'Signing in…');
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      })
    });
    loginPanel.hidden = true;
    adminShell.hidden = false;
    await loadDeadlines().catch((error) => showMessage(saveMessage, error.message, 'error'));
  } catch (error) {
    showMessage(loginMessage, error.message, 'error');
  }
});

deadlineForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    if (await saveDeadlines([...deadlines, readDeadline(deadlineForm)])) resetAddForm();
  } catch (error) {
    showMessage(saveMessage, error.message, 'error');
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
      deadlineRows.rows[editingIndex]?.querySelector('button')?.focus();
    }
  } catch (error) {
    showMessage(editMessage, error.message, 'error');
  }
});

cancelEditButton.addEventListener('click', () => editDialog.close());
editDialog.addEventListener('cancel', (event) => {
  if (saving) event.preventDefault();
});
document.getElementById('refreshButton').addEventListener('click', async () => {
  if (saving) return;
  try {
    await loadDeadlines();
  } catch (error) {
    showMessage(saveMessage, error.message, 'error');
  }
});
document.getElementById('logoutButton').addEventListener('click', async () => {
  if (saving) return;
  try {
    await api('/api/admin/logout', { method: 'POST', body: '{}' });
  } catch (error) {
    showMessage(saveMessage, error.message, 'error');
    return;
  }
  version = '';
  adminShell.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
  showMessage(loginMessage, 'Signed out.');
});

resetAddForm();

api('/api/admin/login').then(({ authenticated }) => {
  if (!authenticated) return;
  loginPanel.hidden = true;
  adminShell.hidden = false;
  return loadDeadlines().catch((error) => showMessage(saveMessage, error.message, 'error'));
}).catch((error) => showMessage(loginMessage, error.message, 'error'));
