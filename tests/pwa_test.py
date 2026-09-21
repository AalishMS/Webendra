"""End-to-end checks for installation metadata and viewed-image offline support."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
image_requests = []



class SiteHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/assets/") and path.endswith(".png"):
            image_requests.append(self.path)
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
        catalogue = page.evaluate("characters.map(({ name, displayName, image }) => ({ name, displayName: displayName || name, image, slug: name.toLowerCase() }))")
        first, second, third, last = catalogue[0], catalogue[1], catalogue[2], catalogue[-1]
        first_path = urlsplit(first["image"]).path
        second_path = urlsplit(second["image"]).path
        third_path = urlsplit(third["image"]).path
        last_path = urlsplit(last["image"]).path
        artwork_paths = {urlsplit(character["image"]).path for character in catalogue}
        page.wait_for_function("""async () => {
          const cache = await caches.open('webendra-images');
          return !!(await cache.match(characters[0].image));
        }""")
        assert page.locator('link[rel="manifest"]').get_attribute("href") == "/manifest.webmanifest"
        assert page.evaluate("fetch('/manifest.webmanifest').then(r => r.json()).then(m => m.display)") == "standalone"
        assert set(requested_images) & artwork_paths == {first_path, second_path, last_path}

        # Seed a stale unversioned portrait, then require the current URL to fetch real bytes.
        page.evaluate("""async (firstPath) => {
          const cache = await caches.open('webendra-images');
          await cache.delete(characters[0].image);
          await cache.put(firstPath, new Response('stale portrait', {
            headers: { 'Content-Type': 'image/png' }
          }));
        }""", first_path)
        page.reload()
        page.wait_for_load_state("networkidle")
        assert page.locator("#character-image").evaluate("image => image.naturalWidth > 0")
        assert page.evaluate("""async () => {
          const cache = await caches.open('webendra-images');
          const response = await cache.match(characters[0].image);
          return response && (await response.blob()).size > 100;
        }""")
        portrait_url = page.evaluate("characters[0].image")
        count_before = image_requests.count(portrait_url)
        page.reload()
        page.wait_for_load_state("networkidle")
        assert image_requests.count(portrait_url) == count_before
        assert not page.evaluate("""async (firstPath) => {
          const cache = await caches.open('webendra-images');
          return !!(await cache.match(firstPath));
        }""", first_path)

        page.get_by_role("button", name="Rightendra, next character").click()
        page.wait_for_function("expected => document.querySelector('#character-name').textContent.trim() === expected", arg=second["displayName"])
        page.wait_for_function("""async () => {
          const cache = await caches.open('webendra-images');
          return !!(await cache.match(characters[1].image));
        }""")

        context.set_offline(True)
        page.goto(f"{base}/character/{second['slug']}")
        page.wait_for_load_state("load")
        assert page.locator("#character-name").inner_text() == second["displayName"]
        assert page.locator("#character-image").evaluate("image => image.naturalWidth > 0")

        # Preloaded adjacent character navigates offline
        page.get_by_role("button", name="Rightendra, next character").click()
        page.wait_for_function("expected => document.querySelector('#character-name').textContent.trim() === expected", arg=third["displayName"])
        assert page.locator("#character-name").inner_text() == third["displayName"]
        assert page.locator("#character-image").evaluate("image => image.naturalWidth > 0")

        # Uncached character fails offline with toast
        page.get_by_role("button", name="Rightendra, next character").click()
        page.wait_for_function("document.querySelector('#toast').textContent.includes('unavailable')")
        assert page.locator("#character-name").inner_text() == third["displayName"]
        assert page.locator("#character-image").evaluate("image => image.naturalWidth > 0")

        page.keyboard.press("ArrowLeft")
        page.wait_for_function("expected => document.querySelector('#character-name').textContent.trim() === expected", arg=second["displayName"])

        page.keyboard.press("ArrowLeft")
        page.wait_for_function("expected => document.querySelector('#character-name').textContent.trim() === expected", arg=first["displayName"])
        page.set_viewport_size({"width": 375, "height": 812})
        page.get_by_role("button", name="Rightendra, next character").tap()
        page.wait_for_function("expected => document.querySelector('#character-name').textContent.trim() === expected", arg=second["displayName"])
        page.get_by_role("button", name="Toggle theme").click()
        assert page.locator("html").get_attribute("data-theme") == "dark"
        assert page.locator('meta[name="theme-color"]').get_attribute("content") == "#080a0f"

        assert not errors, errors
        context.set_offline(False)
        page.evaluate("""async () => {
          const cache = await caches.open('webendra-shell-v3');
          await cache.put('/app.js', new Response('window.staleAppLoaded = true'));
        }""")
        page.reload()
        page.wait_for_load_state("networkidle")
        assert page.evaluate("window.staleAppLoaded === undefined")
        assert page.locator("#character-name").inner_text() == second["displayName"]
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
          return !!(await cache.match(characters[1].image));
        }""")

        direct_context = browser.new_context()
        direct = direct_context.new_page()
        direct_images = []
        direct.on("request", lambda request: direct_images.append(urlsplit(request.url).path)
                  if request.resource_type == "image" else None)
        direct.goto(f"{base}/character/{second['slug']}")
        direct.wait_for_load_state("networkidle")
        assert set(direct_images) & artwork_paths == {second_path, first_path, third_path}
        direct_context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print("PWA metadata, viewed-only cache, offline links, navigation, theme, and cache cleanup passed.")
