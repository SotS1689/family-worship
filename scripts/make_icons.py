"""Draws the app icons in public/icons/: an open book with a check mark.

    python scripts/make_icons.py

icon.svg is the same drawing by hand; keep the two in step if either changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BROWN = (91, 58, 41)
PAPER = (250, 247, 242)
GOLD = (200, 144, 46)


def draw(size, maskable=False):
    s = 4  # draw large, then shrink for smooth edges
    n = size * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, n, n], fill=BROWN)
        k = 0.8  # keep the drawing inside the maskable safe zone
    else:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.22, fill=BROWN)
        k = 1.0

    def p(x, y):  # 0..100 design units, centred
        return (n / 2 + (x - 50) * n / 100 * k, n / 2 + (y - 50) * n / 100 * k)

    # Two pages
    d.polygon([p(16, 30), p(48, 36), p(48, 78), p(16, 72)], fill=PAPER)
    d.polygon([p(84, 30), p(52, 36), p(52, 78), p(84, 72)], fill=PAPER)
    # Check mark over the right page
    w = int(n * 0.07 * k)
    d.line([p(56, 52), p(66, 62), p(86, 22)], fill=GOLD, width=w, joint="curve")
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
draw(192).save(OUT / "icon-192.png")
draw(512).save(OUT / "icon-512.png")
draw(512, maskable=True).save(OUT / "maskable-512.png")
draw(180, maskable=True).convert("RGB").save(OUT / "apple-touch-icon.png")
print("icons written to", OUT)
