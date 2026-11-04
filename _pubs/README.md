# Publications

The [publications page](../_pages/publications.md) ships a complete HTML table.
Readers and crawlers can see papers and follow links without JavaScript.
JavaScript adds search, topic filters, and column resizing to the existing rows;
it neither fetches publication data nor rebuilds the table in the browser.

## Sources of truth

- [publications.bib](publications.bib): canonical authors, title, year/month,
  venue, and primary paper URL. Equal contribution comes from `{*}` in names.
- [meta.yml](meta.yml): presentation metadata keyed by citekey:
  - `venue_aliases`: long venue strings to compact labels.
  - `tag_legend` and `papers.<citekey>.tags`: topic definitions and assignments.
  - `papers.<citekey>.links`: extra links, appended after the primary paper link.
  - `papers.<citekey>.notes`: optional note below the title.
  - `papers.<citekey>.section`: `hidden` excludes a paper; otherwise it is shown.
  - `papers.<citekey>.abbreviate_authors`: boolean retaining the first two
    authors, Adam Davies, and the final author, with `...` for omitted runs.
    All names remain in BibTeX, JSON, search, and a visually hidden full-author
    span in the same HTML cell. Screen readers get the full list without also
    reading the abbreviated copy.

Metadata does not override bibliographic fields. Edit sources, not generated files.

## How it builds

```text
publications.bib + meta.yml
    -> build_pubs.py -> assets/publications.json
    -> build_html.cjs + shared JavaScript renderer (jsdom)
    -> _includes/publications.generated.html
    -> Jekyll -> publications.html
```

The [same renderer](../assets/js/publications.js) owns the markup, icons, and
author formatting. Node supplies a lightweight DOM through jsdom at build time;
no browser is needed to generate HTML. Jekyll includes the resulting fragment
without duplicating rendering logic in Liquid. The public JSON URL is retained
for direct consumers, not used by the browser controls.

Both generated files are committed so a plain Jekyll build has publication
content. CI regenerates them before building and tests the resulting page.
Build/test tools stay in `_pubs`, which Jekyll excludes from the public site.

## Setup and rebuild

Prerequisites: the existing Ruby/Bundler and uv setup, plus Node 22 or newer.
Install Node build/test dependencies once (and after lockfile changes):

```bash
cd _pubs
npm ci
```

After changing bibliography/metadata or the JavaScript renderer:

```bash
cd _pubs
uv run --locked build_pubs.py
npm run build
npm test
```

Include both [generated JSON](../assets/publications.json) and
[generated HTML](../_includes/publications.generated.html) with the source
changes. `npm test` checks that the saved HTML matches the renderer and JSON.

From the repository root, `./serve_local.sh` regenerates both before starting
Jekyll. While serving, rerun the generation commands after source changes;
Jekyll watches the generated include, not the excluded `_pubs` inputs.

To add a paper: add its BibTeX entry and metadata, add a venue alias if needed,
then run the generation and test commands above.

## Headless browser checks

Build the site, then test the actual generated page:

```bash
bundle exec jekyll build --config _config_local.yml
cd _pubs
npx playwright install --with-deps --only-shell chromium
npm run test:browser
```

Set `PUBLICATIONS_SITE=/absolute/path/to/output` when testing a different build
directory. Tests start and stop their own local HTTP server and headless browser.
They cover no-JavaScript content, author/link correctness, unchanged row identity
at initialization, search, filters, keyboard input, counts, resizing, mobile
cards, and graceful failure. CI runs both test commands before uploading the site.

## Behavior and limits

- Search is case-insensitive; every query word must match. Full author names and
  raw venue names remain searchable even when the displayed text is abbreviated.
- Selecting a topic from the neutral state isolates it. Additional topics combine
  with AND; deselecting the final topic restores all. Clear also resets search.
- Ordering is newest year/month first, conferences before workshops on ties, then
  title. Filtering preserves row identity and resized column widths.
- Without JavaScript, the table, legend, count, and links remain readable;
  inactive search/reset/resize controls stay hidden. Initialization errors report
  the unavailable controls without removing the table.
- Hidden publications are omitted from the HTML, but remain in the public JSON.
- Static HTML removes the rendering dependency for crawlers. It does not
  guarantee indexing, ranking, Google Scholar inclusion, or extraction of
  visually hidden author text.

See [implementation notes](agent_summary.md) when changing the shared renderer.
