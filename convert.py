import sys
from PIL import Image, ImageDraw

def add_golden_frame(image_path, output_path, border_width=20):
    try:
        # Open the image
        img = Image.open(image_path).convert("RGBA")
        
        # Create a white background image of the same size
        bg = Image.new("RGBA", img.size, "WHITE")
        
        # Paste the original image onto the white background using its alpha channel as mask
        bg.paste(img, (0, 0), img)
        
        # Draw a golden frame
        draw = ImageDraw.Draw(bg)
        width, height = bg.size
        
        # Golden colors
        outer_gold = (218, 165, 32, 255) # Goldenrod
        inner_gold = (255, 215, 0, 255) # Gold
        highlight = (255, 236, 139, 255) # LightGoldenrod
        shadow = (184, 134, 11, 255) # DarkGoldenrod
        
        # Draw the frame borders
        for i in range(border_width):
            # Calculate coordinates
            x0 = i
            y0 = i
            x1 = width - 1 - i
            y1 = height - 1 - i
            
            color = outer_gold
            if i > border_width * 0.7:
                color = inner_gold
            
            draw.rectangle([x0, y0, x1, y1], outline=color)
            
            # Simple bevel effect (optional)
            if i < border_width * 0.3:
                draw.line([(x0, y0), (x1, y0)], fill=highlight) # top
                draw.line([(x0, y0), (x0, y1)], fill=highlight) # left
                draw.line([(x1, y0), (x1, y1)], fill=shadow) # right
                draw.line([(x0, y1), (x1, y1)], fill=shadow) # bottom
                
        # Save the result
        bg.save(output_path, format="PNG")
        print(f"Successfully processed and saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    add_golden_frame("assets/peakendra-v2.png", "assets/peakendra-v2.png", border_width=24)

