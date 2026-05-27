#!/usr/bin/env bash
# One-time uploader for the MIR model weights to a Cloudflare R2 bucket.
#
# Why: the Discogs-EffNet backbone (~200 MB) shouldn't live in git, and
# fetching from Essentia's CDN at every Fly build is slow + impolite to
# upstream. We mirror the files into R2 once and point the Dockerfile at
# our own copy for repeatable, fast container builds.
#
# Prereqs (one time):
#   1. `brew install awscli`  (or any S3-compatible CLI — R2 speaks S3)
#   2. Cloudflare Dashboard → R2 → Create bucket "earprint-models"
#   3. R2 → Manage R2 API Tokens → Create with R/W on that bucket
#   4. ~/.aws/credentials:
#        [r2]
#        aws_access_key_id     = <token id>
#        aws_secret_access_key = <token secret>
#   5. Find your account ID in the R2 dashboard sidebar
#   6. (Optional) Enable Public Access on the bucket so the Dockerfile
#      can curl without auth. Or use signed URLs — see the comments in
#      services/analysis/Dockerfile.
#
# Usage:
#   R2_ACCOUNT_ID=<your-id> ./scripts/upload-models.sh
#
# Models we pull from Essentia and re-host:
#   • discogs-effnet-bs64-1.pb        (backbone, ~200 MB)
#   • mood_happy-discogs-effnet-1.pb   (~50 KB)
#   • mood_sad-discogs-effnet-1.pb
#   • mood_aggressive-discogs-effnet-1.pb
#   • mood_relaxed-discogs-effnet-1.pb
#   • voice_instrumental-discogs-effnet-1.pb

set -euo pipefail

BUCKET="${R2_BUCKET:-earprint-models}"
ACCOUNT="${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID env var}"
ENDPOINT="https://${ACCOUNT}.r2.cloudflarestorage.com"

ESSENTIA_BASE="https://essentia.upf.edu/models"
MODELS=(
  "feature-extractors/discogs-effnet/discogs-effnet-bs64-1.pb"
  "classification-heads/mood_happy/mood_happy-discogs-effnet-1.pb"
  "classification-heads/mood_sad/mood_sad-discogs-effnet-1.pb"
  "classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.pb"
  "classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.pb"
  "classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.pb"
)

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

for path in "${MODELS[@]}"; do
  filename="$(basename "$path")"
  local_path="$tmpdir/$filename"
  echo "→ downloading $filename from Essentia"
  curl -fsSL "$ESSENTIA_BASE/$path" -o "$local_path"

  size_mb=$(($(stat -f%z "$local_path" 2>/dev/null || stat -c%s "$local_path") / 1024 / 1024))
  echo "   ${size_mb} MB"

  echo "   uploading to s3://$BUCKET/$filename"
  aws --profile r2 --endpoint-url "$ENDPOINT" \
      s3 cp "$local_path" "s3://$BUCKET/$filename" \
      --content-type application/octet-stream
done

echo
echo "✓ all weights uploaded."
echo
echo "Next: update services/analysis/Dockerfile to pull from your R2 bucket"
echo "      (commented block at the bottom — uncomment + set R2 URL)."
echo "      Then: flyctl deploy"
