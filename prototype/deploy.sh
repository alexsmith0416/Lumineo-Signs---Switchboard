#!/usr/bin/env bash
# Deploy the Switchboard prototype to Vercel.
#
# Usage:
#   ./deploy.sh           → preview deploy (random URL, safe to share for review)
#   ./deploy.sh --prod    → production deploy (updates the canonical URL)
#
# First time on a new machine:
#   npm i -g vercel
#   vercel login
#   ./deploy.sh           → walks you through `vercel link` on first run
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 1
fi

# Build locally first so type errors surface before we burn a Vercel build
echo "→ Type-checking + building locally..."
npm run build

# vercel.json already sets framework / build / output, so just invoke vercel
if [[ "${1:-}" == "--prod" ]]; then
  echo "→ Deploying to PRODUCTION..."
  vercel --prod
else
  echo "→ Deploying preview..."
  vercel
fi
