"""Sandbox experiment: give the couple more life.

Raw material: <name>-sways.json (hem sway -1 / 0 / +1, from scripts/art/couple-sways.mjs).
1. Lay the sway frames on a timeline (calm, with a few breeze gusts).
2. Bake sprite-gen's deterministic Breathe over that timeline (integer pixel moves only,
   everything above the rigid line stays bit-identical).
3. Write <name>-alive.json back in the dashboard's own character format.

Run with sprite-gen's venv:  ../sprite-gen/.venv/bin/python alive.py
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import chars
from sprite_gen.effects.breathe import bake_breathe_sequence, resolve_anatomy

FPS = 6
SECONDS = 20                  # divides the 60 s wallpaper loop
N = FPS * SECONDS
RIGID_ROW = 17                # content-box row just under the face: head and face never change
HEADROOM = 3                  # empty rows added above, so the inhale has room and never clips
OUT = Path(__file__).parent / "out"

# (frame the gust starts on, sway values it plays)
GUSTS = {
    "vien": [(14, [1, 1, 1, 0]), (55, [1, 1, 0, -1, -1, 0]), (97, [1, 1, 1, 1, 0])],
    "wife": [(20, [1, 1, 1, 1, 0]), (61, [1, 1, 0, -1, -1, 0]), (88, [-1, -1, 0]), (104, [1, 1, 1, 0])],
}
BREATHE = {
    "vien": {"depth": 0.04, "depth_x": 0.03, "breaths": 5, "lag": 0.10, "rigid_row": RIGID_ROW},
    "wife": {"depth": 0.04, "depth_x": 0.03, "breaths": 6, "lag": 0.10, "rigid_row": RIGID_ROW},
}
PLACES = ["palestine", "hajj", "turkey", "saudi", "atlanta"]


def timeline(who):
    sway = [0] * N
    for start, values in GUSTS[who]:
        for i, v in enumerate(values):
            sway[(start + i) % N] = v
    return sway


def build(who, place):
    src = chars.load(f"{who}-{place}-sways")
    stills = {}
    for s, im in zip((-1, 0, 1), chars.to_images(src)):
        padded = Image.new("RGBA", (im.width, im.height + HEADROOM), (0, 0, 0, 0))
        padded.paste(im, (0, HEADROOM))
        stills[s] = padded
    sway = timeline(who)
    cfg = BREATHE[who]
    frames, _ = bake_breathe_sequence([stills[s] for s in sway], cfg)
    name = f"{who}-{place}-alive"
    chars.save(name, src["palette"], FPS, frames)
    anat = resolve_anatomy(stills[sway[0]], cfg)
    distinct = len({f.tobytes() for f in frames})
    tops = [f.getbbox()[1] for f in frames]
    head = {f.crop((0, t, f.width, t + 13)).tobytes() for f, t in zip(frames, tops)}
    print(f"{name:24} {N} frames, {distinct} distinct, head rides {min(tops)}..{max(tops)} "
          f"(rest {HEADROOM + 1}), head pixels unchanged: {len(head) == 1}, clipped: {min(tops) == 0}")
    return frames


def preview(place, him, her, scale=8):
    """Old (left) and new (right) side by side, as a GIF and a contact sheet."""
    old_him = chars.to_images(chars.load(f"vien-{place}"))
    old_her = chars.to_images(chars.load(f"wife-{place}"))
    w, h = 26 * 2 + 4, 58
    gif = []
    for i in range(N):
        t = i / FPS
        im = Image.new("RGBA", (w * 2 + 6, h), (58, 52, 70, 255))
        o = int(t * 1.2)
        im.alpha_composite(old_him[o % 4], (0, h - 54))
        im.alpha_composite(old_her[o % 4], (30, h - 51))
        im.alpha_composite(him[i], (w + 6, h - him[i].height))
        im.alpha_composite(her[i], (w + 36, h - her[i].height))
        gif.append(im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert("P", palette=Image.ADAPTIVE))
    gif[0].save(OUT / f"{place}-old-vs-new.gif", save_all=True, append_images=gif[1:], duration=1000 // FPS, loop=0)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for place in PLACES:
        him, her = build("vien", place), build("wife", place)
        preview(place, him, her)
