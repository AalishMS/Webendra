"""End-to-end checks for installation metadata and viewed-image offline support."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


class SiteHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/character":
            self.path = "/index.html"
        elif path.startswith("/character/"):
            page = ROOT / "character" / f"{path.removeprefix('/character/')}.html"
            self.path = f"/character/{page.name}" if page.is_file() else "/index.html"
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        super().end_headers()

    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SiteHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_port}"

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(reduced_motion="reduce", has_touch=True)
        page = context.new_page()
        errors = []
        requested_images = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requested_images.append(urlsplit(request.url).path)
                if request.resource_type == "image" else None)

        page.goto(base)
        page.wait_for_load_state("networkidle")
        page.evaluate("navigator.serviceWorker.ready")
        page.wait_for_function("""async () => {
          const cache = await caches.open('webendra-images');
          return !!(await cache.match('/assets/ballendra.png'));
        }""")
        assert page.locator('link[rel="manifest"]').get_attribute("href") == "/manifest.webmanifest"
        assert page.evaluate("fetch('/manifest.webmanifest').then(r => r.json()).then(m => m.display)") == "standalone"
        assert set(path for path in requested_images if path.endswith("endra.png")) == {"/assets/ballendra.png"}

        page.get_by_role("button", name="Rightendra, next character").click()
        page.wait_for_function("document.querySelector('#character-name').textContent.trim() === 'Birendra'")
        page.wait_for_function("""async () => {
          const cache = await caches.open('webendra-images');
          return !!(await cache.match('/assets/birendra.png'));
        }""")

        context.set_offline(True)
        page.goto(f"{base}/character/birendra")
        page.wait_for_load_state("load")
        assert page.locator("#character-name").inner_text() == "Birendra"
        assert page.locator("#character-image").evaluate("image => image.naturalWidth > 0")

        page.get_by_role("button", name="Rightendra, next character").click()
        page.wait_for_function("document.querySelector('#toast').textContent.includes('unavailable')")
        assert page.locator("#character-name").inner_text() == "Birendra"
        assert page.locator("#character-image").evaluate("image => image.naturalWidth > 0")

        page.keyboard.press("ArrowLeft")
        page.wait_for_function("document.querySelector('#character-name').textContent.trim() === 'Ballendra'")
        page.set_viewport_size({"width": 375, "height": 812})
        page.get_by_role("button", name="Rightendra, next character").tap()
        page.wait_for_function("document.querySelector('#character-name').textContent.trim() === 'Birendra'")
        page.get_by_role("button", name="Toggle theme").click()
        assert page.locator("html").get_attribute("data-theme") == "dark"
        assert page.locator('meta[name="theme-color"]').get_attribute("content") == "#080a0f"

        assert not errors, errors
        context.set_offline(False)
        page.evaluate("""async () => {
          const cache = await caches.open('webendra-shell-v2');
          await cache.put('/app.js', new Response('window.staleAppLoaded = true'));
        }""")
        page.reload()
        page.wait_for_load_state("networkidle")
        assert page.evaluate("window.staleAppLoaded === undefined")
        assert page.locator("#character-name").inner_text() == "Birendra"
        page.evaluate("""() => new Promise(resolve => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = resolve;
          image.src = '/assets/nonexistent-webendra.png';
        })""")
        assert not page.evaluate("""async () => {
          const cache = await caches.open('webendra-images');
          return !!(await cache.match('/assets/nonexistent-webendra.png'));
        }""")

        page.evaluate("caches.open('webendra-shell-v0')")
        page.evaluate("navigator.serviceWorker.getRegistration().then(registration => registration.unregister())")
        page.close()
        page = context.new_page()
        page.goto(base)
        page.evaluate("navigator.serviceWorker.ready")
        page.wait_for_function("""async () => !(await caches.keys()).includes('webendra-shell-v0')""")
        assert page.evaluate("""async () => {
          const cache = await caches.open('webendra-images');
          return !!(await cache.match('/assets/birendra.png'));
        }""")

        direct_context = browser.new_context()
        direct = direct_context.new_page()
        direct_images = []
        direct.on("request", lambda request: direct_images.append(urlsplit(request.url).path)
                  if request.resource_type == "image" else None)
        direct.goto(f"{base}/character/birendra")
        direct.wait_for_load_state("networkidle")
        assert set(path for path in direct_images if path.endswith("endra.png")) == {"/assets/birendra.png"}
        direct_context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print("PWA metadata, viewed-only cache, offline links, navigation, theme, and cache cleanup passed.")
