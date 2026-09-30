"""Losslessly recompress character PNGs without changing decoded image data."""

import argparse
import re
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def chunks(data):
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("Not a PNG")
    offset = len(PNG_SIGNATURE)
    while offset < len(data):
        start = offset
        length = struct.unpack_from(">I", data, offset)[0]
        offset += 4
        kind = data[offset : offset + 4]
        offset += 4 + length + 4
        if offset > len(data):
            raise ValueError("Truncated PNG chunk")
        yield kind, data[start:offset], data[start + 8 : offset - 4]
        if kind == b"IEND":
            if offset != len(data):
                raise ValueError("Unexpected data after IEND")
            return
    raise ValueError("Missing IEND")


def idat_chunk(payload):
    return (
        struct.pack(">I", len(payload))
        + b"IDAT"
        + payload
        + struct.pack(">I", zlib.crc32(b"IDAT" + payload))
    )


def optimize(path, apply):
    original = path.read_bytes()
    parts = list(chunks(original))
    ids = [index for index, (kind, _, _) in enumerate(parts) if kind == b"IDAT"]
    if not ids or ids != list(range(ids[0], ids[-1] + 1)):
        raise ValueError(f"Nonconsecutive or missing IDAT chunks: {path}")
    compressed = b"".join(parts[index][2] for index in ids)
    scanlines = zlib.decompress(compressed)
    candidates = []
    for strategy in (zlib.Z_DEFAULT_STRATEGY, zlib.Z_FILTERED, zlib.Z_RLE):
        compressor = zlib.compressobj(9, zlib.DEFLATED, 15, 9, strategy)
        candidate = compressor.compress(scanlines) + compressor.flush()
        candidates.append(candidate)
    best = min(candidates, key=len)
    if len(best) >= len(compressed):
        return len(original), len(original)
    if zlib.decompress(best) != scanlines:
        raise ValueError(f"Scanline verification failed: {path}")
    updated = (
        PNG_SIGNATURE
        + b"".join(raw for _, raw, _ in parts[: ids[0]])
        + idat_chunk(best)
        + b"".join(raw for _, raw, _ in parts[ids[-1] + 1 :])
    )
    if len(updated) >= len(original):
        return len(original), len(original)
    if apply:
        path.write_bytes(updated)
    return len(original), len(updated)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write smaller PNGs")
    args = parser.parse_args()
    catalogue = (ROOT / "catalogue.js").read_text(encoding="utf-8")
    paths = sorted(set(re.findall(r'"(/assets/[a-z0-9-]+\.png)', catalogue)))
    before = after = 0
    for image in paths:
        path = ROOT / image.lstrip("/")
        old, new = optimize(path, args.apply)
        before += old
        after += new
        if new < old:
            print(f"{path.name}: {old:,} -> {new:,} bytes ({(old - new) / old:.1%} smaller)")
    print(f"Total: {before:,} -> {after:,} bytes ({(before - after) / before:.1%} smaller)")
    if not args.apply:
        print("Dry run; pass --apply to write the optimized files.")


if __name__ == "__main__":
    main()
