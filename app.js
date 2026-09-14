const characters = [
  {
    name: "Ballendra",
    image: "assets/ballendra.png",
    alt: "A man holding a basketball",
  },
  {
    name: "Birendra",
    image: "assets/birendra.png",
    alt: "A cold glass of beer",
  },
  {
    name: "Ganendra",
    image: "assets/ganendra.png",
    alt: "A man safely holding a brushed steel Desert Eagle pistol pointed down",
  },
  {
    name: "Bonendra",
    image: "assets/bonendra.png",
    alt: "A bone",
  },
  {
    name: "Botendra",
    image: "assets/botendra.png",
    alt: "A friendly silver robot",
  },
  {
    name: "Mugendra",
    image: "assets/mugendra.png",
    alt: "A steaming black coffee mug",
  },
  {
    name: "Eggendra",
    image: "assets/eggendra.png",
    alt: "A sunny-side-up fried egg",
  },
  {
    name: "Frogendra",
    image: "assets/frogendra.png",
    alt: "A serious-looking green frog",
  },
  {
    name: "Breadendra",
    image: "assets/breadendra.png",
    alt: "A rustic loaf of bread",
  },
  {
    name: "Rockendra",
    image: "assets/rockendra.png",
    alt: "An ordinary gray rock",
  },
  {
    name: "Duckendra",
    image: "assets/duckendra.png",
    alt: "A yellow rubber duck",
  },
  {
    name: "Sockendra",
    image: "assets/sockendra.png",
    alt: "A single black-and-white striped sock",
  },
  {
    name: "Sharkendra",
    image: "assets/sharkendra.png",
    alt: "A shark facing the camera",
  },
  {
    name: "Catendra",
    image: "assets/catendra.png",
    alt: "An unimpressed gray tabby cat",
  },
  {
    name: "Spoonendra",
    image: "assets/spoonendra.png",
    alt: "A dramatically lit silver spoon",
  },
  {
    name: "Dogendra",
    image: "assets/dogendra.png",
    alt: "A dog raising one paw at a doorbell camera",
  },
  {
    name: "Magendra",
    image: "assets/magendra.png",
    alt: "A studio portrait of Magnus Carlsen",
  },
  {
    name: "Fishendra",
    image: "assets/fishendra.png",
    alt: "A gorilla-faced fish swimming underwater",
  },
];

const imageFrame = document.querySelector(".image-frame");
const name = document.querySelector("#character-name");
const previousButton = document.querySelector(".arrow--previous");
const nextButton = document.querySelector(".arrow--next");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let currentIndex = 0;
let transitionId = 0;

characters.forEach((character) => {
  const preload = new Image();
  preload.src = character.image;
});

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

async function showCharacter(index) {
  const nextIndex = (index + characters.length) % characters.length;
  const character = characters[nextIndex];
  const direction = nextIndex === (currentIndex - 1 + characters.length) % characters.length ? -1 : 1;
  const thisTransition = ++transitionId;

  currentIndex = nextIndex;
  const previousImage = clearPreviousTransition(
    imageFrame,
    "img",
    "character-image--incoming",
  );

  const nextImage = document.createElement("img");
  nextImage.src = character.image;
  nextImage.alt = character.alt;
  nextImage.className = "character-image character-image--incoming";

  try {
    await nextImage.decode();
  } catch {
    // The load event will still paint the image if decode is unavailable.
  }

  if (thisTransition !== transitionId) {
    return;
  }

  previousImage.removeAttribute("id");
  previousImage.setAttribute("aria-hidden", "true");
  nextImage.id = "character-image";
  imageFrame.append(nextImage);

  const previousName = clearPreviousTransition(
    name,
    ".character-name",
    "character-name--incoming",
  );
  const nextName = document.createElement("span");
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
  }
}

previousButton.addEventListener("click", () => showCharacter(currentIndex - 1));
nextButton.addEventListener("click", () => showCharacter(currentIndex + 1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    showCharacter(currentIndex - 1);
  }

  if (event.key === "ArrowRight") {
    showCharacter(currentIndex + 1);
  }
});
