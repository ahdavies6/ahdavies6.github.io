# Publications page -- full rebuild spec

This document describes the entire publications system end-to-end, in enough
detail that an agent could recreate it from scratch. It lives on a heavily
modified **academic_pages / minimal-mistakes Jekyll** site, but the design goal
is **framework-agnostic**: the pipeline is a plain Python script + a vanilla-JS
widget, so it survives a future migration off Jekyll. Nothing below depends on
academic_pages internals except the thin Jekyll mount page and the serving
config.

---

## 1. Architecture / data flow

```
publications.bib   (ground truth: BibTeX, parsed exactly as-is)
        +
meta.yml           (user-owned sidecar: venue aliases, per-paper tags/links)
        |
        v
build_pubs.py      (Python; bibtexparser + pyyaml)  --run via uv-->
        |
        v
publications.json  (build artifact; committed)
        |
        v  (fetched at runtime via data-src)
assets/js/publications.js  +  assets/css/publications.css
        |
        v
<div id="pubs"> in _pages/publications.md  ->  /publications
```

**Design rules:**
- The `.bib` is the **single source of truth**. Authors, title, year, venue
  string, and the primary paper URL come straight from it and are never
  overridden. It's the same `.bib` used elsewhere (e.g. the CV).
- `meta.yml` only adds what BibTeX can't hold: compact venue aliases, topical
  tags, extra links (poster/slides/code/...), optional notes, and section
  (hidden/preprint). **It is user-owned -- do not edit without asking.**
- The JSON is a pure build artifact (no framework coupling); the widget is
  vanilla JS with zero dependencies beyond Font Awesome + Academicons, which
  the site already loads globally.

---

## 2. Files

| Path | Role |
|---|---|
| `_pubs/publications.bib` | Ground-truth BibTeX. Edit papers here. |
| `_pubs/meta.yml` | User-owned sidecar (aliases, tags, links, sections). |
| `_pubs/build_pubs.py` | Transform: bib + meta -> `assets/publications.json`. |
| `assets/publications.json` | Build artifact (committed); the widget fetches this. |
| `_pubs/pyproject.toml`, `_pubs/uv.lock` | uv project pinning `bibtexparser`, `pyyaml`. |
| `_pubs/README.md` | Human "how to add a paper" doc. |
| `assets/js/publications.js` | The render/filter widget (vanilla JS IIFE). |
| `assets/css/publications.css` | Theme-inheriting styling. |
| `_pages/publications.md` | Thin Jekyll mount (`permalink: /publications.html`). |
| `serve_local.sh` | Rebuild JSON + `jekyll serve` for local dev. |

---

## 3. build_pubs.py

Run: `cd _pubs && uv run build_pubs.py` (writes `../assets/publications.json`).

Key logic:
- **Paths** are relative to the script: `BIB`, `META`, `OUT` all in `_pubs/`.
- **`VENUE_FIELDS = (booktitle, journal, institution, howpublished, school)`** --
  the venue string is the first of these present (so proceedings use
  `booktitle`, journals `journal`, the dissertation `school`, etc.).
- **`parse_authors`**: splits on ` and `, handles `Last, First` and `First Last`.
  An equal-contribution marker is a literal `{*}` in the bib name; it's parsed
  into an `equal: true` flag and stripped from the displayed text.
