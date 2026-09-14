//! Server-side HTML rendering. Every route gets a full, correctly-tagged
//! document up front (title, canonical, Open Graph, Twitter card, JSON-LD),
//! rather than relying on client-side JS to patch `<head>` after load like
//! the original app did.

use serde_json::json;
use webendra_shared::{character_path, CHARACTERS, SITE_DESCRIPTION, SITE_NAME, SITE_URL};

/// Escape text for safe placement inside HTML text nodes and double-quoted
/// attributes. All character data here is trusted static content, but we
/// escape anyway so this function stays correct if that ever changes.
fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            other => out.push(other),
        }
    }
    out
}

fn collection_structured_data() -> serde_json::Value {
    let items: Vec<serde_json::Value> = CHARACTERS
        .iter()
        .enumerate()
        .map(|(i, c)| {
            json!({
                "@type": "ListItem",
                "position": i + 1,
                "name": c.name,
                "url": format!("{SITE_URL}{}", character_path(i)),
            })
        })
        .collect();

    json!({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": SITE_NAME,
        "url": format!("{SITE_URL}/"),
        "description": SITE_DESCRIPTION,
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": CHARACTERS.len(),
            "itemListElement": items,
        }
    })
}

fn character_structured_data(index: usize, description: &str, url: &str, image_url: &str) -> serde_json::Value {
    let character = &CHARACTERS[index];
    json!({
        "@context": "https://schema.org",
        "@type": "ImageObject",
        "name": character.name,
        "description": description,
        "url": url,
        "contentUrl": image_url,
        "caption": character.alt,
        "isPartOf": {
            "@type": "CollectionPage",
            "name": SITE_NAME,
            "url": format!("{SITE_URL}/"),
        }
    })
}

/// Render the full document for the character at `index`.
pub fn render_page(index: usize) -> String {
    let character = &CHARACTERS[index];
    let path = character_path(index);
    let url = format!("{SITE_URL}{path}");
    let image_url = format!("{SITE_URL}{}", character.image);
    let is_home = index == 0;

    let title = if is_home {
        SITE_NAME.to_string()
    } else {
        format!("{} — {}", character.name, SITE_NAME)
    };
    let description = if is_home {
        SITE_DESCRIPTION.to_string()
    } else {
        format!("{} — {}", character.name, SITE_DESCRIPTION)
    };

    let structured_data = if is_home {
        collection_structured_data()
    } else {
        character_structured_data(index, &description, &url, &image_url)
    };

    let title = escape_html(&title);
    let description = escape_html(&description);
    let url = escape_html(&url);
    let image_url = escape_html(&image_url);
    let image_path = escape_html(character.image);
    let alt = escape_html(character.alt);
    let name = escape_html(character.name);
    let structured_json = structured_data.to_string();

    format!(
        r##"<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content="{description}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="googlebot" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="application-name" content="{site_name}" />
    <link rel="canonical" href="{url}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="{site_name}" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:url" content="{url}" />
    <meta property="og:image" content="{image_url}" />
    <meta property="og:image:alt" content="{alt}" />
    <meta property="og:locale" content="en_US" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />
    <meta name="twitter:image" content="{image_url}" />
    <meta name="twitter:image:alt" content="{alt}" />

    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preload" as="image" href="{image_path}" fetchpriority="high" />
    <link rel="stylesheet" href="/styles.css" />

    <script id="structured-data" type="application/ld+json">
      {structured_json}
    </script>
  </head>
  <body>
    <main class="showcase" aria-label="Webendra gallery">
      <button class="arrow arrow--previous" type="button" aria-label="Previous character">
        <span aria-hidden="true">←</span>
      </button>

      <figure class="character" aria-live="polite" aria-atomic="true">
        <div class="image-frame">
          <img
            id="character-image"
            src="{image_path}"
            alt="{alt}"
            width="1254"
            height="1254"
            fetchpriority="high"
          />
        </div>
        <figcaption id="character-name">
          <h1 class="character-name">{name}</h1>
        </figcaption>
      </figure>

      <button class="arrow arrow--next" type="button" aria-label="Next character">
        <span aria-hidden="true">→</span>
      </button>
    </main>

    <script type="module">
      import init from "/pkg/app.js";
      init();
    </script>
  </body>
</html>
"##,
        site_name = SITE_NAME,
    )
}

/// Render a minimal 404 page for an unknown `/character/<slug>`.
pub fn render_not_found() -> String {
    format!(
        r##"<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Not found — {site_name}</title>
    <meta name="robots" content="noindex" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="showcase" aria-label="Not found">
      <figure class="character" style="grid-column: 1 / -1;">
        <figcaption id="character-name">
          <h1 class="character-name">Not found</h1>
        </figcaption>
        <p><a href="/">Back to {site_name}</a></p>
      </figure>
    </main>
  </body>
</html>
"##,
        site_name = SITE_NAME,
    )
}
