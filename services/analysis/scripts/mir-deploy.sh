#!/usr/bin/env bash
# One-shot MIR Phase 5 activation. Run from services/analysis/.
#
# Prereqs (one-time setup — see MIR_PHASE5.md):
#   • Cloudflare R2 bucket named "earprint-models" with Public Access ON
#   • R2 API token in ~/.aws/credentials profile [r2]
#   • R2_ACCOUNT_ID env var set
#   • MIR_MODEL_BUCKET env var set (e.g. https://pub-<hash>.r2.dev)
#   • flyctl logged in, earprint-analyzer app exists
#
# This script:
#   1. Uploads all 6 model files to R2 (idempotent — skips files already present)
#   2. Scales the Fly machine to 1 GB memory (~$2/mo)
#   3. Deploys with ENABLE_MIR=true + MIR_MODEL_BUCKET baked in
#   4. Tails logs until "loaded Discogs-EffNet" appears (or 60 s timeout)

set -euo pipefail

FLY_APP="${FLY_APP:-earprint-analyzer}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID env var}"
MIR_MODEL_BUCKET="${MIR_MODEL_BUCKET:?Set MIR_MODEL_BUCKET (public R2 URL)}"

echo "── 1. Upload models to R2 ─────────────────────────────"
./scripts/upload-models.sh

echo
echo "── 2. Scale Fly memory to 1 GB ────────────────────────"
flyctl scale memory 1024 --app "$FLY_APP"

echo
echo "── 3. Deploy with MIR enabled ─────────────────────────"
flyctl deploy --app "$FLY_APP" \
  --build-arg ENABLE_MIR=true \
  --build-arg "MIR_MODEL_BUCKET=$MIR_MODEL_BUCKET"

echo
echo "── 4. Wait for first MIR batch ────────────────────────"
echo "Tailing logs (Ctrl-C when you see 'loaded Discogs-EffNet'):"
echo
flyctl logs --app "$FLY_APP" | while IFS= read -r line; do
  echo "$line"
  if echo "$line" | grep -q "loaded Discogs-EffNet"; then
    echo
    echo "✓ MIR is live. Continuing in the background — check with:"
    echo "    ./scripts/mir-smoke-test.sh"
    exit 0
  fi
done
