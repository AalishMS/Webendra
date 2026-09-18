# Dust and stars: implementation handoff

Status: approved design direction; implementation has not started.
Prepared against the repository on September 16, 2026.

## 1. Goal and boundaries

Add a light/dark toggle to Webendra. Light mode has pale floating dust on pure
white; dark mode has luminous stars on near-black. Both are the same particles:
switching themes changes their appearance without recreating or repositioning
them. Mouse movement produces gentle depth and local displacement in both modes.

The user explicitly approved this direction. This authorizes the dark background,
particle backdrop, and theme toggle despite the white-page default in AGENTS.md.
Keep the other project rules: the existing centered image, name, arrows, typography,
and gallery behavior remain the focus. Add no header, explanatory copy, card,
colored sky, constellation lines, shooting stars, or new characters.

The inspiration is the mouse-responsive star background described by the user at
<https://openai.com/index/gpt-6-astra/>. Its exact animation was not verified.
Implement the specification here; reproducing that site's code is unnecessary.

The remaining details below are implementation defaults chosen for this handoff.
Do not reopen design discussion unless there is a concrete blocker.

## 2. Repository facts and file map

This is a static HTML/CSS/JavaScript site without a package manifest or build step.

| File | Work |
| --- | --- |
| `index.html` | Early theme initialization, decorative canvas, toggle, new script |
| `styles.css` | Theme variables, transparent image frame, layers, toggle styles |
| `theme.js` (new) | Theme state, persistence, particle renderer and lifecycle |
| `app.js` | Leave gallery and KFC logic intact; no rewrite expected |
| `README.md` | Briefly document theme behavior and local verification |
| `test-output/` | Local screenshots/evidence; already ignored by Git |

Read current files and `git status` before editing; preserve unrelated changes.
Use plain JavaScript and a single Canvas 2D element. No new runtime dependency,
framework, WebGL renderer, image asset, or build system is needed.

Important existing details:

- `.character` uses `display: contents`; measure `.image-frame` and
  `#character-name`, not the figure, for the particle quiet zone.
- `.image-frame` currently has `background: #fff`; remove that opaque fill.
- `app.js` animates image-frame height during character changes. Preserve this.
- `app.js` already declares `reduceMotion` at top level. Put all of `theme.js`
  inside an IIFE to avoid shared classic-script lexical-name collisions.
- KFC sparks, draggable chickens, and controls occupy z-indices 9997–9999.
  Preserve their behavior and ordering.
- Character routes and metadata are controlled by `app.js` and `vercel.json`.
  Theme changes must not change paths, history, titles, or structured data.

## 3. Visual and interaction specification

### Theme palette

Use CSS variables instead of scattering new literal colors among selectors.

| Variable | Light | Dark |
| --- | --- | --- |
| `--page-bg` | `#ffffff` | `#080a0f` |
| `--page-fg` | `#000000` | `#f4f4f5` |
| `--control-hover` | `#f2f2f2` | `#20232b` |
| `--control-outline` | `#000000` | `#f4f4f5` |
| `--control-border` | `#000000` | `#858b98` |

Keep existing KFC red and white label. Theme its border/focus treatment so it is
visible on dark. Theme the clear button's background, foreground, border, hover,
and focus. Update spawned-chicken focus outlines too. Preserve disabled styling.
Do not invert, recolor, dim, or filter character PNGs.

Set root and body backgrounds to `var(--page-bg)` and text to `var(--page-fg)`.
The image frame must be transparent. Arrow strokes already use `currentColor`;
replace their hard-coded black color and focus outline with variables.

### Toggle

- One native `button`, `id="theme-toggle"`, `type="button"`.
- Fixed top-right, 16px inset or safe-area inset, whichever is larger.
- 44 by 44 CSS pixels minimum; 20px inline SVG sun/moon icon.
- Accessible name stays `Dark mode`; `aria-pressed` is true when dark is selected.
  Icon shows a moon in light mode and a sun in dark mode; SVGs are aria-hidden.
- Add a visible focus ring. Enter and Space work through native button behavior.
- No live announcement or custom keyboard shortcut is needed.
- Theme toggle stays above spawned KFC elements, at z-index 10000.
- Initially hidden using the HTML `hidden` attribute. Reveal after its listener
  is attached; ensure CSS respects `[hidden]` so an inert control never appears.

