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
from sprite_gen.effects import breathe as _breathe
from sprite_gen.effects.breathe import bake_breathe_sequence, resolve_anatomy

# Breathe ends each warped frame with an outline normaliser that thins dark silhouette edges to
# 1 px. This art has no outlines, so that pass ate a column off the hair, the agal and the black
# abaya (and only on warped frames, so they flickered). Switched off here; sprite-gen is untouched.
_breathe._thin_outline_1px = lambda out: None

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
    "vien": {"depth": 0.04, "depth_x": 0.03, "breaths": 5, "lag": 0.0, "rigid_row": RIGID_ROW},
    "wife": {"depth": 0.04, "depth_x": 0.03, "breaths": 6, "lag": 0.0, "rigid_row": RIGID_ROW},
}
# Tap-to-wave, as indexes into <name>-wave.json: 0 = arm rising, 1 / 2 / 3 = hand left / centre / right
WAVE = [0, 0, 2, 1, 1, 2, 3, 3, 2, 1, 1, 2, 3, 3, 2, 0, 0]
PLACES = ["palestine", "hajj", "turkey", "saudi", "atlanta"]


def timeline(who):
    sway = [0] * N
    for start, values in GUSTS[who]:
        for i, v in enumerate(values):
            sway[(start + i) % N] = v
    return sway


def pad(im):
    padded = Image.new("RGBA", (im.width, im.height + HEADROOM), (0, 0, 0, 0))
    padded.paste(im, (0, HEADROOM))
    return padded


def build(who, place):
    src = chars.load(f"{who}-{place}-sways")
    stills = {s: pad(im) for s, im in zip((-1, 0, 1), chars.to_images(src))}
    poses = [pad(im) for im in chars.to_images(chars.load(f"{who}-{place}-wave"))]
    sway = timeline(who)
    cfg = BREATHE[who]
    frames, _ = bake_breathe_sequence([stills[s] for s in sway], cfg)
    name = f"{who}-{place}-alive"
    # The wave holds the body at rest. With lag 0 the Breathe phase of idle frame 0 is exactly rest,
    # and the dashboard restarts the idle loop there when the wave ends, so there is no jump back.
    assert frames[0].tobytes() == stills[0].tobytes(), f"{name}: idle frame 0 is not the rest pose"
    anat = resolve_anatomy(stills[sway[0]], cfg)
    chars.save(name, src["palette"], FPS, frames, actions={"wave": [poses[i] for i in WAVE]})
    distinct = len({f.tobytes() for f in frames})
    tops = [f.getbbox()[1] for f in frames]
    rest = stills[0]
    original = rest.crop((0, rest.getbbox()[1], rest.width, rest.getbbox()[1] + 13)).tobytes()
    same = all(f.crop((0, t, f.width, t + 13)).tobytes() == original for f, t in zip(frames, tops))
    print(f"{name:24} {N} frames, {distinct} distinct, head rides {min(tops)}..{max(tops)} "
          f"(rest {HEADROOM + 1}), head identical to the original art in every frame: {same}")
    assert same, f"{name}: the head changed"
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
