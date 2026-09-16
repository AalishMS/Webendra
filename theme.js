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

  // Particle color tuples [R, G, B]
  var LIGHT_RGB = [105, 113, 125];
  var DARK_RGB = [235, 240, 255];

  // ── DOM references ───────────────────────────────────────────────────
  var root = document.documentElement;
  var canvas = document.getElementById('ambient-particles');
  var toggleBtn = document.getElementById('theme-toggle');
  var moonIcon = toggleBtn ? toggleBtn.querySelector('.theme-icon-moon') : null;
  var sunIcon = toggleBtn ? toggleBtn.querySelector('.theme-icon-sun') : null;
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
      particles.push({
        u: Math.random(),              // normalized x anchor [0,1]
        v: Math.random(),              // normalized y anchor [0,1]
        depth: 0.2 + Math.random() * 0.8,
        radius: 0.5 + Math.random() * 0.8, // base radius in CSS px
        brightness: 0.65 + Math.random() * 0.35,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
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
    var pad = 24;
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
      var ro = new ResizeObserver(function () { boundsDirty = true; });
      ro.observe(frame);
      ro.observe(nameEl);
    }
  }

  // ── Motion state ────────────────────────────────────────────────────
  var activeTime = 0;
  var cursorTargetX = 0, cursorTargetY = 0;
  var cursorSmoothedX = 0, cursorSmoothedY = 0;
  var lastFrameTime = 0;
  var frameId = 0;

  // ── Pointer tracking ───────────────────────────────────────────────
  function onPointerMove(e) {
    if (!hasFinePointer) return;
    // Normalize to [-1, 1] around viewport center
    cursorTargetX = (e.clientX / cssW - 0.5) * 2;
    cursorTargetY = (e.clientY / cssH - 0.5) * 2;
  }

  function clearCursor() {
    cursorTargetX = 0;
    cursorTargetY = 0;
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
      cursorSmoothedX += (cursorTargetX - cursorSmoothedX) * ca;
      cursorSmoothedY += (cursorTargetY - cursorSmoothedY) * ca;
    } else {
      cursorSmoothedX = 0;
      cursorSmoothedY = 0;
    }

    // Measure bounds if dirty
    if (boundsDirty) measureQuietZone();

    // Clear
    ctx.clearRect(0, 0, cssW, cssH);

    // Interpolate colors
    var r = LIGHT_RGB[0] + (DARK_RGB[0] - LIGHT_RGB[0]) * mix;
    var g = LIGHT_RGB[1] + (DARK_RGB[1] - LIGHT_RGB[1]) * mix;
    var b = LIGHT_RGB[2] + (DARK_RGB[2] - LIGHT_RGB[2]) * mix;

    // Light alpha: 0.10 + 0.12 * depth; Dark alpha: 0.30 + 0.45 * depth
    var alphaBase0 = 0.10, alphaScale0 = 0.12; // light
    var alphaBase1 = 0.30, alphaScale1 = 0.45; // dark

    var cursorPxX = cursorSmoothedX * cssW * 0.5 + cssW * 0.5;
    var cursorPxY = cursorSmoothedY * cssH * 0.5 + cssH * 0.5;

    var repulseSmooth = 1 - Math.exp(-dt / 0.22);

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
      if (!reducedMotion && hasFinePointer) {
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

      // Alpha
      var alphaLight = (alphaBase0 + alphaScale0 * depth) * p.brightness;
      var alphaDark  = (alphaBase1 + alphaScale1 * depth) * p.brightness;
      var alpha = alphaLight + (alphaDark - alphaLight) * mix;

      // Quiet-zone fade
      var qd = distToQuietZone(finalX, finalY);
      alpha *= 0.15 + 0.85 * smoothstep(0, 100, qd);

      if (alpha < 0.005) continue;

      // Draw dot
      ctx.beginPath();
      ctx.arc(finalX, finalY, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + alpha.toFixed(3) + ')';
      ctx.fill();

      // Glow halo for deep particles in dark mode
      if (depth > 0.8 && mix > 0.01) {
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + (alpha * 0.12 * mix).toFixed(4) + ')';
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
      renderStatic();
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
      renderStatic();
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
        renderStatic();
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
      if (reducedMotion) renderStatic();
      else startLoop();
    }
  });

  // ── Resize handling ─────────────────────────────────────────────────
  window.addEventListener('resize', function () {
    resizeCanvas();
    if (reducedMotion) renderStatic();
  });

  // Also watch for DPR changes (e.g. moving between monitors)
  if (window.matchMedia) {
    var dprMQ = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    dprMQ.addEventListener('change', function () {
      resizeCanvas();
      if (reducedMotion) renderStatic();
    });
  }

  // Scroll may shift quiet zone relative to fixed canvas
  window.addEventListener('scroll', function () { boundsDirty = true; }, { passive: true });

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
  }

  // Initial draw
  if (reducedMotion) {
    renderStatic();
  } else {
    startLoop();
  }

  // Enable CSS transitions now that initial paint is done
  requestAnimationFrame(function () {
    document.body.classList.add('theme-ready');
  });

})();

