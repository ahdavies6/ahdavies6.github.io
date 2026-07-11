# Publications build

The **publications page** (`/publications`) is generated, not hand-edited.

## Sources of truth
- `publications.bib` — canonical BibTeX. Parsed **exactly as-is** (authors, title,
  year, venue string, and the paper URL all come from here). This is the same
  `.bib` used elsewhere (e.g. the CV). Edit papers here.
- `meta.yml` — sidecar for what BibTeX can't hold, keyed by citekey:
  - `venue_aliases`: long venue string → compact label (e.g. NeurIPS)
  - `tag_legend`: emoji + label for each topical tag id
  - `papers.<citekey>.tags`: topical tags
  - `papers.<citekey>.links`: EXTRA links (poster/slides/code/webpage/video/…)
  - `papers.<citekey>.notes`: optional note under an entry
  - `papers.<citekey>.section`: `published` (default) | `preprint` | `hidden`

`meta.yml` never overrides the bib. Equal contribution comes from `{*}` in the bib.

## Rebuild
```bash
cd _pubs
uv run build_pubs.py     # writes ../assets/publications.json
```
Commit the regenerated `assets/publications.json` along with your source edits.

## Add a paper
1. Add the entry to `publications.bib`.
2. Add a `papers.<citekey>:` block in `meta.yml` (tags, extra links, etc.).
3. If it's a new venue, add a `venue_aliases` mapping.
4. `uv run build_pubs.py`, then commit.

## Render
`assets/js/publications.js` + `assets/css/publications.css` render the JSON into a
sortable/filterable table. Framework-agnostic vanilla JS — no jQuery, no Jekyll
coupling, so it survives a future move off academic_pages.
