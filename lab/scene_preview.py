"""True-speed preview: old couple (left clip) vs alive couple (right clip) on a frozen Maghrib
background. The background does not animate here; only the couple do. Positions follow
config/scenes/madinah-maghrib.json on the 192x120 pixel grid (one art pixel = 10x9 screen px)."""
import subprocess, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import chars

OUT = Path(__file__).parent / "out"
PX, PY, COLS, ROWS = 10, 9, 192, 120
FPS, SECONDS = 12, 20
bg = Image.open(OUT / "maghrib-empty.png").convert("RGBA")
SPOTS = [("vien-saudi", 0.462), ("wife-saudi", 0.542)]


def place(canvas, im, x):
    big = im.resize((im.width * PX, im.height * PY), Image.NEAREST)
    x0 = round(x * COLS) - im.width // 2
    y0 = round(0.985 * ROWS) - im.height
    canvas.alpha_composite(big, (x0 * PX, y0 * PY))


def render(suffix, name):
    assets = [(chars.load(n + suffix), x) for n, x in SPOTS]
    frames = [(chars.to_images(a), a["fps"], x) for a, x in assets]
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(OUT / name)],
                          stdin=subprocess.PIPE)
    for i in range(FPS * SECONDS):
        t = i / FPS
        c = bg.copy()
        for ims, fps, x in frames:
            place(c, ims[int(t * fps) % len(ims)], x)
        ff.stdin.write(c.convert("RGB").tobytes())
    ff.stdin.close(); ff.wait()
    return c


render("", "maghrib-couple-old.mp4")
last = render("-alive", "maghrib-couple-alive.mp4")
last.save(OUT / "maghrib-alive-check.png")
