#!/usr/bin/env bash
set -euo pipefail

# Generate publication data and HTML before Jekyll serves the page.
( cd _pubs && uv run --locked build_pubs.py && npm run build )

bundle exec jekyll s --config "_config_local.yml"
