#!/usr/bin/env bash
# Renders store artwork with headless Chrome into store/images/.
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
SRC="file:///$(cd src && pwd -W)/screens.html"
mkdir -p images
shot() { # name width height query
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$3" --screenshot="$(pwd -W)/images/$1.png" "$SRC?$4" 2>/dev/null
}
for lang in en ru; do
  shot "screenshot-1-$lang" 1280 800 "lang=$lang&shot=1"
  shot "screenshot-2-$lang" 1280 800 "lang=$lang&shot=2"
  shot "promo-tile-$lang"   440  280 "lang=$lang&shot=tile"
done
ls -la images
