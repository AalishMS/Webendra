# Webendra

No agenda. Only `-endra`.

A tiny gallery of ordinary things with `-endra` added to their names, because it sounds funny.

[Enter the gallery](https://webendra.vercel.app/)

## Private viewing

```sh
python -m http.server 8000
```

Open <http://localhost:8000>, then proceed with the arrow keys.

## Maintaining the gallery

Edit `catalogue.js` when adding a character. Keep the asset as a square PNG with
a transparent background, update `Ideas.md`, then regenerate the sitemap and
collection metadata:

```sh
node scripts/generate-metadata.js
node scripts/generate-metadata.js --check
```

To visually rearrange the gallery sequence, start the private curator board:

```sh
node scripts/curator-server.js
```

Open the local URL printed in the terminal, drag the artworks into place, and
choose **Save order**. The tool updates `catalogue.js`, regenerates the
order-dependent pages and metadata, and validates the result. It changes only
the working tree; review the diff before committing or pushing. If the default
port is occupied, the server automatically chooses another and prints its URL.
Use `--port 5000` to request a particular port.

The generator verifies that every listed image exists. To cut out a new image
without changing its colors, install `Pillow` and `rembg`, then run
`python remove_bg.py input.jpg assets/nameendra.png`.

The metadata generator also creates each character's static HTML page and
1200×630 PNG sharing card. Install Pillow before running it; Vercel serves the
generated files directly, so shared links have character metadata before any
JavaScript runs.

Run `node tests/curator_order_test.js` for the curator save and rollback checks.
For browser checks, install Python Playwright and its Chromium browser, then run
`python tests/curator_board_test.py`, `python tests/curator_elements_test.py`, and
`python tests/pwa_test.py`.

## Theme

Darkendra and Lightendra toggles sit in the top-right
corner. Your chosen themendra is saved in `localStorage` and restored on return.
Without a saved choice the gallery follows the operating system preference.

Watch the stars in Darkendra mode.

## Install on a phone

Visit the deployed HTTPS site first. In Android Chrome, open the menu and choose
**Install app** or **Add to Home screen**. In iPhone Safari, use **Share → Add to
Home Screen**, then open Webendra from its icon. It opens without the browser bar;
the phone may still show its status bar.

## Offline viewing

The site is offline friendly for images that have been opened when online. 

To check, Open the site online once and wait for it to finish loading. The page and its
scripts are saved for offline use. Each character image is saved when you view
that character; the gallery does not download the whole collection in advance.
An image you have not viewed cannot be opened offline.

To check, view a few characters, turn on airplane mode, and reopen Webendra
from the home screen. The characters you viewed should still appear, including
when you open one of their `/character/...` links directly. Try the arrow keys
on a computer and tap the arrows on a phone. Check both themes and wraparound.
Turn connectivity back on and reopen the app to receive newly deployed
characters and images.

## Deployed on Vercel

Changes are deployed to Vercel on push. The site's Git repository is connected to the Vercel
project. Vercel regenerates character pages and metadata at build time.

## Ratings and reviews

Every character has a shared five-star rating and an optional written review. Guests can
revise their own entry on the same browser. Reviews appear immediately; remove unwanted
entries in the Supabase Table Editor. Ratings and reviews need a connection, while the
gallery's previously viewed images remain available offline.

For a new deployment, set up a Webendra Supabase project before enabling reviews:

1. Run `supabase/schema.sql` in the project's SQL Editor. Enable anonymous sign-ins under
   Authentication > Providers, and enable Cloudflare Turnstile under Authentication > Attack
   Protection. The Turnstile site must allow `webendra.vercel.app` and any local
   hostname used for testing.
2. Put the Supabase project URL, publishable key, and Turnstile **site key** in
   `reviews-config.js`, then redeploy. These three values are public browser settings.
   Never put a Supabase secret, service-role key, or Turnstile secret in that file.
3. Confirm that the public review summary loads and a first-time guest can pass
   Turnstile and submit a rating on the deployed site.
4. When adding a new character to `catalogue.js`, also insert its lowercase name into
   `public.review_characters`. This allowlist prevents ratings for unknown characters.

If the public configuration is absent, the gallery still works and the review panel
explains that reviews are unavailable. If only the Turnstile site key is missing,
visitors can read ratings and reviews but cannot post. A guest's anonymous session belongs to that
browser; clearing site data or using another device starts a new session.
