# Webendra (Rust)

A Rust rewrite of [Webendra](https://webendra.vercel.app) — a tiny gallery of
ordinary things with `-endra` added to their names. Same look, same
behavior, same 25 characters — reimplemented end to end in Rust instead of
static HTML + hand-written JS.

Use the on-screen arrows, or the left/right arrow keys, to move through the
gallery.

## How it's structured

The original was a client-rendered single-page app: one static `index.html`
always shown, with `app.js` patching in the right character and `<head>`
tags after load. This rewrite splits that into two Rust programs that share
one source of truth for the character data:

- **`crates/shared`** — the character list (name, image, alt text) and the
  small bits of routing logic (slugs, path building, index wrapping) used by
  both the server and the client, so they can't drift apart.
- **`crates/server`** — an [Axum](https://github.com/tokio-rs/axum) web
  server. Every route (`/`, `/character/<slug>`) is rendered server-side
  with the correct `<title>`, canonical URL, Open Graph/Twitter tags, and
  JSON-LD for *that* page — an improvement over the original, which shipped
  one generic document and fixed up the meta tags client-side after the
  fact. Static assets are served with long-lived cache headers.
- **`crates/web`** — the client-side interactivity, compiled to
  WebAssembly via `wasm-bindgen`. It hydrates the server-rendered page:
  arrow/keyboard navigation, the crossfade transition between characters
  (via the Web Animations API), neighbor image preloading, `pushState`/
  `popstate` routing, and live `<head>` updates for client-side navigation —
  a straight port of the original `app.js`.

## Building

Requires a Rust toolchain with the `wasm32-unknown-unknown` target, and
`wasm-bindgen-cli` matching the `wasm-bindgen` crate version pinned in
`crates/web/Cargo.toml`:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128
```

Then:

```bash
./build.sh
./target/release/webendra-server   # listens on :3000 (set PORT to override)
```

`build.sh` compiles the wasm client, runs `wasm-bindgen` to generate its JS
glue into `static/pkg/`, and builds the server binary.

## Adding a new Endra

Add an entry to `CHARACTERS` in `crates/shared/src/lib.rs` and drop the
image in `static/assets/`. Both the server's SSR output and the wasm
client pick it up automatically — there's no second list to update.
