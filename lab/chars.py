"""Bridge between the dashboard's character JSON (palette keys + rows) and RGBA images."""
import json
from pathlib import Path
from PIL import Image

CHARS = Path(__file__).resolve().parent.parent / "dashboard-sandbox" / "assets" / "characters"


def load(name):
    return json.loads((CHARS / f"{name}.json").read_text())


def rgb(hex_):
    return tuple(int(hex_[i:i + 2], 16) for i in (1, 3, 5))


def to_images(asset):
    pal = {k: rgb(v) + (255,) for k, v in asset["palette"].items()}
    out = []
    for rows in asset["frames"]:
        w = max(len(r) for r in rows)
        im = Image.new("RGBA", (w, len(rows)), (0, 0, 0, 0))
        px = im.load()
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in pal:
                    px[x, y] = pal[ch]
        out.append(im)
    return out


def to_rows(im, palette):
    """RGBA image -> rows of keys. Fails on any colour that is not in the palette."""
    inv = {}
    for k, v in palette.items():
        inv.setdefault(rgb(v), k)
    px = im.convert("RGBA").load()
    rows = []
    for y in range(im.height):
        row = []
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                row.append(".")
            elif a == 255 and (r, g, b) in inv:
                row.append(inv[(r, g, b)])
            else:
                raise ValueError(f"pixel ({x},{y}) = {(r, g, b, a)} is not a palette colour")
        rows.append("".join(row))
    return rows


def save(name, palette, fps, images):
    body = {"name": name, "fps": fps, "palette": palette, "frames": [to_rows(im, palette) for im in images]}
    (CHARS / f"{name}.json").write_text(json.dumps(body, indent=1) + "\n")
