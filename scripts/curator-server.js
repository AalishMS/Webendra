#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const UI_FILE = path.join(__dirname, "reorder.html");
const MAX_BODY_BYTES = 64 * 1024;

function revisionFor(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

function readCharacters(root) {
  const cataloguePath = path.join(root, "catalogue.js");
  delete require.cache[require.resolve(cataloguePath)];
  const characters = require(cataloguePath);
  if (!Array.isArray(characters) || characters.length === 0) {
    throw new Error("The catalogue is empty or invalid.");
  }
  return characters;
}

function locateCharacterBlocks(source) {
  const declaration = /const\s+characters\s*=\s*\[/.exec(source);
  if (!declaration) throw new Error("Could not find the characters array in catalogue.js.");
  const arrayStart = source.indexOf("[", declaration.index);
  const blocks = [];
  let blockStart = -1;
  let braceDepth = 0;
  let quote = "";
  let lineComment = false;
  let blockComment = false;
  let arrayEnd = -1;

  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") {
      if (braceDepth === 0) blockStart = index;
      braceDepth += 1;
      continue;
    }
    if (character === "}") {
      braceDepth -= 1;
      if (braceDepth < 0) throw new Error("The characters array has unbalanced braces.");
      if (braceDepth === 0 && blockStart !== -1) {
        blocks.push({ start: blockStart, end: index + 1, text: source.slice(blockStart, index + 1) });
        blockStart = -1;
      }
      continue;
    }
    if (character === "]" && braceDepth === 0) {
      arrayEnd = index;
      break;
    }
  }

  if (arrayEnd === -1 || braceDepth !== 0 || blocks.length === 0) {
    throw new Error("Could not safely parse the characters array.");
  }

  let separatorStart = arrayStart + 1;
  for (const block of blocks) {
    if (!/^[\s,]*$/.test(source.slice(separatorStart, block.start))) {
      throw new Error("Standalone catalogue comments cannot be reordered safely; move them inside an artwork block.");
    }
    separatorStart = block.end;
  }
  if (!/^[\s,]*$/.test(source.slice(separatorStart, arrayEnd))) {
    throw new Error("Unexpected content follows the final catalogue entry.");
  }

  const bySlug = new Map();
  for (const block of blocks) {
    const match = /\bname\s*:\s*("(?:\\.|[^"\\])*")/.exec(block.text);
    if (!match) throw new Error("Every catalogue block must contain a double-quoted name.");
    const slug = JSON.parse(match[1]).toLowerCase();
    if (bySlug.has(slug)) throw new Error(`Duplicate catalogue block: ${slug}`);
    bySlug.set(slug, block.text);
  }

  return { arrayStart, arrayEnd, blocks, bySlug };
}

function reorderCatalogueSource(source, order) {
  const parsed = locateCharacterBlocks(source);
  const existing = [...parsed.bySlug.keys()];
  if (!Array.isArray(order) || order.length !== existing.length) {
    throw new Error(`Order must contain exactly ${existing.length} artwork slugs.`);
  }
  if (order.some((slug) => typeof slug !== "string" || !/^[a-z]+$/.test(slug))) {
    throw new Error("Every order entry must be a lowercase artwork slug.");
  }
  if (new Set(order).size !== order.length) throw new Error("Order contains duplicate artwork slugs.");
  const expected = new Set(existing);
  const unknown = order.filter((slug) => !expected.has(slug));
  const missing = existing.filter((slug) => !order.includes(slug));
  if (unknown.length || missing.length) {
    throw new Error(`Order does not match the catalogue. Unknown: ${unknown.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}.`);
  }

  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lastBlock = parsed.blocks.at(-1);
  const trailingComma = source.slice(lastBlock.end, parsed.arrayEnd).includes(",") ? "," : "";
  const contents = order.map((slug) => parsed.bySlug.get(slug)).join(`,${newline}  `);
  return `${source.slice(0, parsed.arrayStart + 1)}${newline}  ${contents}${trailingComma}${newline}${source.slice(parsed.arrayEnd)}`;
}

function generatedFiles(root) {
  const files = ["catalogue.js", "index.html", "sitemap.xml", "vercel.json"]
    .map((name) => path.join(root, name));
  const characterDirectory = path.join(root, "character");
  if (fs.existsSync(characterDirectory)) {
    files.push(...fs.readdirSync(characterDirectory)
      .filter((name) => name.endsWith(".html"))
      .map((name) => path.join(characterDirectory, name)));
  }
  return files;
}

