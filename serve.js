import {createReadStream, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8080);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.tif': 'image/tiff',
  '.webp': 'image/webp'
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = normalize(join(root, relativePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  if (!stat.isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }

  const headers = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream'
  };
  const range = request.headers.range;

  if (!range) {
    response.writeHead(200, {...headers, 'Content-Length': stat.size});
    createReadStream(filePath).pipe(response);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    response.writeHead(416, {...headers, 'Content-Range': `bytes */${stat.size}`}).end();
    return;
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;

  if (start > end || start >= stat.size) {
    response.writeHead(416, {...headers, 'Content-Range': `bytes */${stat.size}`}).end();
    return;
  }

  response.writeHead(206, {
    ...headers,
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${stat.size}`
  });
  createReadStream(filePath, {start, end}).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Stawki park viewer: http://127.0.0.1:${port}`);
});
