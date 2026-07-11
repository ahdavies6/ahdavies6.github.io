---
permalink: /publications.html
title: "publications"
layout: single
author_profile: true
---

<link rel="stylesheet" href="{{ '/assets/css/publications.css' | relative_url }}">

<style type="text/css">
  /* centered h2 looks better than left-aligned */
  h2 { margin: 0em 0 0; text-align: center; }
  /* remove permalink-on-hover in section headers */
  .header-link { display: none; }
</style>

<!--
  Publications are generated, not hand-written. Source of truth:
    _pubs/publications.bib   (canonical entries; parsed exactly as-is)
    _pubs/meta.yml           (venue aliases, topical tags, extra links)
  Rebuild after editing either:  cd _pubs && uv run build_pubs.py
  That regenerates assets/publications.json, which this widget renders.
-->

<div id="pubs" data-src="{{ '/assets/publications.json' | relative_url }}"></div>

<script src="{{ '/assets/js/publications.js' | relative_url }}"></script>
