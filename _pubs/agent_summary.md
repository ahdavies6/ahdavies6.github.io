# Publications implementation

Read this when changing rendering, filtering, or build integration. For source
metadata, setup, generation, and testing commands, use [README.md](README.md).

## Ownership and data flow

1. [build_pubs.py](build_pubs.py) parses the canonical BibTeX and user-owned
   metadata into [public JSON](../assets/publications.json). It owns author
   parsing, venue aliases, dates, and the full-text search blob.
2. [build_html.cjs](build_html.cjs) gives a jsdom document to the shared
   [publications renderer](../assets/js/publications.js), then saves its markup
   to [the generated include](../_includes/publications.generated.html).
3. [The Jekyll page](../_pages/publications.md) includes that fragment inside
   `#pubs`; it does not implement a second renderer.
4. Browser initialization attaches listeners to that markup. Search and topic
   filtering toggle existing rows' `hidden` property. No JSON fetch, duplicate
   table, or browser-side row construction is needed.

Keep BibTeX fields authoritative. Metadata adds aliases, tags, extra links, notes,
visibility, and optional author abbreviation; change classifications only when
requested. Keep the public JSON URL and primary-paper-before-extra-links order.
The generated include and JSON are derived artifacts, never manual edit targets.

## Shared renderer interface

CommonJS exports `createPublications(document)`, returning:

- `build(root, data)`: constructs the static legend, controls, table, rows, and
  empty-state row. Used by the Node generator, not browser initialization.
- `enhance(root)`: reads saved row metadata and attaches controls in place.
  Repeated calls on an enhanced root are harmless.

Each instance is intended for one publications root. The browser creates its
instance automatically on DOM readiness. Build/test dependencies are not shipped.

The serialized interface consists of:

- `.pub-row[data-key][data-tags][data-search]`: entry identity, JSON topic IDs,
  and lowercased search text including raw bibliographic fields and shown text.
- `.pub-legend-item[data-tag]` and `.pub-topic-emoji[data-tag]`: topic controls,
  activated by enhancement with keyboard handlers and button semantics.
- `.pub-search`, `.pub-reset`, `.pub-count`, `.pub-empty-row`, and the table's
  columns/resize handles: stable elements enhanced without replacement.
- `.pub-enhanced` on the root: successful initialization; CSS can reveal controls.

Keep construction free of browser-only layout measurements. The resize handler
measures geometry only during a user interaction, so jsdom is sufficient to build.

## Presentation and interaction invariants

- Preserve the six lowercase columns, default widths, inherited theme styling,
  link icons, mobile cards, and existing publication content.
- Authors display as surnames; Adam Davies is bold and equal contribution uses
  stars plus the explanatory note. For abbreviated entries, the visible span is
  explicitly named `.pub-authors-abbreviated` and hidden from assistive reading;
  `.pub-authors-full` contains all full names in the same cell, visually hidden
  but accessible. It must not affect layout.
- Search requires all whitespace-separated query words. Topic selection is AND,
  with all topics selected as the neutral state. Clicking a neutral topic isolates
  it; removing the last selected topic restores all. Clear resets both inputs.
- Legend counts cover visible publications, ordered by count then label. The
  dynamic publication count reports filtered versus total visible entries.
- Resizing trades width between adjacent columns with the existing minimums.
  Filtering must preserve those columns and all row identities.
- `[hidden]` must override the mobile table/card `display` rules.
- Static markup has no fake working controls. Search/reset/resize stay hidden
  until enhancement succeeds. Errors are logged and surfaced without erasing
  publications. Blocked JavaScript leaves a readable static table.

## Escaping, builds, and verification

Publication strings use text nodes; the small author-markup formatter escapes
names before inserting its own `strong` tags. DOM attributes serialize search
data safely. The generator encodes braces so bibliography text cannot become
Liquid instructions inside the include; the browser recovers the literal text.

The local script and CI run Python generation, JS generation, then Jekyll.
Both generated artifacts remain committed for plain Jekyll builds. After changing
sources while serving, rerun generation so Jekyll sees the updated include.
Keep `_pubs` excluded from the site and put ignore rules in the root `.gitignore`.

[Renderer tests](tests/renderer.test.cjs) exercise the public build/enhance
interface and saved-markup freshness. [Browser tests](tests/browser.test.cjs)
exercise actual Jekyll output, including row preservation, mobile filtering,
no-JavaScript access, and failure handling. Keep both green; changes to the
serialized interface require regenerating the include.
