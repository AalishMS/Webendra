from PIL import Image
from rembg import remove
import numpy as np

# Load original image
original_path = r"C:\Users\Aalish\.gemini\antigravity\brain\9c5a8a76-1e54-4761-97e9-3f895ca136d2\lokendra_1789710558755.jpg"
out_path = r"e:\pet_project\Webendra\assets\lokendra.png"

original = Image.open(original_path).convert("RGBA")

# Use rembg just to get the mask, to prevent it from altering colors
# `remove` has an `only_mask=True` parameter!
mask = remove(original, only_mask=True).convert("L")

# Now apply this mask to the original image's alpha channel
# to keep the original RGB channels completely untouched
original.putalpha(mask)

original.save(out_path, "PNG")
print(f"Saved transparent PNG to {out_path}")

