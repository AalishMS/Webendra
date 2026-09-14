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

const figure = document.querySelector(".character");
const image = document.querySelector("#character-image");
const name = document.querySelector("#character-name");
const previousButton = document.querySelector(".arrow--previous");
const nextButton = document.querySelector(".arrow--next");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let currentIndex = 0;
let changeTimer;

characters.forEach((character) => {
  const preload = new Image();
  preload.src = character.image;
});

function showCharacter(index) {
  const nextIndex = (index + characters.length) % characters.length;
  const character = characters[nextIndex];
  const delay = reduceMotion.matches ? 0 : 140;

  window.clearTimeout(changeTimer);
  figure.classList.add("is-changing");

  changeTimer = window.setTimeout(() => {
    currentIndex = nextIndex;
    image.src = character.image;
    image.alt = character.alt;
    name.textContent = character.name;
    figure.classList.remove("is-changing");
  }, delay);
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
