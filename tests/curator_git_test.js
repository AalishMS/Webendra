"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  applyOrder,
  gitCommitAndPush,
  gitStatus,
  publicCatalogue,
  startServer,
} = require("../scripts/curator-server.js");

const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "webendra-curator-git-"));

function copy(file) {
  const destination = path.join(temp, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: temp, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

async function run() {
  // 1. Non-git directory check
  const nonGitStatus = gitStatus(temp);
  assert.equal(nonGitStatus.isGit, false);
  assert.match(nonGitStatus.error, /Not a git repository/);

  assert.throws(
    () => gitCommitAndPush(temp, { message: "Fails outside git", push: false }),
    /Not a git repository/
  );

  // 2. Setup git repository in fixture
  for (const file of ["catalogue.js", "index.html", "sitemap.xml", "vercel.json", "scripts/generate-metadata.js"]) copy(file);
  for (const name of fs.readdirSync(path.join(root, "character"))) copy(`character/${name}`);
  const originalCharacters = require(path.join(root, "catalogue.js"));
  for (const character of originalCharacters) copy(character.image.split("?")[0].slice(1));

  runGit(["init", "-b", "main"]);
  runGit(["config", "user.email", "curator@test.local"]);
  runGit(["config", "user.name", "Curator Test"]);
  runGit(["config", "commit.gpgsign", "false"]);
  runGit(["add", "-A"]);
  runGit(["commit", "-m", "Initial test commit"]);

  // 3. gitStatus in clean repo
  const cleanStatus = gitStatus(temp);
  assert.equal(cleanStatus.isGit, true);
  assert.equal(cleanStatus.branch, "main");
  assert.equal(cleanStatus.clean, true);
  assert.equal(cleanStatus.modifiedFiles.length, 0);

  // 4. Validation
  assert.throws(() => gitCommitAndPush(temp, { message: "" }), /A commit message is required/);
  assert.throws(() => gitCommitAndPush(temp, { message: "   " }), /A commit message is required/);
  assert.throws(() => gitCommitAndPush(temp, null), /A commit message is required/);

  // 5. Clean working tree commit attempt (push = false)
  const noOp = gitCommitAndPush(temp, { message: "Nothing changed", push: false });
  assert.equal(noOp.committed, false);
  assert.equal(noOp.pushed, false);
  assert.match(noOp.message, /Nothing to commit/);

  // 6. Modified file commit
  fs.writeFileSync(path.join(temp, "note.txt"), "Dignified note.\n", "utf8");
  const dirtyStatus = gitStatus(temp);
  assert.equal(dirtyStatus.clean, false);
  assert.ok(dirtyStatus.modifiedFiles.some((f) => f.includes("note.txt")));

  const commitResult = gitCommitAndPush(temp, { message: "Add dignified note", push: false });
  assert.equal(commitResult.ok, true);
  assert.equal(commitResult.committed, true);
  assert.equal(commitResult.pushed, false);
  assert.ok(commitResult.hash);
  assert.equal(runGit(["log", "-1", "--format=%s"]), "Add dignified note");
  assert.equal(runGit(["log", "-1", "--format=%h"]), commitResult.hash);

  const postCommitStatus = gitStatus(temp);
  assert.equal(postCommitStatus.clean, true);

  // 7. Server endpoints integration
  const server = startServer({ root: temp, port: 0, quiet: true });
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  try {
    // GET /api/git/status
    const statusRes = await fetch(`${origin}/api/git/status`, {
      headers: { Origin: origin },
    });
    assert.equal(statusRes.status, 200);
    const serverGitStatus = await statusRes.json();
    assert.equal(serverGitStatus.isGit, true);
    assert.equal(serverGitStatus.branch, "main");
    assert.equal(serverGitStatus.clean, true);

    // POST /api/git/commit without origin is rejected
    const forbidden = await fetch(`${origin}/api/git/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Should fail", push: false }),
    });
    assert.equal(forbidden.status, 403);

    // POST /api/git/commit with empty message is rejected
    const badRequest = await fetch(`${origin}/api/git/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ message: "", push: false }),
    });
    assert.equal(badRequest.status, 400);

    // Reorder catalogue and commit in one request
    const initial = publicCatalogue(temp);
    const originalOrder = originalCharacters.map((c) => c.name.toLowerCase());
    const reordered = [...originalOrder];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];

    const commitOrderRes = await fetch(`${origin}/api/git/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        revision: initial.revision,
        order: reordered,
        message: "Rearrange gallery: swap first two guests",
        push: false,
      }),
    });
    assert.equal(commitOrderRes.status, 200);
    const commitOrderData = await commitOrderRes.json();
    assert.equal(commitOrderData.ok, true);
    assert.equal(commitOrderData.committed, true);
    assert.equal(commitOrderData.pushed, false);
    assert.equal(commitOrderData.changed, true);
    assert.ok(commitOrderData.hash);

    assert.equal(runGit(["log", "-1", "--format=%s"]), "Rearrange gallery: swap first two guests");
    delete require.cache[require.resolve(path.join(temp, "catalogue.js"))];
    assert.deepEqual(require(path.join(temp, "catalogue.js")).map((c) => c.name.toLowerCase()), reordered);

    const finalStatus = gitStatus(temp);
    assert.equal(finalStatus.clean, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("Curator git commit and push features validate, execute, and integrate safely.");
}

run().finally(() => {
  try {
    fs.rmSync(temp, { recursive: true, force: true });
  } catch (_e) {}
});
