/* theme.js — Dust and stars for Webendra
 * Wrapped in an IIFE to avoid lexical collisions with app.js.
 */
(function () {
  'use strict';

  // ── Theme palette constants ──────────────────────────────────────────
  var LIGHT_BG = '#ffffff';
  var DARK_BG = '#080a0f';
  var STORAGE_KEY = 'webendra-theme';
  var TRANSITION_MS = 450;

  // ── Colorful Celestial Star & Dust Palettes ─────────────────────────
  // Curated color spectrum inspired by OpenAI Astra / cosmic starfields:
  // Electric cyan/blue, cosmic violet/purple, nebula magenta/pink,
  // warm gold/amber, emerald aurora/teal, and brilliant diamond white.
  // Each entry has [darkR, darkG, darkB] for glowing stars on dark (#080a0f),
  // and [lightR, lightG, lightB] for refined chromatic dust on white (#ffffff).
  var STAR_PALETTES = [
    // 1. Electric Cyan (brilliant starlight)
    { dark: [56, 189, 248],  light: [30, 110, 160] },
    // 2. Neon Sky Blue (radiant celestial)
    { dark: [96, 165, 250],  light: [45, 95, 175] },
    // 3. Bright Aquamarine / Teal
    { dark: [34, 211, 238],  light: [15, 125, 150] },
    // 4. Ethereal Lavender / Violet
    { dark: [192, 132, 252], light: [120, 70, 170] },
    // 5. Deep Cosmic Purple / Amethyst
    { dark: [168, 85, 247],  light: [110, 45, 165] },
    // 6. Nebula Rose / Pink
    { dark: [244, 114, 182], light: [165, 55, 115] },
    // 7. Radiant Magenta / Crimson Glow
    { dark: [251, 113, 133], light: [175, 60, 80] },
    // 8. Solar Gold / Starlight Amber
    { dark: [251, 191, 36],  light: [160, 110, 20] },
    // 9. Warm Tangerine / Solar Flare
    { dark: [251, 146, 60],  light: [170, 90, 25] },
    // 10. Aurora Emerald / Mint
    { dark: [52, 211, 153],  light: [30, 130, 90] },
    // 11. Pearlescent Diamond / Icy Tint
    { dark: [224, 242, 254], light: [80, 95, 110] },
    // 12. Supernova Brilliant White
    { dark: [255, 255, 255], light: [70, 80, 95] }
    // 1. Electric Cyan (brilliant starlight) -> soft atmospheric sky-slate dust
    { dark: [56, 189, 248],  light: [90, 130, 165] },
    // 2. Neon Sky Blue (radiant celestial) -> atmospheric mineral blue-grey
    { dark: [96, 165, 250],  light: [100, 125, 165] },
    // 3. Bright Aquamarine / Teal -> sea-mist mineral dust
    { dark: [34, 211, 238],  light: [75, 140, 150] },
    // 4. Ethereal Lavender / Violet -> warm twilight mauve dust
    { dark: [192, 132, 252], light: [145, 115, 165] },
    // 5. Deep Cosmic Purple / Amethyst -> soft bronze-mauve dust
    { dark: [168, 85, 247],  light: [140, 100, 145] },
    // 6. Nebula Rose / Pink -> warm terracotta rose dust
    { dark: [244, 114, 182], light: [180, 110, 115] },
    // 7. Radiant Magenta / Crimson Glow -> desert terracotta dust
    { dark: [251, 113, 133], light: [185, 105, 105] },
    // 8. Solar Gold / Starlight Amber -> warm sunbeam amber dust
    { dark: [251, 191, 36],  light: [190, 135, 45] },
    // 9. Warm Tangerine / Solar Flare -> warm champagne ochre dust
    { dark: [251, 146, 60],  light: [185, 120, 50] },
    // 10. Aurora Emerald / Mint -> sunlit meadow pollen / sage
    { dark: [52, 211, 153],  light: [95, 145, 110] },
    // 11. Pearlescent Diamond / Icy Tint -> silvery pearl dust
    { dark: [224, 242, 254], light: [130, 140, 150] },
    // 12. Supernova Brilliant White -> warm mineral ivory dust
    { dark: [255, 255, 255], light: [155, 145, 135] }
  ];

  // ── DOM references ───────────────────────────────────────────────────
  var root = document.documentElement;
  var canvas = document.getElementById('ambient-particles');
  var toggleBtn = document.getElementById('theme-toggle');
  var moonIcon = toggleBtn ? toggleBtn.querySelector('.theme-icon-moon') : null;
  var sunIcon = toggleBtn ? toggleBtn.querySelector('.theme-icon-sun') : null;
  var darkText = toggleBtn ? toggleBtn.querySelector('.theme-text-dark') : null;
  var lightText = toggleBtn ? toggleBtn.querySelector('.theme-text-light') : null;
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  // ── State ────────────────────────────────────────────────────────────
  var currentTheme = root.dataset.theme || 'light';
  // Was an explicit user choice made (even if storage write failed)?
  var hasExplicitChoice = false;
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    hasExplicitChoice = (saved === 'light' || saved === 'dark');
  } catch (e) { /* blocked */ }

  // mix: 0 = light, 1 = dark
  var mix = currentTheme === 'dark' ? 1 : 0;
  var fromMix = mix;
  var toMix = mix;
  var transitionStart = -1; // negative means no transition running

  // ── Reduced motion ──────────────────────────────────────────────────
  var reduceMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reducedMotion = reduceMotionMQ.matches;

  // ── Pointer capability ──────────────────────────────────────────────
  var finePointerMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  var hasFinePointer = finePointerMQ.matches;

  // ── Canvas context ──────────────────────────────────────────────────
  var ctx = null;
  try { ctx = canvas ? canvas.getContext('2d') : null; } catch (e) { /* no canvas */ }

  // ── Particle data ───────────────────────────────────────────────────
  var MAX_PARTICLES = 120;
  var particles = [];
  var visibleCount = 0;

  function createParticles() {
    particles = [];
    for (var i = 0; i < MAX_PARTICLES; i++) {
      var colorDef = STAR_PALETTES[i % STAR_PALETTES.length];
      particles.push({
        u: Math.random(),              // normalized x anchor [0,1]
        v: Math.random(),              // normalized y anchor [0,1]
        depth: 0.2 + Math.random() * 0.8,
        radius: 0.7 + Math.random() * 1.1, // base radius in CSS px (0.7 to 1.8px)
        brightness: 0.70 + Math.random() * 0.30,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.7 + Math.random() * 1.5,
        twinklePhase: Math.random() * Math.PI * 2,
        color: colorDef,
        localDx: 0,                   // current local repulsion offset
        localDy: 0
      });
    }
  }

  // ── Canvas sizing ───────────────────────────────────────────────────
  var cssW = 0, cssH = 0, dpr = 1;

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    visibleCount = Math.round(Math.max(28, Math.min(MAX_PARTICLES, cssW * cssH / 14000)));
    boundsDirty = true;
  }

  // ── Quiet-zone measurement ──────────────────────────────────────────
  var quietRect = null;
  var boundsDirty = true;

  function measureQuietZone() {
    var frame = document.querySelector('.image-frame');
    var nameEl = document.getElementById('character-name');
    if (!frame || !nameEl) { quietRect = null; return; }
    var fr = frame.getBoundingClientRect();
    var nr = nameEl.getBoundingClientRect();
    var pad = Math.min(24, Math.max(12, Math.round(cssW * 0.02)));
    quietRect = {
      left:   Math.min(fr.left, nr.left) - pad,
      top:    Math.min(fr.top, nr.top) - pad,
      right:  Math.max(fr.right, nr.right) + pad,
      bottom: Math.max(fr.bottom, nr.bottom) + pad
    };
    boundsDirty = false;
  }

  function smoothstep(edge0, edge1, x) {
    var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function distToQuietZone(px, py) {
    if (!quietRect) return 999;
    // If inside the rect, distance is 0
    if (px >= quietRect.left && px <= quietRect.right &&
        py >= quietRect.top && py <= quietRect.bottom) return 0;
    // Otherwise, nearest-point distance
    var cx = Math.max(quietRect.left, Math.min(px, quietRect.right));
    var cy = Math.max(quietRect.top, Math.min(py, quietRect.bottom));
    return Math.hypot(px - cx, py - cy);
  }

  // ── ResizeObserver for quiet zone ───────────────────────────────────
  function setupBoundsObserver() {
    var frame = document.querySelector('.image-frame');
    var nameEl = document.getElementById('character-name');
    if (typeof ResizeObserver !== 'undefined' && frame && nameEl) {
      var ro = new ResizeObserver(function () {
        boundsDirty = true;
        if (reducedMotion) queueStaticDraw();
      });
      ro.observe(frame);
      ro.observe(nameEl);
    }
  }

  // ── Motion state ────────────────────────────────────────────────────
  var activeTime = 0;
  var pointerPresent = false;
  var cursorTargetX = 0, cursorTargetY = 0;
  var cursorSmoothedX = 0, cursorSmoothedY = 0;
  var lastFrameTime = 0;
  var frameId = 0;

  // ── Pointer tracking ───────────────────────────────────────────────
  function onPointerMove(e) {
    if (!hasFinePointer) return;
    pointerPresent = true;
    // Normalize to [-1, 1] around viewport center
    cursorTargetX = (e.clientX / cssW - 0.5) * 2;
    cursorTargetY = (e.clientY / cssH - 0.5) * 2;
  }

  function clearCursor() {
    pointerPresent = false;
  }

  window.addEventListener('mousemove', onPointerMove, { passive: true });
  window.addEventListener('mouseleave', clearCursor);
  window.addEventListener('blur', clearCursor);

  finePointerMQ.addEventListener('change', function (e) {
    hasFinePointer = e.matches;
    if (!hasFinePointer) clearCursor();
  });

  // ── Drawing ─────────────────────────────────────────────────────────
  function drawFrame(dt) {
    if (!ctx) return;

    // Clamp dt
    if (dt > 0.033) dt = 0.033;

    // Update mix transition
    if (transitionStart >= 0) {
      var elapsed = performance.now() - transitionStart;
      var p = Math.max(0, Math.min(1, elapsed / TRANSITION_MS));
      // smootherstep easing
      mix = fromMix + (toMix - fromMix) * (p * p * (3 - 2 * p));
      if (p >= 1) {
        mix = toMix;
        transitionStart = -1;
      }
    }

    // Advance active time for ambient motion (frozen under reduced motion)
    if (!reducedMotion) {
      activeTime += dt;
    }

    // Smooth cursor
    if (!reducedMotion) {
      var ca = 1 - Math.exp(-dt / 0.18);
      var tX = pointerPresent ? cursorTargetX : 0;
      var tY = pointerPresent ? cursorTargetY : 0;
      cursorSmoothedX += (tX - cursorSmoothedX) * ca;
      cursorSmoothedY += (tY - cursorSmoothedY) * ca;
    } else {
      cursorSmoothedX = 0;
      cursorSmoothedY = 0;
    }

    // Measure bounds if dirty
    if (boundsDirty) measureQuietZone();

    // Clear
    ctx.clearRect(0, 0, cssW, cssH);

    // Light alpha: 0.28 + 0.26 * depth; Dark alpha: 0.38 + 0.52 * depth
    var alphaBase0 = 0.28, alphaScale0 = 0.26; // light (warm sunlit dust)
    var alphaBase1 = 0.38, alphaScale1 = 0.52; // dark (vivid celestial luminosity)

    var cursorPxX = cursorSmoothedX * cssW * 0.5 + cssW * 0.5;
    var cursorPxY = cursorSmoothedY * cssH * 0.5 + cssH * 0.5;

    var repulseSmooth = 1 - Math.exp(-dt / 0.22);
    var lightProg = 1 - mix;
    var quietFadeDist = Math.min(100, Math.max(40, cssW * 0.08));
    var quietFloor = 0.25 + (0.15 - 0.25) * mix;

    for (var i = 0; i < visibleCount && i < particles.length; i++) {
      var p = particles[i];
      var depth = p.depth;

      // Anchor position in CSS pixels
      var anchorX = p.u * cssW;
      var anchorY = p.v * cssH;

      // Ambient drift
      var driftX = 0, driftY = 0;
      if (!reducedMotion) {
        driftX = Math.sin(activeTime * 0.12 + p.phaseX) * 5 * depth;
        driftY = Math.sin(activeTime * 0.10 + p.phaseY) * 7 * depth;
      }

      // Parallax — opposite to cursor direction
      var parallaxX = -cursorSmoothedX * 10 * depth;
      var parallaxY = -cursorSmoothedY * 10 * depth;

      // Position before local repulsion (for distance measurement)
      var preRepX = anchorX + driftX + parallaxX;
      var preRepY = anchorY + driftY + parallaxY;

      // Local repulsion
      if (!reducedMotion && hasFinePointer && pointerPresent) {
        var rdx = preRepX - cursorPxX;
        var rdy = preRepY - cursorPxY;
        var rdist = Math.hypot(rdx, rdy);
        var targetLx = 0, targetLy = 0;
        if (rdist < 120) {
          var strength = 14 * depth * Math.pow(1 - rdist / 120, 2);
          if (rdist > 0.1) {
            targetLx = (rdx / rdist) * strength;
            targetLy = (rdy / rdist) * strength;
          } else {
            // Deterministic fallback direction from phase
            targetLx = Math.cos(p.phaseX) * strength;
            targetLy = Math.sin(p.phaseY) * strength;
          }
        }
        p.localDx += (targetLx - p.localDx) * repulseSmooth;
        p.localDy += (targetLy - p.localDy) * repulseSmooth;
      } else {
        // Decay repulsion offsets toward zero
        p.localDx += (0 - p.localDx) * repulseSmooth;
        p.localDy += (0 - p.localDy) * repulseSmooth;
      }

      var finalX = preRepX + p.localDx;
      var finalY = preRepY + p.localDy;

      // Per-particle interpolated RGB
      var lightC = p.color ? p.color.light : [155, 145, 135];
      var darkC = p.color ? p.color.dark : [235, 240, 255];
      var r = lightC[0] + (darkC[0] - lightC[0]) * mix;
      var g = lightC[1] + (darkC[1] - lightC[1]) * mix;
      var b = lightC[2] + (darkC[2] - lightC[2]) * mix;

      // Alpha
      var alphaLight = (alphaBase0 + alphaScale0 * depth) * p.brightness;
      var alphaDark  = (alphaBase1 + alphaScale1 * depth) * p.brightness;
      var alpha = alphaLight + (alphaDark - alphaLight) * mix;

      // Dynamic shimmer / twinkling (respects reduced motion)
      if (!reducedMotion) {
        // Gentle starlight twinkling in dark mode
        if (mix > 0.05) {
          var twinkle = 1 + (0.22 * Math.sin(activeTime * p.twinkleSpeed + p.twinklePhase)) * mix;
          alpha = Math.min(1, alpha * twinkle);
        }
        // Sunlit dust shimmer in light mode (simulating rotating/tumbling reflective dust facets)
        if (lightProg > 0.05) {
          var shimmer = 1 + (0.30 * Math.sin(activeTime * (p.twinkleSpeed * 0.85) + p.twinklePhase)) * lightProg;
          alpha = Math.min(1, alpha * shimmer);
        }
      }

      // Quiet-zone fade (adaptive floor and fade distance)
      var qd = distToQuietZone(finalX, finalY);
      alpha *= quietFloor + (1 - quietFloor) * smoothstep(0, quietFadeDist, qd);

      if (alpha < 0.005) continue;

      var rInt = Math.round(r);
      var gInt = Math.round(g);
      var bInt = Math.round(b);

      // ── Dark mode: Outer ethereal bloom for prominent stars ──
      if (mix > 0.01 && depth > 0.65) {
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.radius * 4.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rInt + ',' + gInt + ',' + bInt + ',' + (alpha * 0.10 * mix).toFixed(4) + ')';
        ctx.fill();
      }

      // ── Dark mode: Chromatic halo for stars ──
      if (mix > 0.01 && depth > 0.38) {
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.radius * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rInt + ',' + gInt + ',' + bInt + ',' + (alpha * 0.28 * mix).toFixed(4) + ')';
        ctx.fill();
      }

      // ── Light mode: Soft ambient bokeh aura for foreground dust motes ──
      if (lightProg > 0.01 && depth > 0.45) {
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.radius * 3.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rInt + ',' + gInt + ',' + bInt + ',' + (alpha * 0.18 * lightProg).toFixed(4) + ')';
        ctx.fill();
      }

      // ── Light mode: Diffuse dust halo ──
      if (lightProg > 0.01 && depth > 0.25) {
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.radius * 2.0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rInt + ',' + gInt + ',' + bInt + ',' + (alpha * 0.32 * lightProg).toFixed(4) + ')';
        ctx.fill();
      }

      // ── Core particle disc (stars & dust motes) ──
      ctx.beginPath();
      ctx.arc(finalX, finalY, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + rInt + ',' + gInt + ',' + bInt + ',' + alpha.toFixed(3) + ')';
      ctx.fill();

      // ── Dark mode: Brilliant white-hot starlight pinpoint ──
      if (mix > 0.5 && depth > 0.72) {
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255,' + (alpha * 0.75 * mix).toFixed(3) + ')';
        ctx.fill();
      }

      // ── Light mode: Sunlit specular glint for prominent dust motes ──
      if (lightProg > 0.5 && depth > 0.70) {
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255,' + (alpha * 0.60 * lightProg).toFixed(3) + ')';
        ctx.fill();
      }
    }
  }

  // ── Animation loop ──────────────────────────────────────────────────
  function tick(time) {
    frameId = 0;
    var dt = lastFrameTime ? (time - lastFrameTime) / 1000 : 0.016;
    lastFrameTime = time;
    drawFrame(dt);
    if (!reducedMotion && !document.hidden) {
      startLoop();
    }
  }

  function startLoop() {
    if (!frameId && ctx) {
      frameId = requestAnimationFrame(tick);
    }
  }

  function stopLoop() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function renderStatic() {
    if (!ctx) return;
    if (boundsDirty) measureQuietZone();
    drawFrame(0);
  }

  var staticDrawQueued = false;
  function queueStaticDraw() {
    if (!reducedMotion || staticDrawQueued) return;
    staticDrawQueued = true;
    requestAnimationFrame(function () {
      staticDrawQueued = false;
      renderStatic();
    });
  }

  // ── Theme application ───────────────────────────────────────────────
  function applyTheme(next, persist) {
    currentTheme = next;
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (themeMeta) themeMeta.content = next === 'dark' ? DARK_BG : LIGHT_BG;

    // Toggle button state
    if (toggleBtn) {
      var isDark = next === 'dark';
      toggleBtn.setAttribute('aria-pressed', String(isDark));
      if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
      if (sunIcon) sunIcon.style.display = isDark ? 'block' : 'none';
      if (darkText) darkText.style.display = isDark ? 'none' : 'block';
      if (lightText) lightText.style.display = isDark ? 'block' : 'none';
    }

    if (persist) {
      hasExplicitChoice = true;
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* blocked */ }
    }

    // Start canvas transition
    var newToMix = next === 'dark' ? 1 : 0;
    if (reducedMotion) {
      mix = newToMix;
      fromMix = newToMix;
      toMix = newToMix;
      transitionStart = -1;
      queueStaticDraw();
    } else {
      fromMix = mix; // start from current interpolated value
      toMix = newToMix;
      transitionStart = performance.now();
      startLoop();
    }
  }

  // ── Toggle wiring ───────────────────────────────────────────────────
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
    });
    // Reveal toggle now that its listener is attached
    toggleBtn.removeAttribute('hidden');
  }

  // ── System preference tracking ──────────────────────────────────────
  var systemDarkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  systemDarkMQ.addEventListener('change', function (e) {
    if (!hasExplicitChoice) {
      applyTheme(e.matches ? 'dark' : 'light', false);
    }
  });

  // ── Reduced motion tracking ─────────────────────────────────────────
  reduceMotionMQ.addEventListener('change', function (e) {
    reducedMotion = e.matches;
    if (reducedMotion) {
      stopLoop();
      // Finish any pending transition instantly
      mix = toMix;
      transitionStart = -1;
      cursorSmoothedX = 0;
      cursorSmoothedY = 0;
      for (var i = 0; i < particles.length; i++) {
        particles[i].localDx = 0;
        particles[i].localDy = 0;
      }
      queueStaticDraw();
    } else {
      // Restore from reduced-motion: resume loop with existing particle state
      lastFrameTime = 0;
      startLoop();
    }
  });

  // ── Visibility handling ─────────────────────────────────────────────
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopLoop();
    } else {
      // Reset timing baseline, finish pending transition, clear stale pointer
      lastFrameTime = 0;
      if (transitionStart >= 0) {
        mix = toMix;
        transitionStart = -1;
      }
      clearCursor();
      boundsDirty = true;
      if (reducedMotion) {
        queueStaticDraw();
      } else {
        startLoop();
      }
    }
  });

  // Also handle pageshow for bfcache restoration
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      lastFrameTime = 0;
      boundsDirty = true;
      if (transitionStart >= 0) {
        mix = toMix;
        transitionStart = -1;
      }
      resizeCanvas();
      if (reducedMotion) queueStaticDraw();
      else startLoop();
    }
  });

  // ── Resize handling ─────────────────────────────────────────────────
  window.addEventListener('resize', function () {
    resizeCanvas();
    if (reducedMotion) queueStaticDraw();
  });

  // Also watch for DPR changes (e.g. moving between monitors)
  if (window.matchMedia) {
    var dprMQ = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    dprMQ.addEventListener('change', function () {
      resizeCanvas();
      if (reducedMotion) queueStaticDraw();
    });
  }

  // Scroll may shift quiet zone relative to fixed canvas
  window.addEventListener('scroll', function () {
    boundsDirty = true;
    if (reducedMotion) queueStaticDraw();
  }, { passive: true });

  // ── Initialization ──────────────────────────────────────────────────
  createParticles();
  resizeCanvas();
  setupBoundsObserver();

  // Apply initial theme state to toggle UI (no transition, no persistence)
  if (toggleBtn) {
    var isDark = currentTheme === 'dark';
    toggleBtn.setAttribute('aria-pressed', String(isDark));
    if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
    if (sunIcon) sunIcon.style.display = isDark ? 'block' : 'none';
    if (darkText) darkText.style.display = isDark ? 'none' : 'block';
    if (lightText) lightText.style.display = isDark ? 'block' : 'none';
  }

  // Initial draw
  if (reducedMotion) {
    queueStaticDraw();
  } else {
    startLoop();
  }

  // Enable CSS transitions now that initial paint is done
  requestAnimationFrame(function () {
    document.body.classList.add('theme-ready');
  });

})();
