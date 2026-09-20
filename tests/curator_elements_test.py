"""Browser checks for the catalogue details beneath the gallery portrait."""

from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
Path("test-output").mkdir(exist_ok=True)


class SiteHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/character/"):
            page = ROOT / "character" / f"{path.removeprefix('/character/')}.html"
            self.path = f"/character/{page.name}" if page.is_file() else "/index.html"
        super().do_GET()

    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SiteHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{server.server_port}"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    total = page.evaluate("JSON.parse(document.querySelector('#structured-data').textContent).mainEntity.numberOfItems")
    assert page.locator("#catalogue-number").inner_text() == f"№ 01 / {total:02}"
    assert page.locator("#pronounce-btn").count() == 0
    assert page.get_by_role("button", name="Copy link to Ballendra").is_visible()
    assert page.get_by_role("button", name="Copy image of Ballendra").is_visible()
    page.get_by_role("button", name="Copy link to Ballendra").click()
    assert page.evaluate("navigator.clipboard.readText()") == "https://webendra.vercel.app/character/ballendra"

    page.get_by_role("button", name="Copy image of Ballendra").click()
    page.wait_for_function("document.querySelector('#toast').textContent === 'Image copied'")
    page.screenshot(path=str(Path("test-output") / "image-copied-toast.png"))
    has_png = page.evaluate("""async () => {
        const items = await navigator.clipboard.read();
        return items.some(item => item.types.includes('image/png'));
    }""")
    assert has_png

    page.evaluate("() => { window.__write = navigator.clipboard.write.bind(navigator.clipboard); navigator.clipboard.write = () => Promise.reject(new Error('blocked')); }")
    page.get_by_role("button", name="Copy image of Ballendra").click()
    page.wait_for_function("document.querySelector('#toast').textContent === 'Image could not be copied.'")
    page.evaluate("() => { navigator.clipboard.write = window.__write; }")

    page.locator(".image-frame").hover()
    transform = page.locator("#character-image").evaluate(
        "image => getComputedStyle(image).transform"
    )
    assert transform == "none", transform

    page.get_by_role("button", name="Rightendra, next character").click()
    assert page.locator("#catalogue-number").inner_text() == f"№ 02 / {total:02}"
    assert page.get_by_role("button", name="Copy image of Birendra").is_visible()
    page.get_by_role("button", name="Copy image of Birendra").click()
    page.wait_for_function("document.querySelector('#toast').textContent === 'Image copied'")
    page.get_by_role("button", name="Copy link to Birendra").click()
    assert page.evaluate("navigator.clipboard.readText()") == "https://webendra.vercel.app/character/birendra"
    assert page.locator("#toast").inner_text() == "Art piece copied."
    page.evaluate("() => { window.__writeText = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = () => Promise.reject(new Error('blocked')); }")
    page.get_by_role("button", name="Copy link to Birendra").click()
    assert page.locator("#toast").inner_text() == "Link could not be copied."
    page.evaluate("() => { navigator.clipboard.writeText = window.__writeText; }")

    page.keyboard.press("c")
    page.wait_for_function("document.querySelector('#toast').textContent === 'Art piece copied.'")
    page.get_by_role("button", name="Leftendra, previous character").click()
    assert page.locator("#catalogue-number").inner_text() == f"№ 01 / {total:02}"
    page.wait_for_url("**/character/ballendra")
    page.get_by_role("button", name="Leftendra, previous character").click()
    assert page.locator("#catalogue-number").inner_text() == f"№ {total:02} / {total:02}"

    page.wait_for_timeout(700)
    page.locator(".image-frame").hover()
    page.screenshot(path=str(Path("test-output") / "curator-desktop.png"))
    page.get_by_role("button", name="Toggle theme").click()
    assert page.locator("html").get_attribute("data-theme") == "dark"
    assert page.locator("#catalogue-number").is_visible()
    page.wait_for_timeout(900)
    page.screenshot(path=str(Path("test-output") / "curator-dark.png"))

    # Curator colophon & dialog tests
    colophon_btn = page.locator("#curator-colophon-btn")
    curator_dialog = page.locator("#curator-dialog")
    assert colophon_btn.is_visible()
    assert colophon_btn.get_attribute("aria-expanded") == "false"
    assert curator_dialog.is_hidden()

    # Open dialog
    colophon_btn.click()
    assert colophon_btn.get_attribute("aria-expanded") == "true"
    assert curator_dialog.is_visible()
    assert page.locator("#curator-dialog-title").inner_text() == "Aalish Man Singh"
    assert page.locator(".curator-link[href*='linkedin.com']").is_visible()
    assert page.locator(".curator-link[href*='github.com']").is_visible()
    assert page.locator(".curator-link[href*='instagram.com']").is_visible()
    assert page.locator(".curator-qr-img").is_visible()

    # Screenshot in dark mode
    page.screenshot(path=str(Path("test-output") / "curator-dialog-dark.png"))

    # Close via Escape
    page.keyboard.press("Escape")
    assert curator_dialog.is_hidden()
    assert colophon_btn.get_attribute("aria-expanded") == "false"

    # Open and close via close button
    colophon_btn.click()
    assert curator_dialog.is_visible()
    page.locator("#curator-dialog-close").click()
    assert curator_dialog.is_hidden()

    # Open and close via outside click
    colophon_btn.click()
    assert curator_dialog.is_visible()
    page.locator(".character figcaption").click()
    assert curator_dialog.is_hidden()

    mobile = browser.new_page(viewport={"width": 375, "height": 812}, reduced_motion="reduce")
    mobile.goto(BASE)
    mobile.wait_for_load_state("networkidle")
    assert mobile.locator("#catalogue-number").is_visible()
    assert mobile.get_by_role("button", name="Leftendra, previous character").is_visible()
    assert mobile.get_by_role("button", name="Rightendra, next character").is_visible()
    assert mobile.get_by_role("button", name="Copy link to Ballendra").is_visible()
    assert mobile.get_by_role("button", name="Copy image of Ballendra").is_visible()
    assert mobile.locator(".character-meta").evaluate(
        "element => { const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }"
    )

    # Mobile colophon tap
    mob_colophon = mobile.locator("#curator-colophon-btn")
    assert mob_colophon.is_visible()
    mob_colophon.click()
    assert mobile.locator("#curator-dialog").is_visible()
    assert mobile.locator("#curator-dialog").evaluate(
        "element => { const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }"
    )
    mobile.screenshot(path=str(Path("test-output") / "curator-dialog-mobile.png"))
    mobile.locator("#curator-dialog-close").click()
    assert mobile.locator("#curator-dialog").is_hidden()

    mobile.set_viewport_size({"width": 320, "height": 700})
    assert mobile.locator(".character-meta").evaluate(
        "element => { const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }"
    )
    mobile.locator(".image-frame").hover()
    assert mobile.locator("#character-image").evaluate(
        "image => getComputedStyle(image).transform"
    ) == "none"
    mobile.screenshot(path=str(Path("test-output") / "curator-mobile.png"))

    assert not errors, errors
    browser.close()

print("Curator elements passed on desktop, mobile, and reduced motion.")
server.shutdown()
server.server_close()
