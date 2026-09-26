const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const fakeSupabase = `
window.__reviews = {
  entries: [
    {id: 1, character_slug: 'ballendra', user_id: 'me', rating: 4, nickname: 'Ada', review: 'A worthy guest.', created_at: '2026-01-01T00:00:00Z'},
    {id: 2, character_slug: 'ballendra', user_id: 'other', rating: 5, nickname: null, review: null, created_at: '2026-01-02T00:00:00Z'},
  ],
  session: {user: {id: 'me'}},
};
class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'select'; this.start = 0; this.end = Infinity; }
  select() { return this; }
  eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  not(key, operator, value) { this.filters.push(row => row[key] !== value); return this; }
  order(key, options) { (this.sorts ||= []).push({key, descending: !options.ascending}); return this; }
  range(start, end) { this.start = start; this.end = end; return this; }
  insert(values) { this.mode = 'insert'; this.values = values; return this; }
  update(values) { this.mode = 'update'; this.values = values; return this; }
  maybeSingle() { return this.run().then(result => ({...result, data: result.data[0] || null})); }
  then(resolve, reject) { return this.run().then(resolve, reject); }
  async run() {
    const state = window.__reviews;
    if (!navigator.onLine) return {data: null, error: {message: 'Offline'}};
    if (this.table === 'review_summary') {
      const groups = [...new Set(state.entries.map(row => row.character_slug))].map(character_slug => {
        const rows = state.entries.filter(row => row.character_slug === character_slug);
        return {character_slug, rating_count: rows.length, review_count: rows.filter(row => row.review).length,
          average_rating: (rows.reduce((sum, row) => sum + row.rating, 0) / rows.length).toFixed(1)};
      });
      return {data: groups.filter(row => this.filters.every(filter => filter(row))), error: null};
    }
    if (this.mode === 'insert') {
      state.entries.push({id: Date.now(), user_id: state.session.user.id, created_at: new Date().toISOString(), ...this.values});
      return {data: null, error: null};
    }
    if (this.mode === 'update') {
      state.entries.filter(row => this.filters.every(filter => filter(row))).forEach(row => Object.assign(row, this.values));
      return {data: null, error: null};
    }
    let rows = state.entries.filter(row => this.filters.every(filter => filter(row)));
    if (this.sorts) rows = rows.sort((a, b) => {
      for (const {key, descending} of this.sorts) {
        const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
        if (comparison) return descending ? -comparison : comparison;
      }
      return 0;
    });
    return {data: rows.slice(this.start, this.end + 1), error: null};
  }
}
window.supabase = {createClient: () => ({
  auth: {getSession: async () => ({data: {session: window.__reviews.session}, error: null}),
    signInAnonymously: async ({options}) => {
      window.__reviews.lastCaptcha = options.captchaToken;
      window.__reviews.session = {user: {id: 'new-guest'}};
      return {data: {session: window.__reviews.session}, error: null};
    }},
  rpc: async (_name, {requested_slug}) => ({data: window.__reviews.entries.filter(row =>
    row.character_slug === requested_slug && row.user_id === window.__reviews.session.user.id), error: null}),
  from: table => new Query(table),
})};`;

