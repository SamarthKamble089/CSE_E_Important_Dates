function doGet() {
  if (!editorEmail_()) {
    return HtmlService.createHtmlOutput('<p>This Google account does not have access to the schedule editor.</p>');
  }
  const template = HtmlService.createTemplateFromFile('Admin');
  const url = PropertiesService.getScriptProperties().getProperty('PUBLIC_SITE_URL') || '';
  template.publicSiteUrl = /^https:\/\/[^\s]+$/.test(url) ? url : '#';
  return template.evaluate().setTitle('CSE E Schedule Admin');
}

function adminRequest(action, sessionId, body) {
  const email = editorEmail_();
  if (!email) return { status: 403, error: 'This Google account does not have editor access.' };

  const properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2500)) return { status: 503, error: 'Schedule storage is busy. Please try again.' };
  try {
    const now = Date.now();
    const lease = JSON.parse(properties.getProperty('EDITOR_SESSION') || 'null');
    const active = lease && lease.expiresAt > now;
    const ownsLease = Boolean(active && lease.email === email && lease.id === sessionId);
    if (action === 'status') {
      return { authenticated: ownsLease, expiresAt: ownsLease ? lease.expiresAt : null };
    }
    if (action === 'acquire') {
      if (active && !ownsLease) {
        return { status: 409, error: 'Another admin is using the editor. Please wait and try again.' };
      }
      scheduleFile_(properties);
      const id = ownsLease ? lease.id : Utilities.getUuid();
      return renew_(properties, email, id, now);
    }
    if (action === 'logout') {
      if (ownsLease) properties.deleteProperty('EDITOR_SESSION');
      return { success: true };
    }
    if (!ownsLease) return { status: 401, error: 'Your editing session expired. Please sign in again.' };
    if (action === 'renew') return renew_(properties, email, sessionId, now);

    const file = scheduleFile_(properties);
    const text = file.getBlob().getDataAsString('UTF-8');
    const version = version_(text);
    if (action === 'read') return { text, version };
    if (action !== 'write') return { status: 400, error: 'Unknown action.' };
    if (!body || version !== body.version) {
      return { status: 409, error: 'The schedule changed. Refresh before saving again.' };
    }
    const next = encodeSchedule_(body.items);
    if (next === null) return { status: 400, error: 'Check the deadline fields and try again.' };
    file.setContent(next);
    return { version: version_(next) };
  } catch (_) {
    return { status: 503, error: 'Could not access the Drive schedule. Check the file and account permissions.' };
  } finally {
    lock.releaseLock();
  }
}

function editorEmail_() {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  const allowed = PropertiesService.getScriptProperties().getProperty('EDITOR_EMAILS') || '';
  return email && allowed.split(',').some(value => value.trim().toLowerCase() === email) ? email : '';
}

function scheduleFile_(properties) {
  const file = DriveApp.getFileById(properties.getProperty('SCHEDULE_FILE_ID'));
  if (file.isTrashed() || file.getName() !== 'schedules.txt' || file.getMimeType() !== MimeType.PLAIN_TEXT) {
    throw new Error('Expected a private schedules.txt file.');
  }
  return file;
}

function renew_(properties, email, id, now) {
  const expiresAt = now + 300000;
  properties.setProperty('EDITOR_SESSION', JSON.stringify({ id, email, expiresAt }));
  return { sessionId: id, expiresAt };
}

function encodeSchedule_(items) {
  if (!Array.isArray(items) || items.length > 500) return null;
  const rows = ['# CSE - Section E Important Dates & Schedules'];
  for (const [index, item] of items.entries()) {
    if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(item.due)) return null;
    const values = [item.name, item.subject, item.due, item.time, item.duration];
    if (values.some(value => typeof value !== 'string' || value.length > 160 || /[|\r\n]/.test(value))) return null;
    if (!item.name.trim() || !item.subject.trim()) return null;
    rows.push([index + 1, ...values].join(' | '));
  }
  return rows.join('\n') + '\n';
}

function version_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return digest.map(byte => (byte & 255).toString(16).padStart(2, '0')).join('');
}
