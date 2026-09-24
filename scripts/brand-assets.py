#!/usr/bin/env python3
"""Resize the committed brand artwork in public/brand/ into web sizes (K5.1). Same crops, same colours — only
scaled; never recoloured or re-cropped. Also writes the 1200x630 Open Graph image on manila. Idempotent."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

B = Path(__file__).resolve().parent.parent / 'public' / 'brand'
OUT = B / 'web'
OUT.mkdir(exist_ok=True)

def fit(src, px, name, fmt='PNG', **kw):
    im = Image.open(B / src).convert('RGBA')
    im.thumbnail((px, px), Image.LANCZOS)
    im.save(OUT / name, fmt, **kw)

for suffix in ['', '-dark']:
    fit(f'greenhouse-explorer-mark{suffix}.png', 64, f'mark{suffix}-64.png', optimize=True)        # header 30 px @2x
    fit(f'greenhouse-explorer-mark{suffix}.png', 32, f'mark{suffix}-32.png', optimize=True)        # banner 16 px @2x
    fit(f'greenhouse-explorer-illustration{suffix}.png', 880, f'illustration{suffix}-880.webp', 'WEBP', quality=86, method=6)
    fit(f'greenhouse-explorer-illustration{suffix}.png', 520, f'illustration{suffix}-520.webp', 'WEBP', quality=86, method=6)
fit('greenhouse-explorer-mark.png', 180, 'apple-touch-icon.png', optimize=True)
for s in (32, 16):
    fit('favicon-512.png', s, f'favicon-{s}.png', optimize=True)

# Open Graph: 1200x630 manila, illustration left, wordmark right
og = Image.new('RGB', (1200, 630), '#efe3c6')
ill = Image.open(B / 'greenhouse-explorer-illustration.png').convert('RGBA')
ill.thumbnail((560, 560), Image.LANCZOS)
og.paste(ill, (60, (630 - ill.height) // 2), ill)
draw = ImageDraw.Draw(og)
font = None
for cand in ['node_modules/@fontsource/source-sans-3/files', '/System/Library/Fonts/Supplemental/Georgia.ttf']:
    p = Path(cand)
    if p.is_file():
        font = cand
try:
    big = ImageFont.truetype(font or '/System/Library/Fonts/Supplemental/Georgia.ttf', 84)
    small = ImageFont.truetype(font or '/System/Library/Fonts/Supplemental/Georgia.ttf', 30)
except OSError:
    big = small = ImageFont.load_default()
draw.text((660, 220), 'Greenhouse', fill='#2a231a', font=big)
draw.text((660, 310), 'Explorer', fill='#6b5f4b', font=big)
draw.text((662, 430), 'Prototype for critique · not peer reviewed', fill='#6b5f4b', font=small)
og.save(OUT / 'og-1200x630.png', optimize=True)
for f in sorted(OUT.iterdir()):
    print(f.name, f.stat().st_size)
