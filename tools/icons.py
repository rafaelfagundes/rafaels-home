"""Regenerate the app icons with FFmpeg (librsvg) and Pillow."""

from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory

from PIL import Image

PUBLIC = Path(__file__).resolve().parents[1] / "public"
DEEP_TEAL = "#0F3D3E"
WHITE = "#FFFFFF"
ORANGE = "#C6601F"


def svg(*, full_bleed=False):
    radius = 0 if full_bleed else 42
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="{radius}" fill="{DEEP_TEAL}"/>
  <path d="M42 89l54-46 54 46m-96-9v65h84V80" fill="none" stroke="{WHITE}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M78 145v-35q0-5 5-5h26q5 0 5 5v35Z" fill="{WHITE}"/>
  <rect x="85" y="113" width="22" height="24" rx="2" fill="{ORANGE}"/>
</svg>
'''


def rasterize(source, output, size):
    run([
        "ffmpeg", "-loglevel", "error", "-y",
        "-width", str(size), "-height", str(size), "-i", str(source),
        "-frames:v", "1", "-threads", "1", str(output),
    ], check=True)


def main():
    for name in ("favicon.svg", "house.svg"):
        (PUBLIC / name).write_text(svg(), encoding="utf-8")

    with TemporaryDirectory() as directory:
        temp = Path(directory)
        opaque = temp / "full-bleed.svg"
        opaque.write_text(svg(full_bleed=True), encoding="utf-8")
        for name, size in (("icon-192.png", 192), ("icon-512.png", 512)):
            rasterize(PUBLIC / "favicon.svg", PUBLIC / name, size)
        for name, size in (("apple-touch-icon.png", 180), ("icon-512-maskable.png", 512)):
            output = PUBLIC / name
            rasterize(opaque, output, size)
            with Image.open(output) as image:
                rgb = image.convert("RGB")
            rgb.save(output)

        # Pillow writes the three ICO directory entries from this master.
        with Image.open(PUBLIC / "icon-192.png") as icon:
            icon.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    main()
