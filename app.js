const SITE_URL = "https://webendra.vercel.app";

const imageFrame = document.querySelector(".image-frame");
const name = document.querySelector("#character-name");
const previousButton = document.querySelector(".arrow--previous");
const nextButton = document.querySelector(".arrow--next");
const catalogueNumber = document.querySelector("#catalogue-number");
const shareButton = document.querySelector("#share-btn");
const copyImageButton = document.querySelector("#copy-image-btn");
const toast = document.querySelector("#toast");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const structuredData = document.querySelector("#structured-data");
const collectionStructuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Webendra",
  url: `${SITE_URL}/`,
  description: "A small collection of things with -endra at the end.",
  author: {
    "@type": "Person",
    name: "Aalish Man Singh",
    url: "https://github.com/AalishMS",
  },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: characters.length,
    itemListElement: characters.map((character, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: character.name,
      url: `${SITE_URL}/character/${character.name.toLowerCase()}`,
    })),
  },
});

let currentIndex = getIndexFromPath();
let toastTimeout = 0;

function cacheViewedImage(path) {
  if (!("serviceWorker" in navigator) || navigator.serviceWorker.controller) return;
  navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({ type: "CACHE_VIEWED_IMAGE", url: path });
  }).catch(() => {});
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }, { once: true });
}

function updateCuratorMeta(index) {
  const character = characters[index];
  const digits = String(characters.length).length;
  catalogueNumber.textContent = `№ ${String(index + 1).padStart(digits, "0")} / ${String(characters.length).padStart(digits, "0")}`;
  shareButton.setAttribute("aria-label", `Copy link to ${character.name}`);
  copyImageButton?.setAttribute("aria-label", `Copy image of ${character.name}`);
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!toast.classList.contains("is-visible")) toast.textContent = "";
    }, 200);
  }, 2200);
}

