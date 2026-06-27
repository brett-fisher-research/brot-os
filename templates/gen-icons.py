#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""Generate maskable PWA icons (192 & 512) for an experiment.

Usage:
  uv run gen-icons.py --out DIR [--label X] [--bg "#0b0f17"] [--fg "#5b9dff"]

Writes icon-192.png and icon-512.png into DIR (typically the app's public/ folder).
Defaults produce a neutral placeholder; pass --label to stamp an initial.
"""
import argparse
import os
from PIL import Image, ImageDraw, ImageFont


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore


def make(size: int, label: str, bg: tuple, fg: tuple) -> Image.Image:
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    # Rounded inner panel keeps it looking right when iOS masks the corners.
    pad = int(size * 0.14)
    d.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=int(size * 0.18),
        outline=fg,
        width=max(2, size // 64),
    )
    ch = (label or "•")[0].upper()
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.5)
        )
    except OSError:
        font = ImageFont.load_default()
    box = d.textbbox((0, 0), ch, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), ch, font=font, fill=fg)
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--label", default="")
    ap.add_argument("--bg", default="#0b0f17")
    ap.add_argument("--fg", default="#5b9dff")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    bg, fg = hex_to_rgb(a.bg), hex_to_rgb(a.fg)
    for s in (192, 512):
        make(s, a.label, bg, fg).save(os.path.join(a.out, f"icon-{s}.png"))
    print(f"Wrote icon-192.png and icon-512.png to {a.out}")


if __name__ == "__main__":
    main()
