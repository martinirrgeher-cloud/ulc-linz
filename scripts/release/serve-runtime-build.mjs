import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const baseUrl = new URL(process.env.E2E_RUNTIME_BASE_URL || "http://127.0.0.1:4175");
const root = resolve(process.env.E2E_RUNTIME_DIST_DIR || ".ulc-runtime-dist");
const host = baseUrl.hostname;
const port = Number(baseUrl.port || 4175);

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".webmanifest", "application/manifest+json"],
  [".woff2", "font/woff2"],
]);

function insideRoot(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  const target = resolve(root, relative || "index.html");
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(prefix)) return null;
  return target;
}

function sendFile(response, file) {
  response.statusCode = 200;
  response.setHeader("content-type", mime.get(extname(file).toLowerCase()) || "application/octet-stream");
  response.setHeader("cache-control", "no-store");
  createReadStream(file).pipe(response);
}

if (!existsSync(resolve(root, "index.html"))) {
  console.error(`Runtime-Build fehlt: ${root}`);
  process.exit(1);
}

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url || "/", baseUrl);
    const requested = insideRoot(url.pathname);
    if (!requested) {
      response.statusCode = 400;
      response.end("Bad Request");
      return;
    }

    if (existsSync(requested) && statSync(requested).isFile()) {
      sendFile(response, requested);
      return;
    }

    // SPA-Fallback fuer React-Router-Routen wie /module/athletes.
    sendFile(response, resolve(root, "index.html"));
  } catch (error) {
    response.statusCode = 500;
    response.end("Runtime server error");
    console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`ULC Runtime-Testserver: ${baseUrl.origin} -> ${root}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
