# Light Mode Dust Motes: Architectural Specification

Prepared against the repository on September 18, 2026.

## 1. Goal and Visual Metaphor

Webendra's atmospheric backdrop features two complementary environmental states sharing a single stable particle system:
1. **Dark Mode**: Luminous celestial stars on deep cosmic void (`#080a0f`).
2. **Light Mode**: Warm, sunlit floating dust motes drifting across pure gallery white (`#ffffff`).

The light mode experience evokes the sensation of afternoon sunlight streaming across a quiet, distinguished art gallery. Dust particles tumbling gently through thermal air currents catch the light with soft bokeh halos, warm amber/champagne tones, and subtle optical shimmers.

## 2. Core Constraints & Boundaries

- **Zero Layout Intrusion**: In accordance with `AGENTS.md`, the page remains stark white (`#ffffff`), the text black (`#000000`), with no added cards, headers, borders, or container furniture.
- **Unified Particle Population**: Light mode dust and dark mode stars are the exact same 120 particle records. No records are destroyed, reseeded, or repositioned on theme toggle.
- **Smooth 450ms Morph**: Toggling themes interpolates colors, alpha, and optical layers over 450ms using smootherstep easing.
- **Quiet-Zone Protection**: The subject portrait (`.image-frame`) and character title (`#character-name`) are protected by an adaptive quiet zone that gracefully dims particles near the character without erasing them.
- **Accessibility & Reduced Motion**: Under `prefers-reduced-motion: reduce`, all ambient drift, cursor displacement, and shimmering cease immediately, rendering a clean, static, single-frame dust composition.

## 3. Optical Layer Architecture

Light mode features a 4-layer optical pipeline symmetrical to dark mode's starfield:

| Layer | Condition | Geometry | Opacity / Color | Optical Purpose |
| --- | --- | --- | --- | --- |
| **1. Ambient Bokeh Aura** | `(1 - mix) > 0.01` & `depth > 0.45` | Radius × 3.4 | `alpha * 0.18 * (1 - mix)` | Soft out-of-focus circle of confusion; eliminates hard pixel edges on white |
| **2. Diffuse Dust Halo** | `(1 - mix) > 0.01` & `depth > 0.25` | Radius × 2.0 | `alpha * 0.32 * (1 - mix)` | Intermediate softening transition |
| **3. Core Dust Disc** | Always (when alpha > 0.005) | Radius × 1.0 | `alpha` with interpolated RGB | Primary physical particle body |
| **4. Sunlit Specular Glint** | `(1 - mix) > 0.50` & `depth > 0.70` | Radius × 0.5 | White `255, 255, 255` at `alpha * 0.60 * (1 - mix)` | Concentrated specular reflection where direct sunlight strikes the mote facet |

## 4. Chromatic Sunlit Palette Mapping

Each star palette entry maps 1-to-1 to a sunlit atmospheric dust hue:

| Index | Celestial Star (Dark Mode) | Sunlit Dust Mote (Light Mode) | Tone Character |
| --- | --- | --- | --- |
| 1 | Electric Cyan `[56, 189, 248]` | Atmospheric Sky-Slate `[90, 130, 165]` | Airy cool dust |
| 2 | Neon Sky Blue `[96, 165, 250]` | Mineral Blue-Grey `[100, 125, 165]` | Ethereal slate |
| 3 | Bright Aquamarine `[34, 211, 238]` | Sea-Mist Mineral `[75, 140, 150]` | Cool ocean mineral |
| 4 | Ethereal Lavender `[192, 132, 252]` | Twilight Mauve `[145, 115, 165]` | Soft dusk mote |
| 5 | Deep Cosmic Purple `[168, 85, 247]` | Bronze-Mauve `[140, 100, 145]` | Subdued warm purple |
| 6 | Nebula Rose `[244, 114, 182]` | Terracotta Rose `[180, 110, 115]` | Warm sunlit clay |
| 7 | Radiant Magenta `[251, 113, 133]` | Sunlit Terracotta `[185, 105, 105]` | Desert earth mote |
| 8 | Solar Gold `[251, 191, 36]` | Sunbeam Amber `[190, 135, 45]` | Classic sunlit gold |
| 9 | Warm Tangerine `[251, 146, 60]` | Champagne Ochre `[185, 120, 50]` | Warm afternoon light |
| 10 | Aurora Emerald `[52, 211, 153]` | Sunlit Sage Pollen `[95, 145, 110]` | Organic botanical mote |
| 11 | Diamond Ice `[224, 242, 254]` | Silvery Pearl `[130, 140, 150]` | Fine mineral dust |
| 12 | Supernova White `[255, 255, 255]` | Warm Mineral Ivory `[155, 145, 135]` | Soft bright calcite |

## 5. Dynamics and Shimmer

- **Thermal Drift**: Ambient drift equations are shared across themes to guarantee continuous position integrity.
- **Tumbling Shimmer**: While stars twinkle, dust motes tumble in thermal currents. The shimmer equation rotates particle opacity sinusoidally:
  `shimmer = 1 + 0.30 * sin(activeTime * speed * 0.85 + phase) * (1 - mix)`
- **Adaptive Quiet Zone**:
  - Desktop: 24px padding, 100px fade radius.
  - Mobile: Dynamic scaling (`Math.min(24, Math.max(10, cssW * 0.02))` and `Math.min(100, Math.max(40, cssW * 0.08))`).
  - Floor: `quietFloor = 0.25 + (0.15 - 0.25) * mix`, ensuring particles remain softly present across mobile margins.

