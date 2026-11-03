#!/usr/bin/env node
// Serves site/ on http://localhost:8080 for local preview.

const fs = require('fs');
const http = require('http');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const PORT = 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(SITE, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(SITE + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
