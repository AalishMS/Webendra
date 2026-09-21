"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {
  applyOrder,
  publicCatalogue,
  reorderCatalogueSource,
  startServer,
} = require("../scripts/curator-server.js");

const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "webendra-curator-"));

function copy(file) {
  const destination = path.join(temp, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}

function trackedOutput() {
  const files = ["catalogue.js", "index.html", "sitemap.xml", "vercel.json"];
  files.push(...fs.readdirSync(path.join(temp, "character")).map((name) => `character/${name}`));
  return new Map(files.map((file) => [file, fs.readFileSync(path.join(temp, file))]));
}

function assertOutputEquals(expected) {
  for (const [file, contents] of expected) {
    assert.deepEqual(fs.readFileSync(path.join(temp, file)), contents, `${file} changed unexpectedly`);
  }
}

async function run() {
  for (const file of ["catalogue.js", "index.html", "sitemap.xml", "vercel.json", "scripts/generate-metadata.js"]) copy(file);
  for (const name of fs.readdirSync(path.join(root, "character"))) copy(`character/${name}`);
  const originalCharacters = require(path.join(root, "catalogue.js"));
  for (const character of originalCharacters) copy(character.image.split("?")[0].slice(1));

  const originalSource = fs.readFileSync(path.join(temp, "catalogue.js"), "utf8");
  const originalOrder = originalCharacters.map((character) => character.name.toLowerCase());
  assert.equal(reorderCatalogueSource(originalSource, originalOrder), originalSource, "a no-op must preserve every byte");

  const initial = publicCatalogue(temp);
  const reordered = [...originalOrder];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  const saved = applyOrder(temp, { revision: initial.revision, order: reordered });
  assert.equal(saved.changed, true);
  delete require.cache[require.resolve(path.join(temp, "catalogue.js"))];
  assert.deepEqual(require(path.join(temp, "catalogue.js")).map((character) => character.name.toLowerCase()), reordered);
  const updatedIndex = fs.readFileSync(path.join(temp, "index.html"), "utf8");
  assert.match(updatedIndex, new RegExp(`<h1 class="character-name">${originalCharacters[1].name}</h1>`));
  assert.match(updatedIndex, new RegExp(`aria-label="Copy link to ${originalCharacters[1].name}"`));
  assert.ok(updatedIndex.includes(`src="${originalCharacters[1].image}"`));
  assert.ok(updatedIndex.includes(`alt="${originalCharacters[1].alt}"`));
  const peakendraBlock = /\{\s*name: "Peakendra",[\s\S]*?\n  \}/.exec(originalSource)[0];
  assert.ok(fs.readFileSync(path.join(temp, "catalogue.js"), "utf8").includes(peakendraBlock));

  const stable = trackedOutput();
  const current = publicCatalogue(temp);
  const badOrders = [
    reordered.slice(1),
    reordered.map((slug, index) => index === 0 ? reordered[1] : slug),
    reordered.map((slug, index) => index === 0 ? "unknownendra" : slug),
    [null, ...reordered.slice(1)],
  ];
  for (const order of badOrders) {
    assert.throws(() => applyOrder(temp, { revision: current.revision, order }));
    assertOutputEquals(stable);
  }
  assert.throws(() => applyOrder(temp, null), /revision and an order array/);
  assertOutputEquals(stable);
  assert.throws(() => applyOrder(temp, { revision: "stale", order: reordered }), /changed after this board was opened/);
  assertOutputEquals(stable);

  const generatorPath = path.join(temp, "scripts", "generate-metadata.js");
  const generator = fs.readFileSync(generatorPath);
  fs.writeFileSync(generatorPath, "process.exit(1);\n");
  const rollbackOrder = [...reordered];
  [rollbackOrder[1], rollbackOrder[2]] = [rollbackOrder[2], rollbackOrder[1]];
  assert.throws(() => applyOrder(temp, { revision: current.revision, order: rollbackOrder }), /All files were restored/);
  assertOutputEquals(stable);
  fs.writeFileSync(generatorPath, generator);

  const server = startServer({ root: temp, port: 0, quiet: true });
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${origin}/api/catalogue`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).characters.map((character) => character.slug), reordered);
    const forbidden = await fetch(`${origin}/api/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: current.revision, order: reordered }),
    });
    assert.equal(forbidden.status, 403);
    const noOp = await fetch(`${origin}/api/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ revision: current.revision, order: reordered }),
    });
    assert.equal(noOp.status, 200);
    assert.equal((await noOp.json()).changed, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const blocker = http.createServer((_request, response) => response.end("occupied"));
  blocker.listen(0, "127.0.0.1");
  await new Promise((resolve) => blocker.once("listening", resolve));
  const occupiedPort = blocker.address().port;
  const fallback = startServer({ root: temp, port: occupiedPort, quiet: true });
  await new Promise((resolve) => fallback.once("listening", resolve));
  assert.notEqual(fallback.address().port, occupiedPort);
  await new Promise((resolve) => fallback.close(resolve));
  await new Promise((resolve) => blocker.close(resolve));

  console.log("Curator ordering validates, regenerates, serves locally, and rolls back safely.");
}

run().finally(() => fs.rmSync(temp, { recursive: true, force: true }));
