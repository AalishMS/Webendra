//! Character data shared by the server (for SSR) and the wasm client (for
//! client-side navigation). Keeping a single source of truth prevents the
//! two from drifting apart.

pub const SITE_URL: &str = "https://webendra.vercel.app";
pub const SITE_NAME: &str = "Webendra";
pub const SITE_DESCRIPTION: &str = "A small collection of things with -endra at the end.";

pub struct Character {
    pub name: &'static str,
    pub image: &'static str,
    pub alt: &'static str,
}

pub const CHARACTERS: &[Character] = &[
    Character {
        name: "Ballendra",
        image: "/assets/ballendra.png",
        alt: "Ballendra, Balen Shah holding a basketball",
    },
    Character {
        name: "Birendra",
        image: "/assets/birendra.jpg",
        alt: "Birendra, a cold glass of beer",
    },
    Character {
        name: "Ganendra",
        image: "/assets/ganendra.jpg",
        alt: "Ganendra, a man safely holding a brushed steel pistol pointed down",
    },
    Character {
        name: "Bonendra",
        image: "/assets/bonendra.jpg",
        alt: "Bonendra, a bone",
    },
    Character {
        name: "Botendra",
        image: "/assets/botendra.jpg",
        alt: "Botendra, a friendly silver robot",
    },
    Character {
        name: "Mugendra",
        image: "/assets/mugendra.jpg",
        alt: "Mugendra, a steaming black coffee mug",
    },
    Character {
        name: "Eggendra",
        image: "/assets/eggendra.jpg",
        alt: "Eggendra, a sunny-side-up fried egg",
    },
    Character {
        name: "Frogendra",
        image: "/assets/frogendra.jpg",
        alt: "Frogendra, a serious-looking green frog",
    },
    Character {
        name: "Breadendra",
        image: "/assets/breadendra.jpg",
        alt: "Breadendra, a rustic loaf of bread",
    },
    Character {
        name: "Rockendra",
        image: "/assets/rockendra.jpg",
        alt: "Rockendra, an ordinary gray rock",
    },
    Character {
        name: "Duckendra",
        image: "/assets/duckendra.jpg",
        alt: "Duckendra, a yellow rubber duck",
    },
    Character {
        name: "Sockendra",
        image: "/assets/sockendra.jpg",
        alt: "Sockendra, a single black-and-white striped sock",
    },
    Character {
        name: "Sharkendra",
        image: "/assets/sharkendra.jpg",
        alt: "Sharkendra, a shark facing the camera",
    },
    Character {
        name: "Catendra",
        image: "/assets/catendra.jpg",
        alt: "Catendra, an unimpressed gray tabby cat",
    },
    Character {
        name: "Spoonendra",
        image: "/assets/spoonendra.jpg",
        alt: "Spoonendra, a dramatically lit silver spoon",
    },
    Character {
        name: "Dogendra",
        image: "/assets/dogendra.jpg",
        alt: "Dogendra, a dog raising one paw at a doorbell camera",
    },
    Character {
        name: "Magendra",
        image: "/assets/magendra.jpg",
        alt: "Magendra, a studio portrait of Magnus Carlsen",
    },
    Character {
        name: "Fishendra",
        image: "/assets/fishendra.jpg",
        alt: "Fishendra, a gorilla-faced fish swimming underwater",
    },
    Character {
        name: "Bootendra",
        image: "/assets/bootendra.jpg",
        alt: "Bootendra, a rugged brown leather boot",
    },
    Character {
        name: "Dipendra",
        image: "/assets/dipendra.jpg",
        alt: "Dipendra, a bowl of red dipping sauce",
    },
    Character {
        name: "Fanendra",
        image: "/assets/fanendra.jpg",
        alt: "Fanendra, an electric desk fan",
    },
    Character {
        name: "Rabindra",
        image: "/assets/rabindra.jpg",
        alt: "Rabindra, a pink rubber eraser",
    },
    Character {
        name: "Goatendra",
        image: "/assets/goatendra.jpg",
        alt: "Goatendra, LeBron James staring directly at the camera",
    },
    Character {
        name: "Brownendra",
        image: "/assets/brownendra.png",
        alt: "Brownendra, a distinguished Indian man in a suit",
    },
    Character {
        name: "Gyanendra",
        image: "/assets/gyanendra.png",
        alt: "Gyanendra, a classic hardcover dictionary",
    },
];

/// Lowercased name used as the URL slug, e.g. "Ballendra" -> "ballendra".
pub fn slug(character: &Character) -> String {
    character.name.to_lowercase()
}

/// The path for a given character index: `/` for the first, `/character/<slug>` otherwise.
pub fn character_path(index: usize) -> String {
    if index == 0 {
        "/".to_string()
    } else {
        format!("/character/{}", slug(&CHARACTERS[index]))
    }
}

/// Find a character's index by slug, case-insensitively.
pub fn index_from_slug(slug_str: &str) -> Option<usize> {
    let needle = slug_str.to_lowercase();
    CHARACTERS.iter().position(|c| slug(c) == needle)
}

/// Wrap an index into `0..CHARACTERS.len()`, matching JS's `(i % n + n) % n`.
pub fn wrap_index(index: isize) -> usize {
    let len = CHARACTERS.len() as isize;
    (((index % len) + len) % len) as usize
}
