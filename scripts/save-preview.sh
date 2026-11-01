#!/usr/bin/env bash
# Plan morning-digest § 3/§ 4: run rig and save one page as a self-contained HTML file.
# Usage: scripts/save-preview.sh [night] [out]   (default 2026-10-28, var/preview/digest-<night>.html)
# Marker comes from .env (LANE_MARKER). For the clean-up copy, run with NO_MARKER=1.
# Output goes under var/ (git-ignored): previews never go in the repo (ADR 0003).
set -euo pipefail
cd "$(dirname "$0")/.."
night=${1:-2026-10-28}
out=${2:-var/preview/digest-$night.html}
port=${PREVIEW_PORT:-8799}
mkdir -p "$(dirname "$out")"
envfile=(--env-file-if-exists=.env)
if [[ ${NO_MARKER:-} == 1 ]]; then envfile=(); fi
env -u LANE_MARKER PORT="$port" node "${envfile[@]}" --import tsx src/server.ts >/dev/null 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null' EXIT
for _ in $(seq 50); do curl -sf "localhost:$port/health" >/dev/null && break; sleep 0.2; done
curl -sf "localhost:$port/digest/$night" -o "$out"
echo "$out"
