"""Build the static social preview cards from the catalogue's existing PNGs."""

import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "share"
CHECK = "--check" in sys.argv
CHARACTERS = json.load(sys.stdin)

logo = Image.open(ROOT / "assets" / "webendra-share.png").convert("RGB")
ink = Image.eval(logo.convert("L"), lambda value: 255 if value < 180 else 0)
bounds = ink.getbbox()
if not bounds:
    raise RuntimeError("The Webendra mark is empty")
mark = logo.crop(bounds)
mark.thumbnail((225, 90), Image.Resampling.LANCZOS)

font_path = "C:/Windows/Fonts/arialbd.ttf" if sys.platform == "win32" else "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
if not Path(font_path).exists():
    raise RuntimeError(f"Missing share card font: {font_path}")

if not CHECK:
    OUTPUT.mkdir(parents=True, exist_ok=True)

expected = set()
for character in CHARACTERS:
    name = character["name"]
    display_name = character.get("displayName", name)
    image = Image.open(ROOT / character["image"].lstrip("/")).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"Empty character image: {name}")
    image = image.crop(bounds)
    image.thumbnail((610, 550), Image.Resampling.LANCZOS)

    card = Image.new("RGB", (1200, 630), "white")
    card.paste(image, (max(20, (650 - image.width) // 2), (630 - image.height) // 2), image)
    draw = ImageDraw.Draw(card)
    words = display_name.split()
    lines = words if len(words) > 1 else [display_name]
    font_size = 100
    while font_size > 46:
        font = ImageFont.truetype(font_path, font_size)
        if all(draw.textbbox((0, 0), line, font=font)[2] <= 475 for line in lines):
            break
        font_size -= 2
    line_height = font_size + 12
    start_y = 265 - (len(lines) * line_height) // 2
    for offset, line in enumerate(lines):
        draw.text((682, start_y + offset * line_height), line, fill="black", font=font)
    card.paste(mark, (945, 506))

    output = OUTPUT / f"{name.lower()}.png"
    expected.add(output)
    buffer = io.BytesIO()
    card.save(buffer, format="PNG", optimize=True)
    data = buffer.getvalue()
    if CHECK:
        if not output.exists() or output.read_bytes() != data:
            raise RuntimeError(f"Share card is out of date: {output.name}")
    elif not output.exists() or output.read_bytes() != data:
        output.write_bytes(data)

if OUTPUT.exists():
    for output in OUTPUT.glob("*.png"):
        if output not in expected:
            if CHECK:
                raise RuntimeError(f"Stale share card: {output.name}")
            output.unlink()
