"""Browser checks for the private drag-to-reorder curator board."""

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


with tempfile.TemporaryDirectory(prefix="webendra-curator-ui-") as temporary:
    fixture = Path(temporary)
    original = copy_fixture(fixture)
    original_source = (fixture / "catalogue.js").read_bytes()
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
            pieces = page.locator(".piece")
            assert pieces.count() == len(original)
            assert page.get_by_role("button", name="Save order").is_disabled()

            first_slug = original[0]["name"].lower()
            first = page.locator(f'[data-slug="{first_slug}"]')
            first.drag_to(pieces.nth(2))
            assert page.get_by_role("button", name="Save order").is_enabled()
            assert (fixture / "catalogue.js").read_bytes() == original_source
            page.get_by_role("button", name="Reset").click()
            assert pieces.first.get_attribute("data-slug") == first_slug

            pieces.first.focus()
            page.keyboard.press("Space")
            page.keyboard.press("ArrowRight")
            page.keyboard.press("Space")
            assert pieces.nth(1).get_attribute("data-slug") == first_slug
            page.get_by_role("button", name="Save order").click()
            page.locator('#status[data-kind="success"]').wait_for()
            assert page.get_by_role("button", name="Save order").is_disabled()
            page.screenshot(path=str(PYTHON_OUTPUT / "curator-board-desktop.png"), full_page=True)

            saved = json.loads(subprocess.check_output(
                ["node", "-e", "console.log(JSON.stringify(require('./catalogue.js')))"],
                cwd=fixture,
                text=True,
            ))
            assert saved[1]["name"].lower() == first_slug
            home = (fixture / "index.html").read_text(encoding="utf-8")
            assert f'<h1 class="character-name">{saved[0].get("displayName", saved[0]["name"])}</h1>' in home

            mobile = browser.new_page(viewport={"width": 375, "height": 812}, reduced_motion="reduce")
            mobile.goto(base)
            mobile.wait_for_load_state("networkidle")
            assert mobile.locator(".gallery").evaluate(
                "element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; }"
            )
            assert mobile.locator(".piece").first.evaluate(
                "element => getComputedStyle(element).transitionDuration === '0s'"
            )
            mobile.screenshot(path=str(PYTHON_OUTPUT / "curator-board-mobile.png"), full_page=True)
            assert not errors, errors
            browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

print("Curator board passed drag preview, reset, keyboard save, mobile, and reduced-motion checks.")
