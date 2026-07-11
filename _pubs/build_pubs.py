#!/usr/bin/env python3
"""Build assets/publications.json from publications.bib (+ meta.yml sidecar).

Ground truth is the .bib: authors, title, year, venue string, and the paper
link (url/pdf) are read straight from it. meta.yml only adds venue aliases,
topical tags, and EXTRA links -- it never overrides bib fields.

Run:  uv run build_pubs.py    (from the _pubs/ dir)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import bibtexparser
import yaml

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
BIB = HERE / "publications.bib"
META = HERE / "meta.yml"
OUT = REPO / "assets" / "publications.json"

# venue string comes from booktitle (proceedings) or journal (articles);
# techreports/misc fall back to institution/howpublished.
VENUE_FIELDS = ("booktitle", "journal", "institution", "howpublished", "school")


def clean(s: str) -> str:
    """Strip bibtex braces/whitespace but keep the {*} equal-contrib marker."""
    if s is None:
        return ""
    s = s.replace("\n", " ").replace("\t", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_authors(raw: str) -> list[dict]:
    """Parse a bibtex author field into [{last, first, equal}]. `{*}` on either
    name part marks equal contribution (kept out of the displayed text)."""
    raw = raw.replace("\n", " ")
    people = [p.strip() for p in re.split(r"\band\b", raw) if p.strip()]
    out = []
    for person in people:
        equal = "{*}" in person or "*}" in person or "{*" in person
        name = person.replace("{*}", "").replace("*", "")
        name = name.replace("{", "").replace("}", "").strip()
        if "," in name:  # "Last, First"
            last, first = [x.strip() for x in name.split(",", 1)]
        else:  # "First Last"
            parts = name.split()
            last = parts[-1] if parts else name
            first = " ".join(parts[:-1])
        out.append({"last": last, "first": first, "equal": equal})
    return out


def fmt_author(a: dict) -> str:
    """Render just the last name, appending * for equal contribution."""
    label = a["last"]
    if a["equal"]:
        label += "*"
    return label


def resolve_venue(raw: str, aliases: dict) -> str:
    """Map a raw venue string to a compact label via exact then substring match."""
    raw = clean(raw)
    if not raw:
        return ""
    if raw in aliases:  # exact match wins outright
        return aliases[raw]
    # Otherwise pick the LONGEST alias key that is a case-insensitive substring
    # of the venue string, so the most specific match wins regardless of the
    # order keys are declared (e.g. a workshop-at-ICML beats the generic ICML).
    raw_l = raw.lower()
    best_key, best_val = None, None
    for key, val in aliases.items():
        if key.lower() in raw_l and (best_key is None or len(key) > len(best_key)):
            best_key, best_val = key, val
    if best_key is not None:
        return best_val
    return raw


def parse_month(raw: str) -> int:
    """Best-effort month number (1-12) from a bibtex month field; 0 if unknown.
    Handles `dec`, `December`, `21--27 Jul`, numeric `7`, etc."""
    if not raw:
        return 0
    s = clean(str(raw)).lower()
    months = ["jan", "feb", "mar", "apr", "may", "jun",
              "jul", "aug", "sep", "oct", "nov", "dec"]
    for i, m in enumerate(months, start=1):
        if m in s:
            return i
    m = re.search(r"\b(1[0-2]|0?[1-9])\b", s)
    return int(m.group(1)) if m else 0


def main() -> None:
    meta = yaml.safe_load(META.read_text()) or {}
    aliases = meta.get("venue_aliases", {}) or {}
    legend = meta.get("tag_legend", {}) or {}
    papers_meta = meta.get("papers", {}) or {}

    with BIB.open() as fh:
        db = bibtexparser.load(fh)

    entries = []
    for e in db.entries:
        key = e.get("ID")
        pm = papers_meta.get(key, {}) or {}
        section = pm.get("section", "shown")

        authors = parse_authors(e.get("author", ""))
        venue_raw = next((clean(e[f]) for f in VENUE_FIELDS if e.get(f)), "")
        # arxiv-only entries: journal often "arXiv preprint arXiv:xxxx"
        venue = resolve_venue(venue_raw, aliases)

        # primary paper link straight from the bib
        paper_url = clean(e.get("url") or e.get("pdf") or "")
        links = []
        if paper_url:
            links.append({"type": "paper", "url": paper_url})
        for lk in pm.get("links", []) or []:
            links.append({"type": lk["type"], "url": lk["url"]})

        tags = []
        for t in pm.get("tags", []) or []:
            info = legend.get(t, {})
            tags.append({
                "id": t,
                "emoji": info.get("emoji", ""),
                "label": info.get("label", t),
            })

        # Full-text search blob: every raw bibtex field value (so "neural"
        # matches "NeurIPS", "Adam" matches papers showing only last names,
        # etc.) plus the compact venue label and tag labels. Lowercased.
        search_parts = [str(v) for k, v in e.items()
                        if k not in ("ENTRYTYPE", "ID")]
        search_parts.append(venue)
        for t in tags:
            search_parts.append(t["label"])
            search_parts.append(t["emoji"])
        search_blob = clean(" ".join(search_parts)).lower()

        entries.append({
            "key": key,
            "title": clean(e.get("title", "")).replace("{", "").replace("}", ""),
            "authors": [fmt_author(a) for a in authors],
            "authors_raw": authors,
            "year": int(clean(e.get("year", "0")) or 0),
            "month": parse_month(e.get("month", "")),
            "is_workshop": "workshop" in venue_raw.lower(),
            "venue": venue,
            "venue_raw": venue_raw,
            "links": links,
            "tags": tags,
            "notes": pm.get("notes", ""),
            "section": section,
            "type": e.get("ENTRYTYPE", ""),
            "search": search_blob,
        })

    # newest first: year, then month, then conferences before workshops, then
    # title -- months + workshop-rank let same-year papers order correctly.
    entries.sort(key=lambda x: (-x["year"], -x["month"], x["is_workshop"],
                                x["title"].lower()))

    payload = {
        "generated_from": "publications.bib + meta.yml",
        "tag_legend": legend,
        "entries": entries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    shown = [e for e in entries if e["section"] != "hidden"]
    print(f"Wrote {OUT.relative_to(REPO)}: {len(entries)} entries "
          f"({len(shown)} visible, {len(entries) - len(shown)} hidden).")
    missing = [e["key"] for e in entries if not e["venue"]]
    if missing:
        print(f"  ! no venue resolved for: {', '.join(missing)}")
    untagged = [e["key"] for e in entries
                if not e["tags"] and e["section"] != "hidden"]
    if untagged:
        print(f"  ! untagged (visible): {', '.join(untagged)}")


if __name__ == "__main__":
    main()
