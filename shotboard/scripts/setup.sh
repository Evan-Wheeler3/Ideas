#!/usr/bin/env bash
# One-time setup on macOS / Linux: app dependencies, the export helper, and checks.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;33m▸ %s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

say "Checking Node.js"
if ! command -v node >/dev/null; then
  echo "Node.js 20 or newer is required: https://nodejs.org" >&2
  exit 1
fi
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 20 ] || { echo "Node.js $major found; version 20 or newer is required." >&2; exit 1; }
ok "Node.js $(node -v)"

say "Installing app dependencies"
npm install
ok "npm packages installed"

say "Setting up the export helper (Python)"
PY=""
for candidate in python3.13 python3.12 python3.11 python3; do
  if command -v "$candidate" >/dev/null && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
    PY=$candidate
    break
  fi
done
if [ -z "$PY" ]; then
  warn "Python 3.11+ not found. The app works, but PDF and MP4 export need it."
  warn "Install Python 3.11+ and run this script again."
else
  "$PY" -m venv server/.venv
  server/.venv/bin/python -m pip install --quiet --upgrade pip
  server/.venv/bin/python -m pip install --quiet -r server/requirements-dev.txt
  ok "Export helper installed ($("$PY" --version))"
fi

say "Checking ffmpeg"
if command -v ffmpeg >/dev/null; then
  ok "ffmpeg found: $(ffmpeg -version | head -1 | cut -d' ' -f1-3)"
else
  warn "ffmpeg not on PATH; the export helper will use its bundled copy (imageio-ffmpeg)."
fi

say "Done"
echo "  Start the app:          npm run dev"
echo "  Try it in a browser:    npm run web   (and npm run server for exports)"
