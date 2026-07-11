#!/usr/bin/env bash
set -euo pipefail

# Regenerate the publications JSON from publications.bib + meta.yml before serving.
( cd _pubs && uv run build_pubs.py )

bundle exec jekyll s --config "_config_local.yml"
