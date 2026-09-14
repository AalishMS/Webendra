const SITE_URL = "https://webendra.vercel.app";

const characters = [
  {
    name: "Ballendra",
    image: "/assets/ballendra.png",
    alt: "Ballendra, Balen Shah holding a basketball",
  },
  {
    name: "Birendra",
    image: "/assets/birendra.jpg",
    alt: "Birendra, a cold glass of beer",
  },
  {
    name: "Ganendra",
    image: "/assets/ganendra.jpg",
    alt: "Ganendra, a man safely holding a brushed steel pistol pointed down",
  },
  {
    name: "Bonendra",
    image: "/assets/bonendra.jpg",
    alt: "Bonendra, a bone",
  },
  {
    name: "Botendra",
    image: "/assets/botendra.jpg",
    alt: "Botendra, a friendly silver robot",
  },
  {
    name: "Mugendra",
    image: "/assets/mugendra.jpg",
    alt: "Mugendra, a steaming black coffee mug",
  },
  {
    name: "Sockendra",
    image: "/assets/sockendra.jpg",
    alt: "Sockendra, a single black-and-white striped sock",
  },
  {
    name: "Catendra",
    image: "/assets/catendra.jpg",
    alt: "Catendra, an unimpressed gray tabby cat",
  },
  {
    name: "Dogendra",
    image: "/assets/dogendra.jpg",
    alt: "Dogendra, a dog raising one paw at a doorbell camera",
  },
  {
    name: "Magendra",
    image: "/assets/magendra.jpg",
    alt: "Magendra, a studio portrait of Magnus Carlsen",
  },
  {
    name: "Fishendra",
    image: "/assets/fishendra.jpg",
    alt: "Fishendra, a gorilla-faced fish swimming underwater",
  },
  {
    name: "Bootendra",
    image: "/assets/bootendra.jpg",
    alt: "Bootendra, a rugged brown leather boot",
  },
  {
    name: "Dipendra",
    image: "/assets/dipendra.jpg",
    alt: "Dipendra, a bowl of red dipping sauce",
  },
  {
    name: "Rabindra",
    image: "/assets/rabindra.jpg",
    alt: "Rabindra, a pink rubber eraser",
  },
  {
    name: "Goatendra",
    image: "/assets/goatendra.jpg",
    alt: "Goatendra, LeBron James staring directly at the camera",
  },
  {
    name: "Gyanendra",
    image: "/assets/gyanendra.png",
    alt: "Gyanendra, a classic hardcover dictionary",
  },
  {
    name: "Devendra",
    image: "/assets/devendra.png",
    alt: "Devendra, a tired programmer holding an open laptop",
  },
  {
    name: "Nagendra",
    image: "/assets/nagendra.png",
    alt: "Nagendra, a calm upright cobra with its hood open",
  },
  {
    name: "Belendra",
    image: "/assets/belendra.png",
    alt: "Belendra, a single green bell pepper",
  },
  {
    name: "Chillendra",
    image: "/assets/chillendra.png",
    alt: "Chillendra, a relaxed reclining sloth",
  },
  {
    name: "Puffendra",
    image: "/assets/puffendra.png",
    alt: "Puffendra, a fully inflated pufferfish facing forward",
  },
  {
    name: "Blendra",
    image: "/assets/blendra.png",
    alt: "Blendra, an ordinary kitchen blender with an empty transparent jug",
  },
  {
    name: "Cylendra",
    image: "/assets/cylendra.png",
    alt: "Cylendra, a red household LPG cylinder",
  },
  {
    name: "Shavendra",
    image: "/assets/shavendra.png",
    alt: "Shavendra, a man with shaving foam covering half his face",
  },
  {
    name: "Gymendra",
    image: "/assets/gymendra.png",
    alt: "Gymendra, a serious man in a gym vest holding a tiny pink dumbbell",
  },
    {
    name: "Shailendra",
    image: "/assets/shailendra.png",
    alt: "Shailendra, a small sailboat with one white sail",
  },
  {
    name: "Calendra",
    image: "/assets/calendra.jpg",
    alt: "Calendra, a simple wall calendar",
  },
  {
    name: "Bartendra",
    image: "/assets/bartendra.jpg",
    alt: "Bartendra, a professional bartender shaking a metallic cocktail shaker",
  },
  {
    name: "Deffendra",
    image: "/assets/deffendra.jpg",
    alt: "Deffendra, a medieval knight's large metal shield",
  },
  {
    name: "Pretendra",
    image: "/assets/pretendra.jpg",
    alt: "Pretendra, a classic Groucho Marx disguise",
  },
  {
    name: "Yogendra",
    image: "/assets/yogendra.jpg",
    alt: "Yogendra, a person stretching in an advanced yoga pose",
  }
];