function takeSnapshot(files) {
  return new Map(files.map((file) => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
}

function restoreSnapshot(snapshot, root) {
  for (const [file, content] of snapshot) {
    if (content === null) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      fs.writeFileSync(file, content);
    }
  }
  const known = new Set(snapshot.keys());
  const characterDirectory = path.join(root, "character");
  if (fs.existsSync(characterDirectory)) {
    for (const name of fs.readdirSync(characterDirectory).filter((item) => item.endsWith(".html"))) {
      const file = path.join(characterDirectory, name);
      if (!known.has(file)) fs.unlinkSync(file);
    }
  }
}

function runMetadata(root, args) {
  return spawnSync(process.execPath, [path.join(root, "scripts", "generate-metadata.js"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function resultMessage(result) {
  return (result.stderr || result.stdout || result.error?.message || "Metadata generation failed.").trim();
}

function applyOrder(root, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Save requests must include a revision and an order array.");
    error.statusCode = 400;
    throw error;
  }
  const { revision, order } = payload;
  const cataloguePath = path.join(root, "catalogue.js");
  const source = fs.readFileSync(cataloguePath, "utf8");
  if (typeof revision !== "string" || revision !== revisionFor(source)) {
    const error = new Error("The catalogue changed after this board was opened. Reload before saving.");
    error.statusCode = 409;
    throw error;
  }

  let candidate;
  try {
    candidate = reorderCatalogueSource(source, order);
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
  if (candidate === source) return { revision, changed: false };

  const snapshot = takeSnapshot(generatedFiles(root));
  try {
    fs.writeFileSync(cataloguePath, candidate, "utf8");
    const generated = runMetadata(root, ["--skip-share-cards"]);
    if (generated.status !== 0) throw new Error(resultMessage(generated));
    const checked = runMetadata(root, ["--check", "--skip-share-cards"]);
    if (checked.status !== 0) throw new Error(resultMessage(checked));
    const savedSource = fs.readFileSync(cataloguePath, "utf8");
    return { revision: revisionFor(savedSource), changed: true };
  } catch (error) {
    restoreSnapshot(snapshot, root);
    throw new Error(`The new order was not saved. All files were restored. ${error.message}`);
  }
}

function publicCatalogue(root) {
  const cataloguePath = path.join(root, "catalogue.js");
  const source = fs.readFileSync(cataloguePath, "utf8");
  const characters = readCharacters(root).map((character) => ({
    slug: character.name.toLowerCase(),
    name: character.name,
    displayName: character.displayName,
    image: character.image,
    alt: character.alt,
  }));
  return { revision: revisionFor(source), characters };
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function startServer({ root = DEFAULT_ROOT, port = 4174, quiet = false } = {}) {
  root = path.resolve(root);
  let saving = false;
  let retriedWithAvailablePort = false;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    const address = server.address();
    const allowedOrigins = new Set([
      `http://127.0.0.1:${address.port}`,
      `http://localhost:${address.port}`,
    ]);

    try {
      if (request.method === "GET" && pathname === "/api/catalogue") {
        sendJson(response, 200, publicCatalogue(root));
        return;
      }
      if (request.method === "POST" && pathname === "/api/order") {
        if (!request.headers.origin || !allowedOrigins.has(request.headers.origin)) {
          sendJson(response, 403, { error: "This save request did not come from the local curator board." });
          return;
        }
        if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
          sendJson(response, 415, { error: "Save requests must use application/json." });
          return;
        }
        if (saving) {
          sendJson(response, 409, { error: "Another save is already in progress." });
          return;
        }
        saving = true;
        try {
          const result = applyOrder(root, await readJson(request));
          sendJson(response, 200, {
            ok: true,
            revision: result.revision,
            changed: result.changed,
            message: result.changed ? "Order saved. The gallery is ready for review." : "The order is already current.",
          });
        } finally {
          saving = false;
        }
        return;
      }
      if (request.method === "GET" && (pathname === "/" || pathname === "/reorder")) {
        const html = fs.readFileSync(UI_FILE);
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'self'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(html);
        return;
      }
      if (request.method === "GET" && /^\/assets\/[a-z0-9-]+\.png$/.test(pathname)) {
        const asset = path.join(root, pathname.slice(1));
        if (!fs.existsSync(asset)) {
          response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          response.end("Asset not found");
          return;
        }
        response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
        fs.createReadStream(asset).pipe(response);
        return;
      }
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && !retriedWithAvailablePort) {
      retriedWithAvailablePort = true;
      if (!quiet) console.warn(`Port ${port} is already in use. Choosing an available local port instead.`);
      server.listen(0, "127.0.0.1");
      return;
    }
    if (!quiet) console.error(`Curator server could not start: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    if (quiet) return;
    const actualPort = server.address().port;
    console.log(`Webendra curator: http://127.0.0.1:${actualPort}`);
    console.log("Drag the distinguished guests, then choose Save order. Press Ctrl+C to stop.");
  });
  return server;
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (require.main === module) {
  const root = readArgument("--root") || DEFAULT_ROOT;
  const rawPort = readArgument("--port") || process.env.PORT || "4174";
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Invalid port: ${rawPort}`);
    process.exitCode = 1;
  } else {
    startServer({ root, port });
  }
}

module.exports = {
  applyOrder,
  locateCharacterBlocks,
  publicCatalogue,
  reorderCatalogueSource,
  revisionFor,
  startServer,
};