async function shareCurrentCharacter() {
  const url = `${SITE_URL}${getCharacterPath(currentIndex)}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(url);
    showToast("Art piece copied.");
  } catch {
    showToast("Link could not be copied.");
  }
}

shareButton.addEventListener("click", shareCurrentCharacter);

async function copyCurrentImage() {
  const character = characters[currentIndex];
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("Clipboard image unavailable");
    }
    let blob;
    if ("caches" in window) {
      try {
        const cache = await caches.open("webendra-images");
        const match = await cache.match(character.image);
        if (match) {
          blob = await match.blob();
        }
      } catch {
        // Cache read failure should not block fetching directly
      }
    }
    if (!blob) {
      const response = await fetch(character.image);
      if (!response.ok) throw new Error("Image fetch failed");
      blob = await response.blob();
    }
    const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": pngBlob,
      }),
    ]);
    showToast("Image copied");
  } catch {
    showToast("Image could not be copied.");
  }
}

copyImageButton?.addEventListener("click", copyCurrentImage);

function getSlug(character) {
  return character.name.toLowerCase();
}

function getCharacterPath(index) {
  return `/character/${getSlug(characters[index])}`;
}

function getIndexFromPath() {
  const match = window.location.pathname.match(/^\/character\/([^/]+)\/?$/);

  if (!match) {
    return 0;
  }

  const index = characters.findIndex((character) => getSlug(character) === match[1].toLowerCase());
  return index === -1 ? 0 : index;
}

function setMeta(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.content = value;
  }
}

function updateSeo(index, path = getCharacterPath(index)) {
  const character = characters[index];
  const url = `${SITE_URL}${path}`;
  const isHome = path === "/";
  const imageUrl = isHome
    ? `${SITE_URL}/assets/webendra-share.png`
    : `${SITE_URL}/assets/share/${character.name.toLowerCase()}.png`;
  const imageAlt = isHome
    ? "Webendra, written in wobbly black hand lettering on white"
    : `${character.name} on a Webendra share card`;
  const title = isHome
    ? "Webendra"
    : `${character.name} — Webendra`;
  const description = isHome
    ? "A small collection of things with -endra at the end."
    : `${character.name} — A small collection of things with -endra at the end.`;

  document.title = title;
  document.querySelector('link[rel="canonical"]').href = url;
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:url"]', url);
  setMeta('meta[property="og:image"]', imageUrl);
  setMeta('meta[property="og:image:alt"]', imageAlt);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', imageUrl);
  setMeta('meta[name="twitter:image:alt"]', imageAlt);

  structuredData.textContent = isHome
    ? collectionStructuredData
    : JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ImageObject",
        name: character.name,
        description,
        url,
        contentUrl: `${SITE_URL}${character.image}`,
        thumbnailUrl: imageUrl,
        caption: character.alt,
        author: {
          "@type": "Person",
          name: "Aalish Man Singh",
          url: "https://github.com/AalishMS",
        },
        isPartOf: {
          "@type": "CollectionPage",
          name: "Webendra",
          url: `${SITE_URL}/`,
        },
      });
}

function renderInitialCharacter() {
  const character = characters[currentIndex];
  const image = document.querySelector("#character-image");
  const heading = document.querySelector("#character-name .character-name");
  const expectedPath = currentIndex === 0 && window.location.pathname === "/"
    ? "/" : getCharacterPath(currentIndex);

  image.src = character.image;
  image.alt = character.alt;
  if (image.complete && image.naturalWidth > 0) {
    cacheViewedImage(character.image);
  } else {
    image.addEventListener("load", () => cacheViewedImage(character.image), { once: true });
  }
  heading.textContent = character.displayName ?? character.name;
  updateCuratorMeta(currentIndex);
  updateSeo(currentIndex, expectedPath);

  if (window.location.pathname !== expectedPath) {
    window.history.replaceState({ character: getSlug(character) }, "", expectedPath);
  }
}

renderInitialCharacter();

let transitionId = 0;

function clearPreviousTransition(container, selector, incomingClass) {
  const layers = [...container.querySelectorAll(selector)];
  const visibleLayer = layers.at(-1);
  const visibleStyle = window.getComputedStyle(visibleLayer);
  const opacity = visibleStyle.opacity;
  const transform = visibleStyle.transform;

  layers.forEach((layer) => {
    layer.getAnimations().forEach((animation) => animation.cancel());

    if (layer !== visibleLayer) {
      layer.remove();
    }
  });

  visibleLayer.classList.remove(incomingClass);
  visibleLayer.removeAttribute("aria-hidden");
  visibleLayer.style.opacity = opacity;
  visibleLayer.style.transform = transform;

  return visibleLayer;
}

async function showCharacter(index, { updateHistory = true } = {}) {
  const nextIndex = (index + characters.length) % characters.length;
  if (nextIndex === currentIndex) return;

  const character = characters[nextIndex];
  const direction = nextIndex === (currentIndex - 1 + characters.length) % characters.length ? -1 : 1;
  const thisTransition = ++transitionId;
  currentIndex = nextIndex;
  updateCuratorMeta(nextIndex);
  updateSeo(nextIndex, !updateHistory && window.location.pathname === "/" ? "/" : getCharacterPath(nextIndex));
  const nextImage = new Image();
  nextImage.src = character.image;
  nextImage.alt = character.alt;
  nextImage.className = "character-image character-image--incoming";

  try {
    await nextImage.decode();
  } catch {
    if (!nextImage.naturalWidth) {
      if (thisTransition === transitionId) {
        const displayedPath = new URL(document.querySelector("#character-image").src).pathname;
        const displayedIndex = characters.findIndex((item) => item.image === displayedPath);
        currentIndex = displayedIndex < 0 ? 0 : displayedIndex;
        updateCuratorMeta(currentIndex);
        const previousPath = window.location.pathname === "/" ? "/" : getCharacterPath(currentIndex);
        updateSeo(currentIndex, previousPath);
        window.history.replaceState(
          { character: getSlug(characters[currentIndex]) }, "", previousPath,
        );
        showToast("Character image unavailable.");
      }
      return;
    }
  }

  if (thisTransition !== transitionId) return;
  cacheViewedImage(character.image);

  const currentFrameHeight = imageFrame.getBoundingClientRect().height;
  imageFrame.getAnimations().forEach((animation) => animation.cancel());
  imageFrame.style.height = `${currentFrameHeight}px`;

  const path = getCharacterPath(nextIndex);
  if (updateHistory && window.location.pathname !== path) {
    window.history.pushState({ character: getSlug(character) }, "", path);
  }
  const previousImage = clearPreviousTransition(
    imageFrame,
    "img",
    "character-image--incoming",
  );

  previousImage.removeAttribute("id");
  previousImage.setAttribute("aria-hidden", "true");
  nextImage.id = "character-image";
  imageFrame.append(nextImage);

  const maxImageHeight = Number.parseFloat(window.getComputedStyle(nextImage).maxHeight);
  const targetFrameHeight = Math.min(
    imageFrame.clientWidth * (nextImage.naturalHeight / nextImage.naturalWidth),
    Number.isFinite(maxImageHeight) ? maxImageHeight : Number.POSITIVE_INFINITY,
  );

  const previousName = clearPreviousTransition(
    name,
    ".character-name",
    "character-name--incoming",
  );
  const nextName = previousName.cloneNode(false);
  nextName.className = "character-name character-name--incoming";
  nextName.textContent = character.displayName ?? character.name;
  previousName.setAttribute("aria-hidden", "true");
  name.append(nextName);

  if (reduceMotion.matches) {
    previousImage.remove();
    nextImage.classList.remove("character-image--incoming");
    nextImage.removeAttribute("style");
    imageFrame.style.removeProperty("height");
    previousName.remove();
    nextName.classList.remove("character-name--incoming");
    nextName.removeAttribute("style");
    return;
  }

  const duration = 600;
  const easing = "cubic-bezier(0.16, 1, 0.3, 1)";

  const frameAnimation = imageFrame.animate(
    [
      { height: `${currentFrameHeight}px` },
      { height: `${targetFrameHeight}px` },
    ],
    { duration, easing, fill: "forwards" },
  );

  const outgoingAnimation = previousImage.animate(
    [
      { opacity: previousImage.style.opacity || 1, transform: previousImage.style.transform || "none" },
      { opacity: 0, transform: `translateX(${direction * -5}px) scale(0.992)` },
    ],
    { duration, easing, fill: "forwards" },
  );

  const incomingAnimation = nextImage.animate(
    [
      { opacity: 0, transform: `translateX(${direction * 8}px) scale(1.012)` },
      { opacity: 1, transform: "translateX(0) scale(1)" },
    ],
    { duration, easing, fill: "forwards" },
  );

  const outgoingNameAnimation = previousName.animate(
    [
      { opacity: previousName.style.opacity || 1, transform: previousName.style.transform || "none" },
      { opacity: 0, transform: `translateX(${direction * -5}px) scale(0.992)` },
    ],
    { duration, easing, fill: "forwards" },
  );

  const incomingNameAnimation = nextName.animate(
    [
      { opacity: 0, transform: `translateX(${direction * 8}px) scale(1.012)` },
      { opacity: 1, transform: "translateX(0) scale(1)" },
    ],
    { duration, easing, fill: "forwards" },
  );

  await incomingAnimation.finished.catch(() => {});

  if (thisTransition === transitionId) {
    outgoingAnimation.cancel();
    outgoingNameAnimation.cancel();
    frameAnimation.cancel();
    previousImage.remove();
    previousName.remove();
    nextImage.getAnimations().forEach((animation) => animation.cancel());
    nextName.getAnimations().forEach((animation) => animation.cancel());
    nextImage.classList.remove("character-image--incoming");
    nextName.classList.remove("character-name--incoming");
    nextImage.removeAttribute("style");
    nextName.removeAttribute("style");
    imageFrame.style.removeProperty("height");
  }
}

previousButton.addEventListener("click", () => showCharacter(currentIndex - 1));
nextButton.addEventListener("click", () => showCharacter(currentIndex + 1));

window.addEventListener("popstate", () => {
  const index = getIndexFromPath();

  if (index !== currentIndex) {
    showCharacter(index, { updateHistory: false });
  } else {
    updateSeo(index, window.location.pathname === "/" ? "/" : getCharacterPath(index));
  }
});

const curatorBtn = document.querySelector("#curator-colophon-btn");
const curatorDialog = document.querySelector("#curator-dialog");
const curatorCloseBtn = document.querySelector("#curator-dialog-close");

if (curatorBtn && curatorDialog) {
  function openCuratorDialog() {
    curatorDialog.hidden = false;
    curatorBtn.setAttribute("aria-expanded", "true");
  }

  function closeCuratorDialog() {
    curatorDialog.hidden = true;
    curatorBtn.setAttribute("aria-expanded", "false");
  }

  curatorBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (curatorDialog.hidden) {
      openCuratorDialog();
    } else {
      closeCuratorDialog();
    }
  });

  curatorCloseBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeCuratorDialog();
    curatorBtn.focus();
  });

  curatorDialog.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (!curatorDialog.hidden && !curatorDialog.contains(event.target) && event.target !== curatorBtn) {
      closeCuratorDialog();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !curatorDialog.hidden) {
      closeCuratorDialog();
      curatorBtn.focus();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (curatorDialog && !curatorDialog.hidden) return;
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.matches("input, textarea, select, [contenteditable=true]")) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.preventDefault();
  if (event.key === "ArrowLeft") {
    showCharacter(currentIndex - 1);
  }

  if (event.key === "ArrowRight") {
    showCharacter(currentIndex + 1);
  }

  if (event.code === "KeyC" && !event.shiftKey) {
    shareCurrentCharacter();
  }
});

const kfcBtn = document.querySelector("#kfc-btn");
const kfcClearBtn = document.querySelector("#kfc-clear-btn");

// Short-lived streaks and stars follow movement, never intercepting input.
function leaveKfcTrail(fromX, fromY, toX, toY) {
  if (reduceMotion.matches) return;
  const distance = Math.hypot(toX - fromX, toY - fromY);
  if (distance < 2) return;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const count = Math.min(8, Math.ceil(distance / 12));
  for (let i = 1; i <= count; i++) {
    const spark = document.createElement("span");
    spark.className = "kfc-spark";
    spark.setAttribute("aria-hidden", "true");
    spark.style.left = `${fromX + (toX - fromX) * i / count}px`;
    spark.style.top = `${fromY + (toY - fromY) * i / count}px`;
    spark.style.marginLeft = `${(Math.random() - 0.5) * 28}px`;
    spark.style.marginTop = `${(Math.random() - 0.5) * 28}px`;
    spark.style.setProperty("--scatter-x", `${(Math.random() - 0.5) * 28}px`);
    spark.style.setProperty("--scatter-y", `${(Math.random() - 0.5) * 28}px`);
    spark.style.setProperty("--size", `${4 + Math.random() * 6}px`);
    spark.style.setProperty("--angle", `${angle}rad`);
    spark.style.setProperty("--tail", `${Math.min(28, 7 + 1.25 * distance / count)}px`);
    spark.style.setProperty("--color", ["#d99a16", "#f5bf42", "#ffe49a"][i % 3]);
    // Bound the particle count even during rapid multi-touch dragging.
    if (document.querySelectorAll(".kfc-spark").length >= 160) {
      document.querySelector(".kfc-spark").remove();
    }
    document.body.append(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
    window.setTimeout(() => spark.remove(), 750);
  }
}

function positionKfc(kfc, x, y, trail = false) {
  const oldX = parseFloat(kfc.style.left) || 0;
  const oldY = parseFloat(kfc.style.top) || 0;
  const nextX = Math.max(4, Math.min(window.innerWidth - 104, x));
  const nextY = Math.max(4, Math.min(window.innerHeight - 104, y));
  kfc.style.left = `${nextX}px`;
  kfc.style.top = `${nextY}px`;
  if (trail) leaveKfcTrail(oldX + 50, oldY + 50, nextX + 50, nextY + 50);
}

// Velocities use pixels per second so the drift feels the same at any refresh rate.
const kfcBodies = new Map();
let kfcFrame = 0;
let kfcLastTime = 0;

function wakeKfcMotion() {
  if (kfcFrame || reduceMotion.matches || document.hidden) return;
  kfcLastTime = performance.now();
  kfcFrame = requestAnimationFrame(tickKfcMotion);
}

function tickKfcMotion(time) {
  kfcFrame = 0;
  const dt = Math.min((time - kfcLastTime) / 1000, 0.032);
  kfcLastTime = time;
  let moving = false;
  for (const [kfc, body] of kfcBodies) {
    if (body.dragging) {
      moving = true;
      // A held chicken has a soft personal-space radius.
      const x = parseFloat(kfc.style.left);
      const y = parseFloat(kfc.style.top);
      for (const [other, neighbor] of kfcBodies) {
        if (other === kfc || neighbor.dragging) continue;
        const dx = parseFloat(other.style.left) - x;
        const dy = parseFloat(other.style.top) - y;
        const distance = Math.hypot(dx, dy);
        if (distance >= 135) continue;
        const nx = distance > 0.1 ? dx / distance : 1;
        const ny = distance > 0.1 ? dy / distance : 0;
        const force = (1 - distance / 135) * 2200 * dt;
        neighbor.vx += nx * force;
        neighbor.vy += ny * force;
      }
    }
  }
  for (const [kfc, body] of kfcBodies) {
    if (body.dragging) continue;
    const speed = Math.hypot(body.vx, body.vy);
    if (speed < 5) { body.vx = body.vy = 0; continue; }
    moving = true;
    const x = parseFloat(kfc.style.left) + body.vx * dt;
    const y = parseFloat(kfc.style.top) + body.vy * dt;
    positionKfc(kfc, x, y, true);
    // Gentle edge rebounds keep every chicken reachable.
    if (x < 4 || x > innerWidth - 104) body.vx *= -0.35;
    if (y < 4 || y > innerHeight - 104) body.vy *= -0.35;
    const friction = Math.exp(-3.2 * dt);
    body.vx *= friction;
    body.vy *= friction;
  }
  if (moving && !reduceMotion.matches) kfcFrame = requestAnimationFrame(tickKfcMotion);
}

function stopKfcMotion() {
  cancelAnimationFrame(kfcFrame);
  kfcFrame = 0;
  for (const body of kfcBodies.values()) body.vx = body.vy = 0;
}
reduceMotion.addEventListener("change", () => {
  if (reduceMotion.matches) stopKfcMotion();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopKfcMotion();
  else wakeKfcMotion();
});

if (kfcBtn && kfcClearBtn) {
  kfcBtn.addEventListener("click", () => {
    const kfc = document.createElement("button");
    kfc.type = "button";
    kfc.className = "spawned-kfc";
    kfc.setAttribute("aria-label", "KFC drumstick. Drag or use arrow keys to move.");
    const chicken = document.createElement("img");
    chicken.src = "/assets/kfc.png";
    chicken.alt = "";
    chicken.draggable = false;
    kfc.append(chicken);
    kfc.style.setProperty("--wiggle-duration", `${1.8 + Math.random()}s`);
    kfc.style.setProperty("--wiggle-delay", `${-Math.random() * 3}s`);
    positionKfc(kfc, Math.random() * (innerWidth - 100), Math.random() * (innerHeight - 100));
    const body = { vx: 0, vy: 0, dragging: false };
    kfcBodies.set(kfc, body);
    let drag = null;
    kfc.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag) return;
      drag = { id: event.pointerId, x: event.clientX - parseFloat(kfc.style.left), y: event.clientY - parseFloat(kfc.style.top) };
      body.vx = body.vy = 0;
      body.dragging = true;
      drag.time = performance.now();
      wakeKfcMotion();
      kfc.setPointerCapture(event.pointerId);
      kfc.classList.add("is-dragging");
      kfc.focus({ preventScroll: true });
      event.preventDefault();
    });
    kfc.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const oldX = parseFloat(kfc.style.left);
      const oldY = parseFloat(kfc.style.top);
      positionKfc(kfc, event.clientX - drag.x, event.clientY - drag.y, true);
      const now = performance.now();
      const dt = Math.max((now - drag.time) / 1000, 0.008);
      body.vx = Math.max(-1000, Math.min(1000, (parseFloat(kfc.style.left) - oldX) / dt));
      body.vy = Math.max(-1000, Math.min(1000, (parseFloat(kfc.style.top) - oldY) / dt));
      drag.time = now;
    });
    const endDrag = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      // Pausing before release or cancelling a gesture should not fling it.
      if (event.type !== "pointerup" || performance.now() - drag.time > 100 || reduceMotion.matches) {
        body.vx = body.vy = 0;
      }
      body.dragging = false;
      drag = null;
      wakeKfcMotion();
      kfc.classList.remove("is-dragging");
      if (kfc.hasPointerCapture(event.pointerId)) kfc.releasePointerCapture(event.pointerId);
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => kfc.addEventListener(type, endDrag));
    kfc.addEventListener("keydown", (event) => {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      body.vx = body.vy = 0;
      const step = event.shiftKey ? 30 : 10;
      positionKfc(kfc, parseFloat(kfc.style.left) + direction[0] * step, parseFloat(kfc.style.top) + direction[1] * step, true);
    });
    document.body.append(kfc);
    kfcClearBtn.disabled = false;
  });

  kfcClearBtn.addEventListener("click", () => {
    stopKfcMotion();
    kfcBodies.clear();
    document.querySelectorAll(".spawned-kfc, .kfc-spark").forEach(el => el.remove());
    kfcClearBtn.disabled = true;
  });
  window.addEventListener("resize", () => {
    document.querySelectorAll(".spawned-kfc").forEach(kfc => positionKfc(kfc, parseFloat(kfc.style.left), parseFloat(kfc.style.top)));
  });
}