test("reviews follow characters and support edits", async () => {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname.startsWith("/character/") && !url.pathname.endsWith(".html")
      ? `${url.pathname}.html` : url.pathname;
    const file = path.join(root, pathname === "/" ? "index.html" : pathname.slice(1));
    if (!file.startsWith(root) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "text/plain" });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/reviews-config.js", route => route.fulfill({ contentType: "text/javascript", body:
      "window.WEBENDRA_REVIEWS_CONFIG={supabaseUrl:'https://example.supabase.co',publishableKey:'test',turnstileSiteKey:'test'};" }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "text/javascript", body: fakeSupabase }));
    await page.route("https://challenges.cloudflare.com/**", route => route.fulfill({ contentType: "text/javascript", body:
      "window.turnstile={render:(_node,options)=>setTimeout(()=>options.callback('verified-token'),0)};" }));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.querySelector("#review-summary-text").textContent.includes("4.5 / 5"));
    if (process.env.WEBENDRA_GALLERY_SCREENSHOT) {
      await page.screenshot({ path: process.env.WEBENDRA_GALLERY_SCREENSHOT, fullPage: true });
    }
    await page.click("#review-summary");
    if (process.env.WEBENDRA_REVIEW_SCREENSHOT) {
      await page.screenshot({ path: process.env.WEBENDRA_REVIEW_SCREENSHOT, fullPage: true });
    }
    if (process.env.WEBENDRA_MOBILE_SCREENSHOT) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: process.env.WEBENDRA_MOBILE_SCREENSHOT, fullPage: true });
    }
    assert.equal(await page.locator("#review-dialog").evaluate(node => node.open), true);
    assert.equal(await page.locator(".review-entry").count(), 1);
    assert.equal(await page.locator('input[name="rating"]:checked').inputValue(), "4");

    await page.check('input[name="rating"][value="5"]');
    await page.fill("#review-text", "A finer guest.");
    await page.click("#review-submit");
    await page.waitForFunction(() => document.querySelector("#review-summary-text").textContent.includes("5.0 / 5"));
    assert.equal(await page.locator(".review-entry-text").textContent(), "A finer guest.");

    await page.fill("#review-text", "");
    await page.click("#review-submit");
    await page.waitForFunction(() => document.querySelector("#review-list").textContent.includes("No written reviews yet."));
    assert.equal(await page.locator("#review-summary-text").textContent(), "5.0 / 5 · 2 ratings · 0 reviews");

    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#review-dialog").evaluate(node => node.open), false);
    await page.click(".arrow--next");
    await page.waitForURL("**/character/birendra");
    await page.waitForFunction(() => document.querySelector("#review-summary-text").textContent.includes("Rate Birendra"));
    await page.click("#review-summary");
    assert.equal(await page.locator("#review-title").textContent(), "Birendra");
    assert.equal(await page.locator("#review-list").textContent(), "No written reviews yet.");
    await page.evaluate(() => { window.__reviews.session = null; });
    await page.check('input[name="rating"][value="3"]');
    await page.click("#review-submit");
    await page.waitForFunction(() => document.querySelector("#review-summary-text").textContent.includes("3.0 / 5"));
    assert.equal(await page.evaluate(() => window.__reviews.lastCaptcha), "verified-token");
    assert.equal(await page.evaluate(() => window.__reviews.entries.find(row => row.character_slug === "birendra").user_id), "new-guest");
    await page.fill("#review-nickname", "Nia");
    await page.fill("#review-text", "A fine glass.");
    await page.click("#review-submit");
    await page.waitForFunction(() => document.querySelector("#review-list").textContent.includes("A fine glass."));
    assert.equal(await page.evaluate(() => window.__reviews.entries.filter(row => row.character_slug === "birendra").length), 1);
    await page.evaluate(() => {
      for (let index = 0; index < 9; index += 1) {
        window.__reviews.entries.push({id: 100 + index, character_slug: "birendra", user_id: `guest-${index}`,
          rating: 4, nickname: `Guest ${index}`, review: `Review ${index}`,
          created_at: new Date(Date.UTC(2026, 1, index + 1)).toISOString()});
      }
    });
    await page.keyboard.press("Escape");
    await page.click("#theme-toggle");
    await page.click("#review-summary");
    assert.equal(await page.locator("#review-dialog").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(8, 10, 15)");
    await page.waitForFunction(() => document.querySelectorAll(".review-entry").length === 8);
    await page.click("#review-more");
    await page.waitForFunction(() => document.querySelectorAll(".review-entry").length === 10);
    await page.keyboard.press("Escape");
    await page.goto(`http://127.0.0.1:${server.address().port}/character/dogendra`);
    await page.waitForFunction(() => document.querySelector("#review-summary-text").textContent.includes("Rate Dogendra"));
    assert.equal(await page.locator("#review-title").textContent(), "Dogendra");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("webendra:characterchange", {
      detail: { slug: "dogendra", name: "Dogendra" },
    })));
    await page.waitForFunction(() => document.querySelector("#review-summary-text").textContent === "Reviews offline");
    await page.click("#review-summary");
    await page.waitForFunction(() => document.querySelector("#review-list").textContent.includes("Reviews need a connection."));
    await context.setOffline(false);
    await page.goto(`http://127.0.0.1:${server.address().port}/reviews.html`);
    await page.waitForFunction(() => document.querySelector(".card-rating").textContent.includes("rating"));
    assert.equal(await page.locator(".artwork-card").count(), 27);
    assert.equal(await page.locator('.artwork-card[href*="ballendra"] .card-rating').textContent(), "4.5 / 5 · 2 ratings");
    if (process.env.WEBENDRA_REVIEWS_OVERVIEW_SCREENSHOT) {
      await page.screenshot({ path: process.env.WEBENDRA_REVIEWS_OVERVIEW_SCREENSHOT, fullPage: true });
    }
    await page.locator('.artwork-card[href*="ballendra"]').click();
    await page.waitForURL("**/reviews.html?artwork=ballendra");
    await page.waitForFunction(() => document.querySelectorAll(".review-entry").length === 1);
    assert.equal(await page.locator("#detail-title").textContent(), "Ballendra");
    assert.match(await page.locator("#detail-image").getAttribute("src"), /^\/assets\/ballendra\.png\?v=/);
    assert.equal(await page.locator('input[name="rating"]:checked').inputValue(), "4");
    await page.check('input[name="rating"][value="5"]');
    await page.fill("#review-body", "A finer guest.");
    await page.click("#review-submit");
    await page.waitForFunction(() => document.querySelector("#detail-summary").textContent.includes("5.0 / 5"));
    assert.equal(await page.locator(".entry-body").textContent(), "A finer guest.");
    await page.evaluate(() => {
      for (let index = 0; index < 9; index += 1) {
        window.__reviews.entries.push({id: 200 + index, character_slug: "ballendra", user_id: `person-${index}`,
          rating: index % 2 ? 5 : 2, nickname: `Person ${index}`, review: `Review ${index}`,
          created_at: new Date(Date.UTC(2026, 2, index + 1)).toISOString()});
      }
    });
    await page.locator("#sort-top").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#sort-top").getAttribute("aria-pressed"), "true");
    await page.waitForFunction(() => document.querySelectorAll(".review-entry").length === 8);
    assert.match(await page.locator(".review-entry").first().locator(".entry-stars").getAttribute("aria-label"), /^5 out of 5/);
    await page.click("#load-more");
    await page.waitForFunction(() => document.querySelectorAll(".review-entry").length === 10);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.WEBENDRA_REVIEWS_MOBILE_SCREENSHOT) {
      await page.screenshot({ path: process.env.WEBENDRA_REVIEWS_MOBILE_SCREENSHOT, fullPage: true });
    }
    assert.deepEqual(errors, []);
    await context.close();

    const offlineContext = await browser.newContext({ serviceWorkers: "allow" });
    await offlineContext.route("**/reviews-config.js", route => route.fulfill({ contentType: "text/javascript", body:
      "window.WEBENDRA_REVIEWS_CONFIG={supabaseUrl:'https://example.supabase.co',publishableKey:'test',turnstileSiteKey:'test'};" }));
    await offlineContext.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "text/javascript", body: fakeSupabase }));
    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto(`http://127.0.0.1:${server.address().port}/`);
    await offlinePage.evaluate(() => navigator.serviceWorker.ready);
    await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await offlinePage.goto(`http://127.0.0.1:${server.address().port}/reviews.html`);
    await offlinePage.waitForFunction(() => document.querySelectorAll(".artwork-card").length === characters.length);
    await offlineContext.setOffline(true);
    await offlinePage.reload();
    await offlinePage.waitForFunction(() => document.querySelectorAll(".artwork-card").length === characters.length);
    assert.equal(await offlinePage.locator("#overview-title").textContent(), "The reviews");
    await offlineContext.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
