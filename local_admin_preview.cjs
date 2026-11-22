const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

process.env.NODE_ENV = 'development';
process.env.CSEE_LOCAL_PREVIEW = '1';
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');

const routes = new Map([
  ['/api/deadlines', require('./api/deadlines')],
  ['/api/admin/login', require('./api/admin/login')],
  ['/api/admin/logout', require('./api/admin/logout')]
]);

const files = new Map([
  ['/', 'index.html'], ['/admin', 'admin/index.html'],
  ...['index.html', 'style.css', 'script.js', 'schedule-data.js', 'schedule-loader.js', 'schedule-loader.css', 'site-config.js', 'schedules.txt',
    'Time_Table.jpg', 'Time_Table.jpeg', 'Time_Table.png',
    'admin/admin.js', 'admin/admin.css'].map((name) => ['/' + name, name])
]);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname.replace(/\/$/, '') || '/';
    const handler = routes.get(pathname);
    if (handler) {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      req.body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
      };
      await handler(req, res);
      return;
    }
    const file = files.get(pathname);
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', types[path.extname(file)]);
    res.end(await fs.promises.readFile(path.join(__dirname, file)));
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Local preview error');
  }
});

server.listen(4173, '127.0.0.1', () => {
  console.log('Admin editor: http://127.0.0.1:4173/admin');
  console.log('Public schedule: http://127.0.0.1:4173/');
  console.log('Keep this window open while testing. Press Ctrl+C to stop.');
});
