#!/bin/bash
# SimchaKit Deploy Script
# Place at: /path/to/simchakit/deploy.sh  (in the SimchaKit root, alongside server.js)
# No editing required — the script locates itself automatically.
# Usage: bash deploy.sh  (from inside the simchakit folder)
# Or from anywhere: bash /path/to/simchakit/deploy.sh

set -e  # Stop immediately if any command fails

SIMCHAKIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$SIMCHAKIT_DIR/client"
PUBLIC_DIR="$SIMCHAKIT_DIR/public"
DIST_DIR="$CLIENT_DIR/dist"

echo ""
echo "================================================"
echo "  SimchaKit Deploy"
echo "================================================"
echo "  Root: $SIMCHAKIT_DIR"

# ── 0. Sync changelog to V3 public ───────────────
echo ""
echo "▶ Syncing changelog..."
CHANGELOG_SRC="$SIMCHAKIT_DIR/changelog.json"
CHANGELOG_DST="$CLIENT_DIR/public/changelog.json"
if [ -f "$CHANGELOG_SRC" ]; then
    cp "$CHANGELOG_SRC" "$CHANGELOG_DST"
    echo "  ✓ changelog.json → client/public/changelog.json"
else
    echo "  ⚠ changelog.json not found at $CHANGELOG_SRC — skipping"
fi

# ── 1. Build ──────────────────────────────────────
echo ""
echo "▶ Building..."
cd "$CLIENT_DIR"
npm run build

# ── 2. Deploy shared assets ───────────────────────
echo ""
echo "▶ Deploying assets..."
rm -rf "$PUBLIC_DIR/assets"
cp -r "$DIST_DIR/assets/" "$PUBLIC_DIR/assets/"
echo "  ✓ $(ls "$PUBLIC_DIR/assets/" | wc -l | tr -d ' ') file(s) in public/assets/"
ls "$PUBLIC_DIR/assets/" | sed 's/^/    /'

# ── 3. Deploy favicon ─────────────────────────────
echo ""
echo "▶ Deploying favicon..."
if [ -f "$DIST_DIR/favicon.svg" ]; then
    cp "$DIST_DIR/favicon.svg" "$PUBLIC_DIR/favicon.svg"
    echo "  ✓ favicon.svg"
else
    echo "  ⚠ No favicon.svg in dist/ — skipping"
fi

# ── 4. Deploy index.html to all event folders ─────
echo ""
echo "▶ Deploying to event folders..."
DEPLOYED=0
for EVENT_DIR in "$PUBLIC_DIR"/*/; do
    if [ "$(basename "$EVENT_DIR")" = "assets" ]; then continue; fi
    if [ -f "$EVENT_DIR/index.html" ]; then
        cp "$DIST_DIR/index.html" "$EVENT_DIR/index.html"
        echo "  ✓ $(basename "$EVENT_DIR")/index.html"
        DEPLOYED=$((DEPLOYED + 1))
    fi
done

if [ $DEPLOYED -eq 0 ]; then
    echo "  ⚠ No event folders found. Create one first:"
    echo "    mkdir -p $PUBLIC_DIR/your-event-id"
    echo "    cp $DIST_DIR/index.html $PUBLIC_DIR/your-event-id/index.html"
fi

echo ""
echo "================================================"
echo "  Done — $DEPLOYED event(s) updated"
echo "================================================"
echo ""
