const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");
const createPublications = require("../../assets/js/publications.js");

const data = require("../../assets/publications.json");
const visible = data.entries.filter(entry => entry.section !== "hidden");
const fragment = fs.readFileSync(path.join(__dirname, "../../_includes/publications.generated.html"), "utf8");

function fixture(html = "") {
  const dom = new JSDOM(`<div id="pubs">${html}</div>`);
  const root = dom.window.document.getElementById("pubs");
  return { dom, root, publications: createPublications(dom.window.document) };
}

test("committed HTML is current and contains only visible publications", () => {
  const { dom, root, publications } = fixture();
  publications.build(root, data);
  const saved = fixture(fragment);
  assert.deepEqual([...root.children].map(element => element.outerHTML),
    [...saved.root.children].map(element => element.outerHTML));
  assert.deepEqual([...root.querySelectorAll(".pub-row")].map(row => row.dataset.key),
    visible.map(entry => entry.key));
  assert.equal(root.querySelectorAll(".pub-table").length, 1);
  assert.equal(root.querySelectorAll(".pub-row [role=button]").length, 0);
  for (const entry of visible) {
    const row = root.querySelector(`[data-key="${entry.key}"]`);
    assert.equal(row.querySelector(".pub-title-text").textContent, entry.title);
    assert.deepEqual([...row.querySelectorAll(".pub-link")].map(link => link.getAttribute("href")),
      entry.links.map(link => link.url));
  }
  dom.window.close();
  saved.dom.window.close();
});

test("abbreviation preserves full authors and bolding in the same cell", () => {
  const { dom, root } = fixture(fragment);
  const entry = data.entries.find(entry => entry.key === "bagdasarian2026open");
  const cell = root.querySelector('[data-key="bagdasarian2026open"] .pub-authors');
  assert.equal(cell.querySelector(".pub-authors-abbreviated").innerHTML,
    "Bagdasarian, Tsai, ..., <strong>Davies</strong>, ..., Gruteser");
  assert.equal(cell.querySelector(".pub-authors-full").textContent,
    "Full author list (visible list abbreviated): " +
    entry.authors_raw.map(author => `${author.first} ${author.last}`).join(", "));
  assert.equal(cell.querySelector(".pub-authors-abbreviated").getAttribute("aria-hidden"), "true");
  dom.window.close();
});

test("enhancement, filtering and reset keep the original rows", () => {
  const { dom, root, publications } = fixture(fragment);
  const rows = [...root.querySelectorAll(".pub-row")];
  publications.enhance(root);
  publications.enhance(root);
  assert.deepEqual([...root.querySelectorAll(".pub-row")], rows);
  const search = root.querySelector(".pub-search");
  search.value = "Köksal";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.deepEqual(rows.filter(row => !row.hidden).map(row => row.dataset.key), ["bagdasarian2026open"]);
  root.querySelector(".pub-reset").click();
  assert.equal(rows.filter(row => !row.hidden).length, visible.length);
  root.querySelector('.pub-legend-item[data-tag="agents"]').click();
  assert.equal(rows.filter(row => !row.hidden).length, 3);
  root.querySelector('.pub-legend-item[data-tag="sim"]').click();
  assert.equal(rows.filter(row => !row.hidden).length, 2);
  root.querySelector(".pub-reset").click();
  search.value = "no-such-publication";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.equal(rows.filter(row => !row.hidden).length, 0);
  assert.equal(root.querySelector(".pub-empty-row").hidden, false);
  assert.deepEqual([...root.querySelectorAll(".pub-row")], rows);
  dom.window.close();
});

test("publication text is escaped rather than interpreted as markup", () => {
  const { dom, root, publications } = fixture();
  const entry = structuredClone(visible[0]);
  entry.title = '<img src=x onerror="bad()"> & "quoted"';
  entry.notes = "<script>bad()</script>";
  entry.authors = ['<img src=x onerror="bad()">*'];
  entry.authors_raw = [{ last: '<img src=x onerror="bad()">', first: "A", equal: true }];
  entry.abbreviate_authors = true;
  publications.build(root, { entries: [entry] });
  assert.equal(root.querySelector(".pub-title-text").textContent, entry.title);
  assert.equal(root.querySelector(".pub-note").textContent, entry.notes);
  assert.equal(root.querySelector(".pub-authors-abbreviated").textContent, entry.authors[0]);
  assert.equal(root.querySelectorAll("img, script").length, 0);
  assert.equal(root.querySelector(".pub-equal-note small").textContent, "(* denotes equal contribution)");
  dom.window.close();
});

test("empty publication lists remain readable and enhance safely", () => {
  const { dom, root, publications } = fixture();
  publications.build(root, { entries: [] });
  publications.enhance(root);
  assert.equal(root.querySelector(".pub-count").textContent, "0 publications");
  assert.equal(root.querySelector(".pub-empty-row").hidden, false);
  dom.window.close();
});
