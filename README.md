# Webendra

No agenda. Only `-endra`.

A prestigious gallery of ordinary things with distinguished names.

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

The generator verifies that every listed image exists. To cut out a new image
without changing its colors, install `Pillow` and `rembg`, then run
`python remove_bg.py input.jpg assets/nameendra.png`.

For browser checks, install Python Playwright and its Chromium browser, then run
`python tests/curator_elements_test.py` and `python tests/pwa_test.py`.

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
project. Vercel serves this static site without a build command.
