"""Browser checks for the catalogue details beneath the gallery portrait."""

from pathlib import Path

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:43118"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    assert page.locator("#catalogue-number").inner_text() == "№ 01 / 28"
    assert page.locator("#pronounce-btn").count() == 0
    assert page.get_by_role("button", name="Copy link to Ballendra").is_visible()

    page.locator(".image-frame").hover()
    transform = page.locator("#character-image").evaluate(
        "image => getComputedStyle(image).transform"
    )
    assert transform == "none", transform

    page.get_by_role("button", name="Next character").click()
    assert page.locator("#catalogue-number").inner_text() == "№ 02 / 28"
    page.get_by_role("button", name="Copy link to Birendra").click()
    assert page.evaluate("navigator.clipboard.readText()") == "https://webendra.vercel.app/character/birendra"
    assert page.locator("#toast").inner_text() == "Art piece copied."
    page.evaluate("() => { window.__writeText = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = () => Promise.reject(new Error('blocked')); }")
    page.get_by_role("button", name="Copy link to Birendra").click()
    assert page.locator("#toast").inner_text() == "Link could not be copied."
    page.evaluate("() => { navigator.clipboard.writeText = window.__writeText; }")

    page.keyboard.press("c")
    page.wait_for_function("document.querySelector('#toast').textContent === 'Art piece copied.'")
    page.get_by_role("button", name="Previous character").click()
    assert page.locator("#catalogue-number").inner_text() == "№ 01 / 28"
    page.get_by_role("button", name="Previous character").click()
    assert page.locator("#catalogue-number").inner_text() == "№ 28 / 28"

    page.wait_for_timeout(700)
    page.locator(".image-frame").hover()
    page.screenshot(path=str(Path("test-output") / "curator-desktop.png"))
    page.get_by_role("button", name="Toggle theme").click()
    assert page.locator("html").get_attribute("data-theme") == "dark"
    assert page.locator("#catalogue-number").is_visible()
    page.wait_for_timeout(900)
    page.screenshot(path=str(Path("test-output") / "curator-dark.png"))

    mobile = browser.new_page(viewport={"width": 375, "height": 812}, reduced_motion="reduce")
    mobile.goto(BASE)
    mobile.wait_for_load_state("networkidle")
    assert mobile.locator("#catalogue-number").is_visible()
    assert mobile.get_by_role("button", name="Previous character").is_visible()
    assert mobile.get_by_role("button", name="Next character").is_visible()
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
