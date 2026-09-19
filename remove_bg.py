"""Apply a background-removal mask without changing the source RGB pixels."""

import argparse
from pathlib import Path

from PIL import Image
from rembg import remove


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Input image")
    parser.add_argument("output", type=Path, help="Transparent PNG to write")
    args = parser.parse_args()

    if args.output.suffix.lower() != ".png":
        parser.error("output must be a PNG file")
    with Image.open(args.source) as source:
        original = source.convert("RGBA")
    if original.width != original.height:
        parser.error("source image must be square")

    mask = remove(original, only_mask=True).convert("L")
    if mask.size != original.size:
        raise ValueError("background mask dimensions do not match source")
    original.putalpha(mask)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    original.save(args.output, "PNG")
    print(f"Saved {args.output}")


if __name__ == "__main__":
    main()
