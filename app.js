const SITE_URL = "https://webendra.vercel.app";

const characters = [
  {
    name: "Ballendra",
    image: "/assets/ballendra.jpg",
    alt: "Ballendra, a man holding a basketball",
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
    name: "Eggendra",
    image: "/assets/eggendra.jpg",
    alt: "Eggendra, a sunny-side-up fried egg",
  },
  {
    name: "Frogendra",
    image: "/assets/frogendra.jpg",
    alt: "Frogendra, a serious-looking green frog",
  },
  {
    name: "Breadendra",
    image: "/assets/breadendra.jpg",
    alt: "Breadendra, a rustic loaf of bread",
  },
  {
    name: "Rockendra",
    image: "/assets/rockendra.jpg",
    alt: "Rockendra, an ordinary gray rock",
  },
  {
    name: "Duckendra",
    image: "/assets/duckendra.jpg",
    alt: "Duckendra, a yellow rubber duck",
  },
  {
    name: "Sockendra",
    image: "/assets/sockendra.jpg",
    alt: "Sockendra, a single black-and-white striped sock",
  },
  {
    name: "Sharkendra",
    image: "/assets/sharkendra.jpg",
    alt: "Sharkendra, a shark facing the camera",
  },
  {
    name: "Catendra",
    image: "/assets/catendra.jpg",
    alt: "Catendra, an unimpressed gray tabby cat",
  },
  {
    name: "Spoonendra",
    image: "/assets/spoonendra.jpg",
    alt: "Spoonendra, a dramatically lit silver spoon",
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
    ? "Webendra — A Funny Website of Distinguished Things"
    : `${character.name} — Webendra Funny Character Gallery`;
  const description = isHome
    ? "Webendra is a funny website and character gallery where ordinary people, animals, food, and objects receive unnecessarily dignified -endra names."
    : `Meet ${character.name} in Webendra, the funny website and character gallery of ordinary things with distinguished -endra names.`;

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

const tempo = new TempoTransition();
let busy = false;
let pendingNavigation = null;

async function showCharacter(index, { updateHistory = true } = {}) {
  tempo.unlockAudio();
  const nextIndex = (index + characters.length) % characters.length;
  if (busy) {
    // Keep the latest request; never put two Tempos on the same road.
    pendingNavigation = { index: nextIndex, updateHistory };
    return;
  }
  if (nextIndex === currentIndex) return;
  busy = true;
  const character = characters[nextIndex];
  const nextImage = new Image(1254, 1254);
  nextImage.src = character.image;
  nextImage.alt = character.alt;
  nextImage.className = 'character-image';
  try {
    await nextImage.decode();
  } catch {
    // Keep the current photograph if the next asset cannot load.
    busy = false;
    if (pendingNavigation) {
      const pending = pendingNavigation;
      pendingNavigation = null;
      showCharacter(pending.index, pending);
    }
    return;
  }

  const previousImage = document.querySelector('#character-image');
  const heading = name.querySelector('.character-name');
  currentIndex = nextIndex;
  const path = getCharacterPath(nextIndex);
  if (updateHistory && window.location.pathname !== path) {
    window.history.pushState({ character: getSlug(character) }, '', path);
  }
  updateSeo(nextIndex);
  document.querySelector('.character').setAttribute('aria-busy', 'true');
  previousImage.removeAttribute('id');
  previousImage.setAttribute('aria-hidden', 'true');
  nextImage.id = 'character-image';
  nextImage.style.clipPath = 'inset(0 100% 0 0)';
  imageFrame.append(nextImage);
  let renamed = false;
  const reveal = rear => {
    const rect = imageFrame.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (rear - rect.left) / rect.width));
    nextImage.style.clipPath = `inset(0 ${(1 - fraction) * 100}% 0 0)`;
    if (!renamed && fraction >= .5) {
      heading.textContent = character.name;
      renamed = true;
    }
  };
  if (!reduceMotion.matches && !document.hidden) await tempo.run(reveal, reduceMotion);
  previousImage.remove();
  nextImage.style.removeProperty('clip-path');
  heading.textContent = character.name;
  document.querySelector('.character').removeAttribute('aria-busy');
  preloadCharacter(nextIndex - 1);
  preloadCharacter(nextIndex + 1);
  busy = false;
  if (pendingNavigation) {
    const pending = pendingNavigation;
    pendingNavigation = null;
    showCharacter(pending.index, pending);
  }
}

// Finish immediately when the tab is hidden or reduced motion is enabled.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) tempo.finish?.();
});
reduceMotion.addEventListener('change', () => {
  if (reduceMotion.matches) tempo.finish?.();
});

previousButton.addEventListener("click", () => showCharacter(currentIndex - 1));
nextButton.addEventListener("click", () => showCharacter(currentIndex + 1));

window.addEventListener("popstate", () => {
  const index = getIndexFromPath();

  if (busy || index !== currentIndex) {
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