const imageFrame = document.querySelector(".image-frame");
const name = document.querySelector("#character-name");
const previousButton = document.querySelector(".arrow--previous");
const nextButton = document.querySelector(".arrow--next");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const structuredData = document.querySelector("#structured-data");
const collectionStructuredData = structuredData.textContent;

let currentIndex = getIndexFromPath();

function getSlug(character) {
  return character.name.toLowerCase();
}

function getCharacterPath(index) {
  return index === 0 ? "/" : `/character/${getSlug(characters[index])}`;
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

function updateSeo(index) {
  const character = characters[index];
  const path = getCharacterPath(index);
  const url = `${SITE_URL}${path}`;
  const imageUrl = `${SITE_URL}${character.image}`;
  const isHome = index === 0;
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
  setMeta('meta[property="og:image:alt"]', character.alt);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', imageUrl);
  setMeta('meta[name="twitter:image:alt"]', character.alt);

  structuredData.textContent = isHome
    ? collectionStructuredData
    : JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ImageObject",
        name: character.name,
        description,
        url,
        contentUrl: imageUrl,
        caption: character.alt,
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
  const expectedPath = getCharacterPath(currentIndex);

  image.src = character.image;
  image.alt = character.alt;
  heading.textContent = character.name;
  updateSeo(currentIndex);

  if (window.location.pathname !== expectedPath) {
    window.history.replaceState({ character: getSlug(character) }, "", expectedPath);
  }
}

renderInitialCharacter();

function preloadCharacter(index) {
  const character = characters[(index + characters.length) % characters.length];
  const preload = new Image();
  preload.src = character.image;
}

window.addEventListener(
  "load",
  () => {
    const preloadNeighbors = () => {
      preloadCharacter(currentIndex - 1);
      preloadCharacter(currentIndex + 1);
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preloadNeighbors);
    } else {
      window.setTimeout(preloadNeighbors, 200);
    }
  },
  { once: true },
);

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

  const path = getCharacterPath(nextIndex);
  if (updateHistory && window.location.pathname !== path) {
    window.history.pushState({ character: getSlug(character) }, "", path);
  }
  updateSeo(nextIndex);

  const previousImage = clearPreviousTransition(
    imageFrame,
    "img",
    "character-image--incoming",
  );
  const nextImage = new Image(1254, 1254);
  nextImage.src = character.image;
  nextImage.alt = character.alt;
  nextImage.className = "character-image character-image--incoming";

  try {
    await nextImage.decode();
  } catch {
    // The load event will still paint the image if decode is unavailable.
  }

  if (thisTransition !== transitionId) return;

  previousImage.removeAttribute("id");
  previousImage.setAttribute("aria-hidden", "true");
  nextImage.id = "character-image";
  imageFrame.append(nextImage);

  const previousName = clearPreviousTransition(
    name,
    ".character-name",
    "character-name--incoming",
  );
  const nextName = previousName.cloneNode(false);
  nextName.className = "character-name character-name--incoming";
  nextName.textContent = character.name;
  previousName.setAttribute("aria-hidden", "true");
  name.append(nextName);

  if (reduceMotion.matches) {
    previousImage.remove();
    nextImage.classList.remove("character-image--incoming");
    nextImage.removeAttribute("style");
    previousName.remove();
    nextName.classList.remove("character-name--incoming");
    nextName.removeAttribute("style");
    preloadCharacter(nextIndex - 1);
    preloadCharacter(nextIndex + 1);
    return;
  }

  const duration = 600;
  const easing = "cubic-bezier(0.16, 1, 0.3, 1)";

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
    previousImage.remove();
    previousName.remove();
    nextImage.getAnimations().forEach((animation) => animation.cancel());
    nextName.getAnimations().forEach((animation) => animation.cancel());
    nextImage.classList.remove("character-image--incoming");
    nextName.classList.remove("character-name--incoming");
    nextImage.removeAttribute("style");
    nextName.removeAttribute("style");
    preloadCharacter(nextIndex - 1);
    preloadCharacter(nextIndex + 1);
  }
}

previousButton.addEventListener("click", () => showCharacter(currentIndex - 1));
nextButton.addEventListener("click", () => showCharacter(currentIndex + 1));

window.addEventListener("popstate", () => {
  const index = getIndexFromPath();

  if (index !== currentIndex) {
    showCharacter(index, { updateHistory: false });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.matches("input, textarea, select, [contenteditable=true]")) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.preventDefault();
  if (event.key === "ArrowLeft") {
    showCharacter(currentIndex - 1);
  }

  if (event.key === "ArrowRight") {
    showCharacter(currentIndex + 1);
  }
});
