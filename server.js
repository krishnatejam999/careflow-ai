/**
 * CareFlow AI — zero-dependency HTTP server.
 *
 *   node server.js         → http://localhost:4000
 *   PORT=8080 node server.js
 *
 * Serves the single-page app out of /public and the REST API from /api.
 * No build step, no npm install, no framework.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './lib/api.js';
import { loadFromDisk, storageInfo } from './lib/disk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

// The browser's offline backend imports the same lib/ modules the server uses,
// so those files have to be reachable over HTTP too.
const LIB_DIR = path.join(__dirname, 'lib');
const SHARED_LIB = ['db.js', 'ai.js', 'api.js'];
const SHARED_MIME = { '.js': 'text/javascript; charset=utf-8' };
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, payload, status = 200) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({ __raw: raw }); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';

  // Shared isomorphic modules (whitelisted by name — nothing else from lib/).
  const libMatch = rel.match(/^\/lib\/([\w.-]+)$/);
  if (libMatch) {
    if (!SHARED_LIB.includes(libMatch[1])) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    const libFile = path.join(LIB_DIR, libMatch[1]);
    fs.readFile(libFile, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': SHARED_MIME['.js'], 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
    return;
  }

  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback — anything else renders index.html
      if (path.extname(rel)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      const index = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(index, (e2, buf) => {
        if (e2) { res.writeHead(500).end('Server error'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        res.end(buf);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  // CORS so the deck demo can be embedded anywhere.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  if (pathname.startsWith('/api/')) {
    try {
      const query = Object.fromEntries(url.searchParams.entries());
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const result = handle(req.method, pathname, { query, body, params: {} });
      const status = result.__status || 200;
      const { __status, ...payload } = result;
      sendJson(res, payload, status);
      const stamp = new Date().toLocaleTimeString('en-GB');
      console.log(`  ${stamp}  ${req.method.padEnd(5)} ${pathname}${status >= 400 ? `  → ${status}` : ''}`);
    } catch (err) {
      console.error('API error:', err);
      sendJson(res, { ok: false, error: err.message }, 500);
    }
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  loadFromDisk(); // seed/load on boot so the first request is instant
  const line = '─'.repeat(58);
  console.log(`\n  ${line}`);
  console.log('   CareFlow AI  ·  AI Workforce for Hospital Operations');
  console.log('   "One Intelligent System. Every Hospital Workflow."');
  console.log(`  ${line}`);
  console.log(`   ▲  Listening on  ${HOST}:${PORT}`);
  console.log(`   ●  Data layer   ${storageInfo().file}`);
  console.log('   ✦  5 AI agents online: Reception · Records · Workflow · Comm. · Coordinator');
  console.log(`  ${line}\n`);
});

// Graceful shutdown so container platforms can roll out cleanly.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`\n  ${signal} received — closing CareFlow AI.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
