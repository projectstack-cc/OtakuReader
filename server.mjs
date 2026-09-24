// Production server for the self-hosted (Docker/VPS) build.
//
// `vite build` emits a request handler (dist/server/entry-server.js) and static client
// assets (dist/client) but no HTTP server - Vercel supplies that itself. This file is the
// equivalent for a plain Node host: static assets, /api/health, then the SSR handler.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(root, "dist", "client");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const { default: entry } = await import("./dist/server/entry-server.js");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

// Returns the absolute path of a real file under dist/client for this URL, or null.
function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded === "/" || decoded.includes("\0")) return null;
  const file = path.resolve(clientDir, "." + decoded);
  if (!file.startsWith(clientDir + path.sep)) return null; // path traversal guard
  try {
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url ?? "/").split("?")[0];

  if (urlPath === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end('{"ok":true}');
    return;
  }

  const file = req.method === "GET" || req.method === "HEAD" ? resolveStatic(urlPath) : null;
  if (file) {
    const headers = { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" };
    // Hashed build assets never change; the service worker and manifest must stay fresh.
    headers["Cache-Control"] = urlPath.startsWith("/_build/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
    return;
  }

  entry.node(req, res);
});

server.listen(port, host, () => {
  console.log(`OtakuReader listening on http://${host}:${port} (data dir: ${process.env.DATA_DIR ?? "./data"})`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
