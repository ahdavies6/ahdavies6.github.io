const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { chromium } = require("playwright");

const data = require("../../assets/publications.json");
const visible = data.entries.filter(entry => entry.section !== "hidden");
const site = path.resolve(process.env.PUBLICATIONS_SITE || path.join(__dirname, "../../_site"));
let server, browser, origin;

before(async () => {
  await fs.access(path.join(site, "publications.html"));
  server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(site, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(site + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const content = await fs.readFile(file);
      const types = { ".html": "text/html", ".js": "application/javascript",
        ".json": "application/json", ".css": "text/css" };
      response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      response.end(content);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end(String(error));
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function openPage(options = {}) {
  const context = await browser.newContext(options);
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  return { context, page };
}

test("built HTML is readable without JavaScript and includes complete authors", async () => {
  const html = await fs.readFile(path.join(site, "publications.html"), "utf8");
  assert.ok(html.includes("Full author list (visible list abbreviated):"));
  for (const entry of visible) assert.ok(html.includes(`data-key="${entry.key}"`));
  for (const entry of data.entries.filter(entry => entry.section === "hidden")) {
    assert.ok(!html.includes(`data-key="${entry.key}"`));
  }
  const { context, page } = await openPage({ javaScriptEnabled: false });
  await page.goto(`${origin}/publications.html`);
  assert.equal(await page.locator(".pub-row:visible").count(), visible.length);
  assert.equal(await page.locator(".pub-search").isVisible(), false);
  assert.equal(await page.locator(".pub-reset").isVisible(), false);
  assert.equal(await page.locator(".pub-resizer:visible").count(), 0);
  assert.equal(await page.locator(".pub-row").first().getAttribute("data-key"), "bagdasarian2026open");
  const links = await page.locator(".pub-row").first().locator(".pub-link").evaluateAll(
    links => links.map(link => ({ href: link.getAttribute("href"), title: link.title })));
  assert.deepEqual(links, [
    { href: "https://research.google/pubs/open-and-emergent-problems-in-agentic-privacy-and-security-a-contextual-angle/", title: "Paper" },
    { href: "https://research.google/blog/open-and-emergent-problems-in-agentic-privacy-and-security-a-contextual-angle/", title: "Blog" }
  ]);
  assert.equal(await page.locator(".pub-authors-abbreviated").innerText(),
    "Bagdasarian, Tsai, ..., Davies, ..., Gruteser");
  assert.equal(await page.locator(".pub-authors-abbreviated strong").innerText(), "Davies");
  const full = page.locator(".pub-authors-full");
  assert.ok((await full.textContent()).includes("Adam Davies"));
  const bounds = await full.boundingBox();
  assert.equal(bounds.width, 1);
  assert.equal(bounds.height, 1);
  await context.close();
});

test("initialization and controls never replace rows or fetch publication JSON", async () => {
  const { context, page } = await openPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let jsonRequests = 0;
  page.on("request", request => {
    if (request.url().endsWith("/assets/publications.json")) jsonRequests++;
  });
  await page.route("**/assets/js/publications.js", async route => {
    await page.evaluate(() => { window.originalRows = [...document.querySelectorAll(".pub-row")]; });
    await route.continue();
  });
  await page.goto(`${origin}/publications.html`);
  await page.waitForSelector("#pubs.pub-enhanced");
  assert.equal(await page.evaluate(() =>
    window.originalRows.every((row, i) => row === document.querySelectorAll(".pub-row")[i])), true);
  const search = page.locator(".pub-search");
  await search.fill("Köksal");
  assert.equal(await page.locator(".pub-row:visible").count(), 1);
  await search.fill("contextual google");
  assert.equal(await page.locator(".pub-row:visible").count(), 1);
  await search.fill("no-such-publication");
  assert.equal(await page.locator(".pub-row:visible").count(), 0);
  assert.equal(await page.locator(".pub-empty").isVisible(), true);
  await page.locator(".pub-reset").click();
  assert.equal(await page.locator(".pub-row:visible").count(), visible.length);

  const agents = page.locator('.pub-legend-item[data-tag="agents"]');
  await agents.click();
  assert.equal(await page.locator(".pub-row:visible").count(), 3);
  assert.equal(await page.locator(".pub-count").innerText(), `3 of ${visible.length} publications`);
  await page.locator('.pub-legend-item[data-tag="sim"]').press("Enter");
  assert.equal(await page.locator(".pub-row:visible").count(), 2);
  await agents.press("Space");
  assert.equal(await page.locator(".pub-row:visible").count(), 2);
  await page.locator('.pub-legend-item[data-tag="sim"]').click();
  assert.equal(await page.locator(".pub-row:visible").count(), visible.length);
  await page.locator('.pub-row [data-tag="agents"]').first().click();
  assert.equal(await page.locator(".pub-row:visible").count(), 3);
  await page.locator(".pub-reset").click();

  const before = await page.locator(".pub-table col").first().getAttribute("style");
  const handle = await page.locator(".pub-resizer").first().boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y + handle.height / 2);
  await page.mouse.up();
  const resized = await page.locator(".pub-table col").first().getAttribute("style");
  assert.notEqual(resized, before);
  await search.fill("Davies");
  await page.locator(".pub-reset").click();
  assert.equal(await page.locator(".pub-table col").first().getAttribute("style"), resized);
  assert.equal(await page.evaluate(() =>
    window.originalRows.every((row, i) => row === document.querySelectorAll(".pub-row")[i])), true);
  assert.equal(await page.locator(".pub-table").count(), 1);
  assert.equal(jsonRequests, 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("mobile filters hide cards without exposing the full-author span", async () => {
  const { context, page } = await openPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${origin}/publications.html`);
  await page.waitForSelector("#pubs.pub-enhanced");
  await page.locator('.pub-legend-item[data-tag="agents"]').click();
  assert.equal(await page.locator(".pub-row:visible").count(), 3);
  await page.locator(".pub-search").fill("Köksal");
  assert.equal(await page.locator(".pub-row:visible").count(), 1);
  const bounds = await page.locator(".pub-authors-full").boundingBox();
  assert.equal(bounds.height, 1);
  await page.locator(".pub-reset").click();
  assert.equal(await page.locator(".pub-row:visible").count(), visible.length);
  await context.close();
});

test("blocked JavaScript and enhancement errors preserve static publications", async () => {
  const { context, page } = await openPage();
  await page.route("**/assets/js/publications.js", route => route.abort());
  await page.goto(`${origin}/publications.html`);
  assert.equal(await page.locator(".pub-row:visible").count(), visible.length);
  assert.equal(await page.locator(".pub-search").isVisible(), false);
  await page.unroute("**/assets/js/publications.js");
  await page.route("**/assets/js/publications.js", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body:
      'document.querySelector(".pub-row").setAttribute("data-tags", "invalid-json");\n' +
      await response.text() });
  });
  await page.reload();
  assert.equal(await page.locator(".pub-row:visible").count(), visible.length);
  assert.equal(await page.locator(".pub-search").isVisible(), false);
  assert.ok((await page.locator(".pub-error").textContent()).includes("still readable"));
  await context.close();
});
