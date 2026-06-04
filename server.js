// Tiny zero-dependency proxy + static server.
// Browsers can't call mgate.exe directly (same-origin), so the server fetches
// and parses on behalf of the dashboard at /api/departures.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { fetchCombinedBoard, STOPS } from "./hafas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC = join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}

async function serveStatic(req, res) {
  let path = req.url.split("?")[0];
  if (path === "/") path = "/index.html";
  const file = join(PUBLIC, path);
  if (!file.startsWith(PUBLIC)) return send(res, 403, "Forbidden");
  try {
    const data = await readFile(file);
    send(res, 200, data, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
  } catch {
    send(res, 404, "Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/departures") {
    const maxJny = Math.min(Number(url.searchParams.get("max")) || 40, 60);
    try {
      const data = await fetchCombinedBoard({ maxJny });
      send(res, 200, JSON.stringify(data), { "Content-Type": MIME[".json"] });
    } catch (err) {
      send(res, 502, JSON.stringify({ error: String(err.message || err) }), {
        "Content-Type": MIME[".json"],
      });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`LVB dashboard running at http://localhost:${PORT}`);
  console.log(`Stops: ${STOPS.map((s) => s.name).join(", ")}`);
});
