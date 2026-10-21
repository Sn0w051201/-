import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { aiHandler } from "./http";
const root = resolve("dist");
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  if (await aiHandler(req, res)) return;
  try {
    const path = resolve(
      root,
      "." +
        decodeURIComponent(
          new URL(req.url || "/", "http://localhost").pathname,
        ),
    );
    if (path !== root && !path.startsWith(root + sep)) throw new Error();
    let target = path;
    try {
      if ((await stat(target)).isDirectory())
        target = resolve(target, "index.html");
    } catch {
      target = resolve(root, "index.html");
    }
    const data = await readFile(target);
    res.setHeader(
      "Content-Type",
      mime[extname(target)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(Number(process.env.PORT || 8787), "0.0.0.0", () =>
  console.log("MoodNomad server ready"),
);
