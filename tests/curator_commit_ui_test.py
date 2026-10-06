"""Browser checks for the curator board commit and push feature."""

import json
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PYTHON_OUTPUT = ROOT / "test-output"
PYTHON_OUTPUT.mkdir(exist_ok=True)


def copy_fixture(destination: Path) -> list[dict]:
    files = [
        "catalogue.js",
        "index.html",
        "sitemap.xml",
        "vercel.json",
        "scripts/generate-metadata.js",
    ]
    for relative in files:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    shutil.copytree(ROOT / "character", destination / "character")
    characters = json.loads(subprocess.check_output(
        ["node", "-e", "console.log(JSON.stringify(require('./catalogue.js')))"],
        cwd=ROOT,
        text=True,
    ))
    for character in characters:
        relative = character["image"].split("?")[0].removeprefix("/")
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    return characters


with tempfile.TemporaryDirectory(prefix="webendra-curator-commit-ui-") as temporary:
    fixture = Path(temporary)
    original = copy_fixture(fixture)

    # Initialize git in fixture
    subprocess.run(["git", "init", "-b", "main"], cwd=fixture, check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["git", "config", "user.email", "curator@webendra.test"], cwd=fixture, check=True)
    subprocess.run(["git", "config", "user.name", "Curator Tester"], cwd=fixture, check=True)
    subprocess.run(["git", "config", "commit.gpgsign", "false"], cwd=fixture, check=True)
    subprocess.run(["git", "add", "-A"], cwd=fixture, check=True)
    subprocess.run(["git", "commit", "-m", "Initial test commit"], cwd=fixture, check=True, stdout=subprocess.DEVNULL)

    with socket.socket() as available:
        available.bind(("127.0.0.1", 0))
        port = available.getsockname()[1]

    process = subprocess.Popen(
        ["node", str(ROOT / "scripts" / "curator-server.js"), "--root", str(fixture), "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            try:
                with urlopen(base, timeout=0.2) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(0.05)
        else:
            raise RuntimeError(process.stderr.read() or "Curator server did not start")

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            errors = []
            page.on("pageerror", lambda problem: errors.append(str(problem)))
            page.goto(base)
            page.wait_for_load_state("networkidle")

            commit_btn = page.locator("#commit-btn")
            assert commit_btn.is_visible()
            assert commit_btn.is_disabled(), "Commit button should be disabled when clean"

            pieces = page.locator(".piece")
            first_slug = original[0]["name"].lower()
            first = page.locator(f'[data-slug="{first_slug}"]')

            # Drag to reorder
            first.drag_to(pieces.nth(2))
            assert commit_btn.is_enabled(), "Commit button should be enabled when order is dirty"

            # Open commit dialog
            commit_btn.click()
            modal = page.locator("#commit-modal")
            assert modal.is_visible()

            # Verify dialog contents
            message_input = page.locator("#commit-message")
            assert message_input.is_visible()
            assert message_input.input_value() == "Rearrange gallery sequence"

            push_checkbox = page.locator("#commit-push-checkbox")
            assert push_checkbox.is_visible()
            assert push_checkbox.is_checked()

            # Test Escape closes modal
            page.keyboard.press("Escape")
            assert not modal.is_visible()

            # Re-open dialog
            commit_btn.click()
            assert modal.is_visible()

            # Change commit message and uncheck push (since local test fixture has no remote)
            message_input.fill("Rearrange artworks for exhibition")
            push_checkbox.uncheck()

            # Submit commit
            page.locator("#commit-submit").click()
            page.locator('#status[data-kind="success"]').wait_for()

            assert not modal.is_visible()
            assert commit_btn.is_disabled(), "Commit button should be disabled after committing changes"

            # Verify git log in fixture
            latest_commit = subprocess.check_output(
                ["git", "log", "-1", "--format=%s"],
                cwd=fixture,
                text=True,
            ).strip()
            assert latest_commit == "Rearrange artworks for exhibition", latest_commit

            # Screenshot the success state
            page.screenshot(path=str(PYTHON_OUTPUT / "curator-commit-success.png"), full_page=True)

            # Check modal appearance in dark mode
            page.locator("#theme-toggle").click()
            assert page.locator("html").get_attribute("data-theme") == "dark"

            # Reorder again to test dark mode modal
            first.drag_to(pieces.nth(3))
            assert commit_btn.is_enabled()
            commit_btn.click()
            assert modal.is_visible()
            page.screenshot(path=str(PYTHON_OUTPUT / "curator-commit-modal-dark.png"))

            page.locator("#commit-cancel").click()
            assert not modal.is_visible()

            assert not errors, errors
            browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

print("Curator commit and push browser UI tests passed.")
