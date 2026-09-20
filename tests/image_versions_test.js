// Exercise a real image-only deployment in an isolated temporary copy.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "webendra-versions-"));
try {
  fs.mkdirSync(path.join(temp, "scripts"));
  fs.mkdirSync(path.join(temp, "assets"));
  for (const file of ["catalogue.js", "index.html", "vercel.json", "scripts/generate-metadata.js"]) {
    fs.copyFileSync(path.join(root, file), path.join(temp, file));
  }
  const original = require(path.join(root, "catalogue.js"));
  for (const character of original) {
    const file = character.image.split("?")[0].slice(1);
    fs.copyFileSync(path.join(root, file), path.join(temp, file));
  }
  const generate = () => execFileSync(process.execPath, ["scripts/generate-metadata.js", "--skip-share-cards"], { cwd: temp });
  generate();
  const read = () => JSON.parse(execFileSync(process.execPath, ["-e", "console.log(JSON.stringify(require('./catalogue.js')))"], { cwd: temp }));
  assert.deepEqual(read(), original);
  fs.appendFileSync(path.join(temp, original[0].image.split("?")[0]), "changed bytes");
  assert.notEqual(spawnSync(process.execPath, ["scripts/generate-metadata.js", "--skip-share-cards", "--check"], { cwd: temp }).status, 0);
  generate();
  const updated = read();
  assert.notEqual(updated[0].image, original[0].image);
  assert.deepEqual(updated.slice(1), original.slice(1));
  assert.ok(fs.readFileSync(path.join(temp, "index.html"), "utf8").includes(`src="${updated[0].image}"`));
  generate();
  assert.deepEqual(read(), updated);
  console.log("Image-only changes update only the affected URL; generation is deterministic.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
