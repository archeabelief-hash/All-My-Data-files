const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '0.0.0.0';
// Serve the unified ESOG Companion UI two directories above this server.
const publicDir = path.resolve(__dirname, '..', '..');

const sessions = new Map();
const history = [];
const HISTORY_LIMIT = 1000;

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function safeFile(urlPath) {
  const clean = urlPath === '/' ? '/index.html' : urlPath.split('?')[0];
  const target = path.normalize(path.join(publicDir, clean));
  return target.startsWith(publicDir) ? target : null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/telemetry') {
    try {
      const raw = await readBody(req);
      const event = JSON.parse(raw || '{}');
      if (!event.rsn || !event.type) return json(res, 400, { error: 'rsn and type required' });

      event.receivedAt = new Date().toISOString();
      sessions.set(event.rsn, event);
      history.push(event);
      if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (req.method === 'GET' && req.url === '/api/live') {
    return json(res, 200, {
      sessions: Array.from(sessions.values()),
      serverTime: new Date().toISOString()
    });
  }

  if (req.method === 'GET' && req.url.startsWith('/api/player/')) {
    const rsn = decodeURIComponent(req.url.substring('/api/player/'.length));
    return json(res, 200, {
      current: sessions.get(rsn) || null,
      recent: history.filter(x => x.rsn === rsn).slice(-100)
    });
  }

  if (req.method === 'GET' && req.url === '/api/history') {
    return json(res, 200, history.slice(-250));
  }

  const file = safeFile(req.url);
  if (!file) return json(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(file);
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'application/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.json' ? 'application/json; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ESOG Companion: http://127.0.0.1:${PORT}`);
  console.log(`Phone: open http://<YOUR-PC-LAN-IP>:${PORT} on the same Wi-Fi`);
  console.log('This server receives read-only RuneLite telemetry and serves the unified mobile dashboard.');
});