### Particle appearance

Generate one stable population of 120 records once. Display the first N records,
where N is `clamp(round(width * height / 14000), 28, 120)` in CSS pixels. N depends
only on viewport area, never theme. Resizing may change the visible prefix but
must not recreate records. Normalized anchors preserve relative positions.

Each record stores `u`, `v` in [0,1], depth in [0.2,1], base radius in [0.5,1.3]
CSS pixels, brightness in [0.65,1], two phase angles, and current local offsets.
Randomness is sampled only during initial creation, never during a draw or toggle.

- Light: RGB (105,113,125), alpha `0.10 + 0.12 * depth`, times brightness.
- Dark: RGB (235,240,255), alpha `0.30 + 0.45 * depth`, times brightness.
- Keep the same dot radius and geometry across themes. Dark feels luminous
  primarily because of contrast. For depth > 0.8, optionally draw one extra
  concentric circle at 2.5 times radius and 12% of the dot alpha, multiplied by
  dark-theme progress. No full-screen gradient or costly per-dot shadow blur.
- Start with no twinkling. Motion plus the theme transition is sufficient.
- Reduce particle opacity near the gallery using the quiet-zone algorithm below.

### Motion

Motion is deliberately gentle and independent of theme:

- Ambient displacement around the anchor: X = `sin(t * 0.12 + phaseX) * 5 * depth`;
  Y = `sin(t * 0.10 + phaseY) * 7 * depth`. t is accumulated active seconds.
- Normalize cursor around viewport center to [-1,1] on each axis. Smooth toward
  the target using `a = 1 - exp(-dt / 0.18)`. Parallax is smoothed cursor times
  `10 * depth` pixels, in the direction opposite the cursor.
- Local repulsion radius: 120px. Measure from the position after ambient and
  parallax offsets, before local repulsion, to avoid feedback oscillation.
- Inside radius, target repulsion magnitude is
  `14 * depth * (1 - distance / 120)^2`, directed away from cursor.
  Smooth current offsets to that target with `1 - exp(-dt / 0.22)`.
  Outside radius, target offsets are zero. Guard distance near zero with a
  deterministic direction derived from the particle phase.
- Pointer exit/window blur resets target parallax and local repulsion to zero.
- Ignore touch pointer events and disable cursor response unless
  `(hover: hover) and (pointer: fine)` matches. Touch gets ambient drift only.
- Listen passively; never prevent default or capture pointers for the background.
  Gallery controls and KFC dragging retain all input behavior.
- Clamp dt to 0.033 seconds and reset the timing baseline after resuming.

## 4. Theme state and transition

### Startup and persistence

Storage key: `webendra-theme`. Valid values: `light` and `dark` only.
Use a valid saved value first; otherwise use `prefers-color-scheme`.
Wrap localStorage reads and writes in try/catch. Invalid values mean no explicit
preference. An explicit selection remains authoritative even if its storage write
fails during the current visit.

In a small synchronous script in `<head>`, before the stylesheet link, resolve
the initial theme and set `document.documentElement.dataset.theme`. Set the
root's `style.colorScheme` to match. Update the existing theme-color meta tag
(it is already above the stylesheet) to the corresponding page background.
This initialization prevents a white flash for saved dark mode.

Default CSS without the data attribute stays light. JavaScript-disabled visitors
still get a readable static gallery. Do not add a CSS system-theme override that
can conflict with a user's saved preference.

In `theme.js`, read the initialized dataset rather than temporarily resetting it.
Initialize particles directly in that theme, with no startup color animation.
Listen for system-theme changes only while no explicit preference is active.
Cross-tab storage synchronization is optional and outside the required scope.

### Switching without particle jumps

Use `mix` in [0,1] for current appearance (0 light, 1 dark). The theme selection
updates dataset, colorScheme, button pressed state/icon, and meta theme-color
immediately. Persist only explicit user toggles, not automatic system changes.

Interpolate canvas RGB and opacity using `mix`. On each switch:

