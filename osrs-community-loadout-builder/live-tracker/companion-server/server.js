const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '0.0.0.0';
// Serve the unified ESOG Companion UI two directories above this server.
const publicDir = path.resolve(__dirname, '..', '..');

const sessions = new Map();
const history = [];
const HISTORY_LIMIT = 1000;
const RECENT_LOOT_LIMIT = 30;

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

function sumValues(obj) {
  return obj && typeof obj === 'object'
    ? Object.values(obj).reduce((total, value) => total + (Number(value) || 0), 0)
    : Number(obj || 0);
}

function formatDuration(ms) {
  let seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function normaliseTelemetry(incoming) {
  const previous = sessions.get(incoming.rsn) || {};
  const rawXpGained = incoming.xpGained && typeof incoming.xpGained === 'object' ? incoming.xpGained : (previous.xpGainedBySkill || {});
  const rawXpPerHour = incoming.xpPerHour && typeof incoming.xpPerHour === 'object' ? incoming.xpPerHour : (previous.xpPerHourBySkill || {});
  const recentLoot = Array.isArray(previous.recentLoot) ? [...previous.recentLoot] : [];

  if (incoming.type === 'loot' && incoming.event) {
    const items = incoming.event.items || {};
    const names = Object.keys(items);
    if (names.length) {
      names.forEach(name => recentLoot.push({
        name,
        quantity: Number(items[name] || 1),
        value: names.length === 1 ? Number(incoming.event.valueGp || 0) : null,
        source: incoming.event.source || 'Loot',
        pvp: Boolean(incoming.event.pvp),
        timestamp: incoming.timestamp || new Date().toISOString()
      }));
    } else {
      recentLoot.push({
        name: incoming.event.source || 'Loot event',
        quantity: 1,
        value: Number(incoming.event.valueGp || 0),
        timestamp: incoming.timestamp || new Date().toISOString()
      });
    }
  }

  const event = {
    ...previous,
    ...incoming,
    receivedAt: new Date().toISOString(),
    xpGainedBySkill: rawXpGained,
    xpPerHourBySkill: rawXpPerHour,
    xpGained: sumValues(rawXpGained),
    xpPerHour: sumValues(rawXpPerHour),
    lootValue: Number(incoming.lootGp ?? previous.lootGp ?? 0),
    supplyCost: Number(incoming.estimatedSupplyGp ?? previous.estimatedSupplyGp ?? 0),
    netProfit: Number(incoming.netGp ?? previous.netGp ?? 0),
    profitPerHour: Number(incoming.profitPerHourGp ?? previous.profitPerHourGp ?? 0),
    kills: Number(incoming.npcLootEvents ?? previous.npcLootEvents ?? 0),
    sessionDuration: formatDuration(incoming.elapsedMs ?? previous.elapsedMs ?? 0),
    recentLoot: recentLoot.slice(-RECENT_LOOT_LIMIT)
  };

  if (incoming.type === 'loot' && incoming.event && incoming.event.source) {
    event.activity = incoming.event.source;
  }
  return event;
}

function localAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces || []) {
      if (info.family === 'IPv4' && !info.internal) addresses.push(info.address);
    }
  }
  return [...new Set(addresses)];
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
      const incoming = JSON.parse(raw || '{}');
      if (!incoming.rsn || !incoming.type) return json(res, 400, { error: 'rsn and type required' });

      const event = normaliseTelemetry(incoming);
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

  if (req.method === 'GET' && req.url === '/api/health') {
    return json(res, 200, { ok: true, service: 'ESOG Companion', serverTime: new Date().toISOString() });
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
  console.log(`ESOG Companion local: http://127.0.0.1:${PORT}`);
  const addresses = localAddresses();
  if (addresses.length) {
    console.log('Phone addresses:');
    addresses.forEach(address => console.log(`  http://${address}:${PORT}`));
  } else {
    console.log(`Phone: open http://<YOUR-PC-LAN-IP>:${PORT} on the same Wi-Fi`);
  }
  console.log('Read-only RuneLite telemetry + unified ESOG mobile dashboard.');
});
