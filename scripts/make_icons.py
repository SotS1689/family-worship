"""Draws the app icons in public/icons/: an open book with a check mark.

    python scripts/make_icons.py

icon.svg is the same drawing by hand; keep the two in step if either changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
GREEN = (28, 107, 78)
BLUE = (29, 95, 148)
PAPER = (242, 247, 245)
GOLD = (227, 178, 60)


def draw(size, maskable=False):
    s = 4  # draw large, then shrink for smooth edges
    n = size * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    # Green-to-blue diagonal background, clipped to the icon's shape
    bg = Image.new("RGBA", (n, n))
    px = bg.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * n - 2)
            px[x, y] = tuple(round(g + (b - g) * t) for g, b in zip(GREEN, BLUE)) + (255,)
    mask = Image.new("L", (n, n), 0)
    if maskable:
        mask.paste(255, [0, 0, n, n])
        k = 0.8  # keep the drawing inside the maskable safe zone
    else:
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.22, fill=255)
        k = 1.0
    img.paste(bg, (0, 0), mask)
    d = ImageDraw.Draw(img)

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
