const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const stylesheet = ['schedule-loader.css', 'admin/admin.css'].map(read).join('\n');
const scripts = [
  'schedule-data.js',
  'schedule-loader.js',
  'google-drive/client.js',
  'admin/admin.js'
].map(read).join('\n');

const html = read('admin/index.html')
  .replace(/<link rel="stylesheet"[^>]*>\s*/g, '')
  .replace('</head>', `  <base target="_blank">\n  <style>\n${stylesheet}\n  </style>\n</head>`)
  .replace(/href="\/"/g, 'href="<?= publicSiteUrl ?>"')
  .replace(/        <label>(?:Username|Password)[^\n]*\n/g, '')
  .replace('Sign in to manage important dates and deadlines.', 'Start editing with your signed-in Google account.')
  .replace('type="submit">Sign in</button>', 'type="submit">Start editing</button>')
  .replace(/^[ \t]*<script src="[^"]+" defer><\/script>[^\S\n]*\n/gm, '')
  .replace('</body>', `  <script>\n${scripts.replace(/<\/script/gi, '<\\/script')}\n  </script>\n</body>`);

const output = path.join(__dirname, 'Admin.html');
fs.writeFileSync(output, html);
console.log('Built google-drive/Admin.html');
