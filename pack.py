"""Build the Chrome Web Store upload: dist/save-webp-as-png-<version>.zip

Only runtime files go in; docs, store assets and tests stay out.
Usage: python pack.py
"""
import json, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INCLUDE = ["manifest.json", "background.js", "offscreen.html", "offscreen.js", "lib", "icons", "_locales"]

version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
out = ROOT / "dist" / f"save-webp-as-png-{version}.zip"
out.parent.mkdir(exist_ok=True)

files = []
for item in INCLUDE:
    p = ROOT / item
    files += sorted(f for f in p.rglob("*") if f.is_file()) if p.is_dir() else [p]

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in files:
        z.write(f, f.relative_to(ROOT).as_posix())  # forward slashes, manifest at the root

print(f"{out} ({out.stat().st_size // 1024} KB, {len(files)} files)")