- **`fmt_author`**: renders **last name only**, appending `*` when `equal`.
- **`resolve_venue`**: maps the raw venue string to a compact label using
  `meta.venue_aliases`. Exact match wins; otherwise the **longest alias key that
  is a case-insensitive substring** of the venue wins (so a specific
  workshop-at-ICML beats a generic "ICML", and both "Proceedings of the 41st
  ICML" and "Forty-second ICML" match one "International Conference on Machine
  Learning" key). Falls back to the raw string if nothing matches.
- **`parse_month`**: best-effort 1-12 from the bib `month` (`dec`, `December`,
  `21--27 Jul`, numeric `7`, ...); 0 if unknown.
- **`is_workshop`**: `"workshop" in venue_raw.lower()`. Used only as a
  conference-before-workshop sort tiebreak. NOTE: all entries are
  `@inproceedings`, so the BibTeX type can't distinguish conf vs workshop; if a
  future workshop's venue omits the word "workshop", add a sidecar `kind:` field
  instead.
- **`search` blob**: every raw BibTeX field value (except `ENTRYTYPE`/`ID`) plus
  the compact venue + tag labels + emojis, lowercased. This powers full-text
  search (so "neural" matches "NeurIPS", "Adam" matches papers that only show
  last names, etc.).
- **Sort**: `(-year, -month, is_workshop, title.lower())` -- newest first, then
  by month, then conferences before workshops, then title as a stable tiebreak.
- **Output JSON shape**:
  ```json
  {
    "generated_from": "publications.bib + meta.yml",
    "tag_legend": { "<id>": { "emoji": "...", "label": "..." }, ... },
    "entries": [
      {
        "key", "title", "authors" (last names, * for equal),
        "authors_raw" [{last,first,equal}], "year", "month",
        "is_workshop", "venue" (compact), "venue_raw", "links" [{type,url}],
        "tags" [{id,emoji,label}], "notes", "section", "type", "search"
      }, ...
    ]
  }
  ```
- The script prints an entry count and **warns** about any entry with no
  resolved venue or any visible entry with no tags.

---

## 4. meta.yml schema (user-owned)

```yaml
tag_legend:            # every tag id used below MUST be defined here
  <id>: { emoji: "🔎", label: "(mechanistic) interpretability" }

venue_aliases:         # long venue string (exact or substring key) -> compact label
  "International Conference on Machine Learning": "ICML"

papers:                # keyed by BibTeX citekey
  <citekey>:
    tags: [id1, id2]           # topical tags (ids from tag_legend)
    links:                     # EXTRA links; the paper link is auto-added from bib url/pdf
      - { type: poster, url: "..." }
    notes: "optional note under the row"
    section: hidden            # omit = shown; "hidden" drops it from the table
```

`section: hidden` is used for superseded/older versions of a paper.

---

## 5. publications.js (the widget)

Vanilla-JS IIFE, no deps. Mount: `<div id="pubs" data-src="/assets/publications.json">`.
Fetches the JSON, builds chrome once, and re-renders the table body on every
filter change.

**Author bolding**: authors whose last name is "davies" + first initial "a" get
`<strong>` (bold, NOT underlined). This is *your* page.

**Icons**: `ICONS` maps a link `type` -> Font Awesome / Academicons class +
hover title (paper, arxiv, pdf, code, webpage, slides, poster, video, dataset,
blog). Unknown types fall back to a generic link icon. All link icons open in a
new tab (`target=_blank rel=noopener`) and inherit the theme link color (no
custom accent).

**Columns (fixed order everywhere)**: `title, year, venue, authors, topics,
links` -- headers are **lowercase**. Widths from `DEFAULT_WIDTHS =
["37.5%","6%","13.5%","23%","10%","10%"]` via a `<colgroup>` + CSS
`table-layout: fixed`, so percentages scale with the window. Columns are
**drag-resizable** (a `.pub-resizer` handle on each column's right edge trades
width with its neighbor, min 3%, sum preserved); resized widths live only in
`STATE.widths` for the session.

**Sorting**: always year desc -> month desc -> conf-before-workshop -> title.
There is no user-facing sort control (deliberately removed).

**Authors cell**: last names only; a starred author adds a `*`, and if any
author is starred the cell appends an italic `<small>(* denotes equal
contribution)</small>` note.

**Search**: case-insensitive, all whitespace-separated words must hit the
`search` blob (+ title/venue/authors/tag-labels). Full-text over every BibTeX
field value.

### Topic filtering (the fiddly part -- three synced surfaces)

Topics can be toggled from THREE places, all sharing one mechanic and
auto-syncing on every render:
1. the **legend** above the controls (clickable emoji+label+count chips),
2. the **dropdown** (checkbox popover, left of the search box),
3. the **emoji spans inside each table row**.

Shared state + helpers:
- `STATE.allTags` = all topic ids; `STATE.activeTags` = id->bool.
- **Neutral state = every topic selected = show everything** (works because
  every visible paper has >=1 tag, so OR-over-all includes all).
- `toggleTopic(id)`:
  - if currently "full" (all selected) -> **isolate** to just `id`;
  - else if `id` active -> remove it (and if that empties the set, **revert to
    all**);
  - else -> add `id`. (Filter is OR over selected topics.)
- `syncTopics(root)` (called at the end of every `render`): reflects state into
  the legend `.active` class (only when not full), the dropdown checkboxes, and
  the dropdown caption (`topics: all` / `topics: N selected`).
- The dropdown "select all" -> `setAllTopics(true)`; "clear" ->
  `setAllTopics(false)`; the "Clear" button also resets the query.
- Table emojis each carry their own single-topic tooltip (`title = label`).

### Ordering of topics in legend + dropdown
By paper count descending, then label A-Z.

---

## 6. publications.css (conventions)

- **Inherits the theme font + colors everywhere** (`color: inherit; font:
  inherit`) so it never clashes with the active skin (light or dark). A single
  `--pub-line` border tint reads on both.
- Base `#pubs` font-size is `0.75em` to match the sidebar `p`.
- Full-bleed: `.page { padding-right: 0 !important; }` so the table uses the
  whole article width.
- Controls share one box model (`height: 2.6em; box-sizing: border-box`) so the
  dropdown / search / Clear line up; `appearance: none` on the search input
  kills the taller native search chrome.
- The `--pub-pop-bg` popover background defaults to a solid dark `#1b1f24`
  (opaque so it reads on the dark skin) -- **this one value is hardcoded dark**;
  revisit if the site ever switches to a light skin.
- Narrow screens (`max-width: 700px`) collapse the table into stacked cards.
- Known nitpick: vertically centering the `.pub-count` ("N publications") on the
  control row is finicky because of the theme's inherited line-height; current
  approach is `align-self: center; line-height: 1`. Adam has accepted it as-is.

---

## 7. Serving the JSON

`publications.json` is written to **`assets/`** (a normally-served path), so the
widget just fetches it at `data-src="/assets/publications.json"` -- no Jekyll
config needed. The build script (`_pubs/build_pubs.py`) lives in the
underscore-excluded `_pubs/` source dir but writes its output up to `assets/`.

> Note: keep the JSON in a normally-served dir like `assets/`. Do NOT move it
> into `_pubs/` -- Jekyll excludes underscore dirs and prunes them before
> descending, so a file-level `include` won't serve it; the only workaround is
> including the whole `_pubs/` dir, which then dumps all the build sources
> (`build_pubs.py`, `meta.yml`, `.bib`, `uv.lock`, ...) into the public site.

---

## 8. Local dev

Ruby/Jekyll is provided via **pixi** (Ruby 3.3 + c/cxx compilers); Python via
**uv**.

```bash
export PATH="$HOME/.pixi/bin:$PATH"
./serve_local.sh          # rebuilds JSON then serves at 127.0.0.1:4000
# or manually:
( cd _pubs && uv run build_pubs.py )
bundle exec jekyll serve --config _config_local.yml
```

Rebuild the JSON whenever `publications.bib` or `meta.yml` changes, and commit
the regenerated `assets/publications.json` alongside the source edits.

---

## 9. To add a paper

1. Add the entry to `publications.bib` (include a `month` if you want correct
   intra-year ordering; add `{*}` to author names for equal contribution).
2. Add a `papers.<citekey>:` block in `meta.yml` (tags, extra links, notes).
3. If it's a new venue, add a `venue_aliases` mapping (a distinctive substring
   key is fine).
4. `cd _pubs && uv run build_pubs.py`, verify no warnings, then commit.
