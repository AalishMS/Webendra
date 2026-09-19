from PIL import Image
from rembg import remove
import numpy as np

# Load original image
original_path = r"C:\Users\Aalish\.gemini\antigravity-cli\brain\8626ab7e-e113-4de1-a0ba-cdb7cdd1d994\topendra_cannon_1789811457458.jpg"
out_path = r"e:\pet_project\Webendra\assets\topendra.png"

original = Image.open(original_path).convert("RGBA")

# Use rembg just to get the mask, to prevent it from altering colors
# `remove` has an `only_mask=True` parameter!
mask = remove(original, only_mask=True).convert("L")

# Now apply this mask to the original image's alpha channel
# to keep the original RGB channels completely untouched
original.putalpha(mask)

original.save(out_path, "PNG")
print(f"Saved transparent PNG to {out_path}")

