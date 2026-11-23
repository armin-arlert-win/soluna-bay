// SOLUNA BAY — a tiny static server for local play (Node 22, stdlib only).
// Serves this directory on http://localhost:8080, with / opening the game.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') {
      // Redirect, not rewrite: the browser must end up at /game/index.html
      // so the game's relative paths (./style.css, ./src/...) resolve.
      res.writeHead(302, { location: '/game/index.html' });
      res.end();
      return;
    }
    const file = join(here, path);
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(8080, () => {
  console.log('SOLUNA BAY at http://localhost:8080');
});
