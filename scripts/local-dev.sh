#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set. Example:"
  echo "  export DATABASE_URL=\"postgres://user:pass@localhost:5432/flowsync\""
  exit 1
fi

npm run db:push

echo "Starting backend on http://localhost:3000 ..."
npm run dev:server
