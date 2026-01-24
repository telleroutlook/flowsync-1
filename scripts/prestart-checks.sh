#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SERVER_BUNDLE="${ROOT_DIR}/dist-server/server.js"

if [[ ! -f "${SERVER_BUNDLE}" ]]; then
  echo "Missing ${SERVER_BUNDLE}. Run: npm run build"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" && -z "${VCAP_SERVICES:-}" ]]; then
  echo "DATABASE_URL or VCAP_SERVICES must be set."
  exit 1
fi

echo "Prestart checks OK."
