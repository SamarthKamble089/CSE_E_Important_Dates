const googleSessionKey = 'csee-google-editor-session';
let googleSessionId = '';
try { googleSessionId = sessionStorage.getItem(googleSessionKey) || ''; } catch {}

async function requestGoogleAdmin(url, options) {
  const method = options.method || 'GET';
  const action = url === '/api/admin/logout' ? 'logout'
    : url === '/api/deadlines' ? (method === 'PUT' ? 'write' : 'read')
    : { GET: 'status', POST: 'acquire', PATCH: 'renew' }[method];
  const body = options.body ? JSON.parse(options.body) : null;
  const result = await new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(() => reject(new Error('Could not reach the Google editor. Try again.')))
      .adminRequest(action, googleSessionId, body);
  });
  if (result.error) {
    const error = new Error(result.error);
    error.status = result.status;
    throw error;
  }
  if (result.sessionId) {
    googleSessionId = result.sessionId;
    try { sessionStorage.setItem(googleSessionKey, googleSessionId); } catch {}
  }
  if (action === 'logout') {
    googleSessionId = '';
    try { sessionStorage.removeItem(googleSessionKey); } catch {}
  }
  if (action === 'read') return { version: result.version, items: parseTxtContent(result.text) };
  return result;
}
