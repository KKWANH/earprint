#!/usr/bin/env bash
# Post-deploy verification for MIR Phase 5.
#
# Run after `flyctl deploy` with the MIR layer enabled. Confirms:
#   • The Fly service is up (/health)
#   • The MIR deps actually loaded (look for the "loaded Discogs-EffNet"
#     line in the recent logs)
#   • Embeddings are being written (counts the rows added in last 10 min)
#   • At least one user centroid has been computed
#
# Usage:
#   FLY_APP=earprint-analyzer DATABASE_URL='postgresql://...' ./scripts/mir-smoke-test.sh

set -euo pipefail

FLY_APP="${FLY_APP:-earprint-analyzer}"
DB_URL="${DATABASE_URL:?Set DATABASE_URL env var}"

echo "── /health ──────────────────────────────────────────"
if curl -fsS "https://${FLY_APP}.fly.dev/health" | tee /dev/stderr | grep -q '"ok"'; then
  echo "✓ alive"
else
  echo "✗ /health failed — service may not be deployed yet"
  exit 1
fi
echo

echo "── recent logs (looking for 'loaded Discogs-EffNet') ─"
if flyctl logs --app "$FLY_APP" --no-tail 2>/dev/null | tail -200 \
   | grep -E "loaded Discogs-EffNet|loaded head model"; then
  echo "✓ MIR models loaded"
else
  echo "⚠ no 'loaded' line in recent logs — MIR may not have processed a batch yet"
  echo "  trigger an Analyze run on a user with synced tracks and re-run this"
fi
echo

echo "── DB checks ────────────────────────────────────────"
psql "$DB_URL" -At <<SQL
SELECT 'embeddings_total      = ' || count(*)::text FROM embeddings;
SELECT 'embeddings_last_10min = ' || count(*)::text FROM embeddings
  WHERE created_at > now() - interval '10 minutes';
SELECT 'users_with_centroid   = ' || count(*)::text FROM taste_profiles
  WHERE centroid IS NOT NULL;
SELECT 'tracks_pending_mir    = ' || count(*)::text
  FROM tracks t LEFT JOIN embeddings e ON e.track_id = t.id
  WHERE e.track_id IS NULL AND t.preview_url IS NOT NULL;
SQL

echo
echo "Interpretation:"
echo "  • embeddings_total = 0 means MIR hasn't written anything yet"
echo "  • embeddings_last_10min > 0 means MIR is actively running"
echo "  • users_with_centroid > 0 means recommend v2 is live for those users"
echo "  • tracks_pending_mir is the backlog the worker will chew through"