1. Keep all particle records, anchors, phases, offsets, and active time untouched.
2. Capture current `mix` as `fromMix`; set `toMix` to 0 or 1.
3. Capture transition start time, duration 450ms.
4. Each frame use `p = clamp((now - start) / 450, 0, 1)` and
   `mix = fromMix + (toMix - fromMix) * (p * p * (3 - 2 * p))`.
5. If toggled again, start from the current interpolated mix. Do not queue
   transitions or create another animation loop.

Use 450ms CSS color/background-color transitions with `ease-in-out` for page
and controls. Enable transitions only after initialization, through a class
added after the initial render. Retain existing transform hover transitions.
CSS and canvas easing may differ slightly; their durations must agree.

Reduced motion: apply both CSS colors and canvas mix instantly, freeze ambient
time, remove cursor offsets, draw once, and stop animation scheduling. Theme and
resize changes still trigger a single draw. If reduced motion is turned off at
runtime, resume exactly one animation loop from preserved particle anchors.

## 5. Canvas architecture and lifecycle

Place `<canvas id="ambient-particles" aria-hidden="true"></canvas>` as the first
body child. It is decorative, not focusable, fixed with inset 0 and
`pointer-events: none`. Give body `isolation: isolate`, canvas z-index 0, and
`.showcase` `position: relative; z-index: 1`. Keep the showcase transparent.
Do not use negative z-index, which can put the canvas behind the page background.

Add `/theme.js` as a classic script at the end of body after `/app.js`. Encapsulate
everything in an IIFE. Suggested internal function responsibilities:

| Function | Responsibility |
| --- | --- |
| `applyTheme(next, persist)` | Theme semantics, storage, transition target |
| `createParticles()` | Create records once |
| `resizeCanvas()` | CSS dimensions, backing resolution, visible count |
| `measureQuietZone()` | Cache bounds of image and name |
| `drawFrame(dt, now)` | Update offsets/appearance and paint |
| `startLoop()` | Schedule only if no frame is already scheduled |
| `stopLoop()` | Cancel frame and reset its ID |
| `renderStatic()` | Single frame for reduced-motion state |

Attach theme controls independently of canvas initialization. If `getContext('2d')`
fails, solid-color theme switching and gallery navigation must still work.

Use viewport width/height in CSS pixels. Backing canvas dimensions are rounded
CSS dimensions times `min(devicePixelRatio || 1, 2)`. After each resize, call
`ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`; do not accumulate `scale()` calls.
Clear in CSS coordinates after setting the transform. Avoid recreating the
backing canvas on every frame. Handle viewport and DPR changes when detected.

For quiet-zone bounds, cache the union of `.image-frame` and `#character-name`
rectangles, padded by 24px. For a dot outside that rectangle, calculate distance
to its nearest point; inside, distance is zero. Multiply alpha by
`0.15 + 0.85 * smoothstep(0, 100, distance)`. This fades dots near the character
without painting a rectangular panel or changing the PNG.

Use ResizeObserver on those two elements and resize/scroll events to mark bounds
dirty. Measure at most once per frame when dirty. Character height animation can
trigger observer callbacks; do not query layout in the particle loop. Under
reduced motion, coalesce dirty events into a one-shot draw. A fallback can listen
for image load plus mutations within the image/name containers if ResizeObserver
is unavailable. Do not continuously measure all DOM elements.

When `document.hidden`, cancel background animation entirely. On returning,
reset last timestamp, clear stale pointer targets, finish any pending color
transition at its selected target, measure bounds, and resume or render once as
appropriate. Account for pagehide/pageshow restoration too. There must be one
background requestAnimationFrame chain at most; the existing KFC loop is separate.
Keep canvas failure isolated so it cannot abort gallery setup.

## 6. Implementation sequence with checkpoints

1. Read AGENTS.md and the current source. Inspect status and available test tools.
   No new characters are involved, so do not edit Ideas.md or any asset.
2. Add palette variables and replace relevant hard-coded control colors. Make
   the image frame transparent. Manually set data-theme in devtools to verify
   both palettes before adding motion.
3. Add early startup logic, toggle markup, and theme controller in theme.js.
   Verify persistence, native keyboard activation, system preference, blocked
   storage, and rapid toggles using solid backgrounds first.
