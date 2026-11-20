const loginPanel = document.getElementById('loginPanel');
const adminShell = document.getElementById('adminShell');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const deadlineForm = document.getElementById('deadlineForm');
const saveMessage = document.getElementById('saveMessage');
const deadlineRows = document.getElementById('deadlineRows');
const deadlineCount = document.getElementById('deadlineCount');
const emptyMessage = document.getElementById('emptyMessage');
const formHeading = document.getElementById('formHeading');
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
  resetForm();
  saveDeadlineButton.disabled = false;
  showMessage(saveMessage, version === 'browser-preview' ? 'Preview edits are saved in this browser.' : '');
}

async function saveDeadlines(next) {
  if (!version || saving) return false;
  saving = true;
  saveDeadlineButton.disabled = true;
  showMessage(saveMessage, 'Saving to the website…');
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
    showMessage(saveMessage, version === 'browser-preview' ? 'Saved in this browser.' : 'Saved.', 'success');
    return true;
  } catch (error) {
    showMessage(saveMessage, error.message, 'error');
    return false;
  } finally {
    saving = false;
    saveDeadlineButton.disabled = false;
  }
}

function resetForm() {
  editingIndex = -1;
  deadlineForm.reset();
  document.getElementById('time').value = '23:59';
  formHeading.textContent = 'Add a deadline';
  saveDeadlineButton.textContent = 'Add deadline';
  cancelEditButton.hidden = true;
}

function startEdit(index) {
  const item = deadlines[index];
  editingIndex = index;
  document.getElementById('name').value = item.name;
  document.getElementById('subject').value = item.subject;
  document.getElementById('due').value = item.due;
  document.getElementById('time').value = item.time ? timeForInput(item.time) : '';
  document.getElementById('duration').value = item.duration;
  formHeading.textContent = 'Edit deadline';
  saveDeadlineButton.textContent = 'Save deadline';
  cancelEditButton.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeDeadline(index) {
  if (!window.confirm(`Delete “${deadlines[index].name}”?`)) return;
  const next = deadlines.filter((_, current) => current !== index);
  const saved = await saveDeadlines(next);
  if (saved) resetForm();
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
  const item = {
    sn: editingIndex >= 0 ? deadlines[editingIndex].sn : deadlines.length + 1,
    name: document.getElementById('name').value.trim(),
    subject: document.getElementById('subject').value.trim(),
    due: document.getElementById('due').value,
    time: document.getElementById('time').value,
    duration: document.getElementById('duration').value.trim()
  };
  const next = [...deadlines];
  if (editingIndex >= 0) next[editingIndex] = item;
  else next.push(item);
  if (await saveDeadlines(next)) resetForm();
});

cancelEditButton.addEventListener('click', resetForm);
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

document.getElementById('time').value = '23:59';

api('/api/admin/login').then(({ authenticated }) => {
  if (!authenticated) return;
  loginPanel.hidden = true;
  adminShell.hidden = false;
  return loadDeadlines().catch((error) => showMessage(saveMessage, error.message, 'error'));
}).catch((error) => showMessage(loginMessage, error.message, 'error'));