4. Add canvas layers, stable records, DPR sizing, and a static draw. Verify the
   same points remain in place when toggling and that controls remain clickable.
5. Add appearance interpolation, then ambient drift, then parallax/repulsion.
   Keep position equations theme-independent. Check each addition in isolation.
6. Add quiet-zone fading and lifecycle/reduced-motion handling. Check transition
   interruptions and resize behavior, including with the gallery changing.
7. Review every character against dark and light backgrounds. If an existing PNG
   has an opaque background or white fringe, report the asset and evidence. Do
   not conceal defects with an opaque frame or casually regenerate assets.
8. Run the acceptance checks below and save selected screenshots locally. Update
   README with a short theme behavior note. Review the final diff for scope.
9. Follow the repository's commit/push workflow when implementing; inspect the
   current branch and remote first, preserve unrelated edits, never force-push,
   and report any unavailable remote or failed push honestly.

## 7. Verification and acceptance checklist

The README's `python -m http.server 8000` works for `/` and client-side navigation.
It does NOT implement Vercel's fallback for direct `/character/...` reloads.
For deep-link reload checks use a preview server supporting the rewrites (such
as an available Vercel preview) or a temporary static server with equivalent
fallback behavior. Do not misdiagnose Python server 404s as a theme regression.
Do not deploy production merely to run these checks.

Use available browser testing tools. Add focused tests for theme state and
particle invariants if a test harness is practical; do not add a framework solely
to test pixel colors. Record manual checks clearly when automation is unavailable.

| Check | Expected result |
| --- | --- |
| Fresh visit, OS light/dark | Matching initial theme without wrong-theme flash |
| Saved theme opposite OS | Saved theme wins before first visible paint |
| Invalid/blocked storage | Usable theme toggle, no uncaught exception |
| OS changes with no saved choice | Theme follows OS |
| OS changes after user choice | User selection remains |
| Toggle by click, Enter, Space | Exactly one switch per activation, correct pressed state |
| Toggle 10 times rapidly | Final state correct; no queued fades or extra loops |
| Same viewport, theme switch | Same record identities, anchors, phases and dot count |
| Pointer movement and exit | Smooth bounded displacement, gentle return, no snapping |
| Touch viewport | Ambient drift, no touch interception or stale cursor force |
| Reduced motion at load/runtime | Static particles, instant colors, no continuous loop |
| Hidden tab then return | No hidden loop or large movement jump on return |
| Resize and rotation | Crisp canvas, stable anchors, no overflow or random reseeding |
| Canvas unavailable | Solid themes and gallery remain functional |
| Gallery buttons/arrow keys | Navigation, rapid transitions and wraparound still work |
| Browser back/forward, deep link | Correct character and URL; theme preserved |
| KFC interactions | Spawn, drag, keyboard move, clear and sparks still work |
| Keyboard focus | Visible on arrows, theme, KFC and spawned chickens in both themes |
| All character assets | No introduced boxes, color changes, missing loads or bad edges |
| Console/network | No new errors or failed theme script requests |

Inspect at 1440x900, 1024x768, 390x844, 320x568, and mobile landscape in both
themes. Include DPR 1 and 2, 200% zoom, and at least one Chromium and one other
browser if available. Check toggle overlap in short/landscape viewports.

To verify position preservation, compare particle records before and after a
toggle in the debugger, or use an isolated renderer test with fixed simulation
time and pointer inputs. Normal ambient motion means screenshots taken at
different times will not have numerically identical positions. Do not disable
normal motion just to make screenshots match. Avoid shipping debug globals.

Capture light, dark, mobile, and reduced-motion examples. Use a short performance
recording to confirm no repeated layout reads per particle and no duplicate
background loops after many toggles. Target smooth rendering on the available
device, with no animation-attributable long tasks over 50ms in a 10-second sample.
Report the tested environment; do not promise performance on untested devices.

## 8. Completion report

Report files changed, resulting theme behavior, checks actually performed, and
any unresolved asset/browser issue. Include commit/push status if applicable.
The feature is complete only when the preserved-particle transition, accessible
toggle, saved preference, reduced-motion behavior, and gallery/KFC regression
checks all work. The plan itself does not count as implementation.
