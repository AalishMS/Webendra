const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const characters = require("../catalogue.js");

const root = path.resolve(__dirname, "..");
const siteUrl = "https://webendra.vercel.app";
const check = process.argv.includes("--check");
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n");

if (!characters.length) throw new Error("The catalogue is empty");
const seen = new Set();
const cataloguePath = path.join(root, "catalogue.js");
let catalogueSource = fs.readFileSync(cataloguePath, "utf8");
for (const character of characters) {
  const slug = character.name.toLowerCase();
  if (!/^[a-z]+$/.test(slug) || seen.has(slug)) {
    throw new Error(`Invalid or duplicate character name: ${character.name}`);
  }
  seen.add(slug);
  const imagePath = character.image.split("?")[0];
  if (!character.alt || !/^\/assets\/[a-z0-9-]+\.png$/.test(imagePath)) {
    throw new Error(`Invalid image or alt text for ${character.name}`);
  }
  if (!fs.existsSync(path.join(root, imagePath.slice(1)))) {
    throw new Error(`Missing image for ${character.name}: ${character.image}`);
  }
  // Stable URLs for unchanged bytes; no timestamps or manual version bumps.
  const hash = createHash("sha256").update(fs.readFileSync(path.join(root, imagePath.slice(1)))).digest("hex").slice(0, 16);
  const versioned = `${imagePath}?v=${hash}`;
  catalogueSource = catalogueSource.replace(`image: "${character.image}"`, `image: "${versioned}"`);
  character.image = versioned;
}

const urlFor = (character) => `${siteUrl}/character/${character.name.toLowerCase()}`;
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[char]);
const escapeHtml = (value) => escapeXml(value);

function applyCharacterPresentation(html, character, position) {
  const imageTagPattern = /<img\s+id="character-image"[\s\S]*?\/>/;
  if (!imageTagPattern.test(html)) throw new Error("Could not find the initial character image");
  html = html.replace(imageTagPattern, (tag) => tag
    .replace(/\bsrc="[^"]*"/, `src="${escapeHtml(character.image)}"`)
    .replace(/\balt="[^"]*"/, `alt="${escapeHtml(character.alt)}"`));
  html = html
    .replace(/(<h1 class="character-name">)[\s\S]*?(<\/h1>)/,
      `$1${escapeHtml(character.displayName ?? character.name)}$2`)
    .replace(/(id="catalogue-number" class="catalogue-number">)№ \d+ \/ \d+/, (_, prefix) =>
      `${prefix}№ ${String(position + 1).padStart(2, "0")} / ${String(characters.length).padStart(2, "0")}`)
    .replace(/(<button id="share-btn"[^>]*aria-label=")[^"]*(")/,
      `$1Copy link to ${escapeHtml(character.name)}$2`)
    .replace(/(<button id="copy-image-btn"[^>]*aria-label=")[^"]*(")/,
      `$1Copy image of ${escapeHtml(character.name)}$2`)
    .replace(/(<button id="review-summary"[^>]*aria-label=")[^"]*(")/,
      `$1Read and write reviews for ${escapeHtml(character.name)}$2`)
    .replace(/(<span id="review-summary-text">)[\s\S]*?(<\/span>)/,
      `$1Rate ${escapeHtml(character.name)}$2`)
    .replace(/(<h2 id="review-title">)[\s\S]*?(<\/h2>)/,
      `$1${escapeHtml(character.name)}$2`);
  return html;
}

const collection = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Webendra",
  url: `${siteUrl}/`,
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
      url: urlFor(character, index),
    })),
  },
};

const indexPath = path.join(root, "index.html");
const index = fs.readFileSync(indexPath, "utf8");
if (!/<script id="structured-data" type="application\/ld\+json">[\s\S]*?<\/script>/.test(index) ||
    !/id="catalogue-number" class="catalogue-number">№ \d+ \/ \d+/.test(index)) {
  throw new Error("Could not find metadata placeholders in index.html");
}
const data = JSON.stringify(collection, null, 2).split("\n").map((line) => `      ${line}`).join("\n");
const generatedIndex = applyCharacterPresentation(index
  .replace(/(<script id="structured-data" type="application\/ld\+json">)[\s\S]*?(\s*<\/script>)/,
    `$1\n${data}\n    </script>`), characters[0], 0);

function characterPage(character, position) {
  const slug = character.name.toLowerCase();
  const url = `${siteUrl}/character/${slug}`;
  const title = `${character.name} — Webendra`;
  const description = `${character.name} — A small collection of things with -endra at the end.`;
  const card = `${siteUrl}/assets/share/${slug}.png`;
  const cardAlt = `${character.name} on a Webendra share card`;
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: character.name,
    description,
    url,
    contentUrl: siteUrl + character.image,
    thumbnailUrl: card,
    caption: character.alt,
    author: {
      "@type": "Person",
      name: "Aalish Man Singh",
      url: "https://github.com/AalishMS",
    },
    isPartOf: { "@type": "CollectionPage", name: "Webendra", url: `${siteUrl}/` },
  }, null, 2).split("\n").map((line) => `      ${line}`).join("\n");
  const replacements = [
    [/<title>Webendra<\/title>/, `<title>${escapeHtml(title)}</title>`],
    [/content="A small collection of things with -endra at the end\."/g, `content="${escapeHtml(description)}"`],
    [/href="https:\/\/webendra\.vercel\.app\/"(?= \/>)/, `href="${url}"`],
    [/(<meta (?:property="og:title"|name="twitter:title") content=")Webendra(" \/>)/g, `$1${escapeHtml(title)}$2`],
    [/content="https:\/\/webendra\.vercel\.app\/"(?= \/>)/, `content="${url}"`],
    [/content="https:\/\/webendra\.vercel\.app\/assets\/webendra-share\.png"/g, `content="${card}"`],
    [/content="Webendra, written in wobbly black hand lettering on white"/g, `content="${escapeHtml(cardAlt)}"`],
    [/(<script id="structured-data" type="application\/ld\+json">)[\s\S]*?(\s*<\/script>)/, `$1\n${structured}\n    </script>`],
  ];
  const page = replacements.reduce((html, [pattern, value]) => html.replace(pattern, value), generatedIndex);
  return applyCharacterPresentation(page, character, position);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  "  <url>",
  `    <loc>${siteUrl}/</loc>`,
  "  </url>",
  ...characters.flatMap((character, index) => [
    "  <url>",
    `    <loc>${escapeXml(urlFor(character, index))}</loc>`,
    "    <image:image>",
    `      <image:loc>${escapeXml(siteUrl + character.image)}</image:loc>`,
    `      <image:title>${escapeXml(character.name)}</image:title>`,
    `      <image:caption>${escapeXml(character.alt)}</image:caption>`,
    "    </image:image>",
    "  </url>",
  ]),
  "</urlset>",
  "",
].join("\n");

const pages = characters.map((character, offset) => [
  path.join(root, "character", `${character.name.toLowerCase()}.html`),
  characterPage(character, offset),
]);
const characterDirectory = path.join(root, "character");
if (!check) fs.mkdirSync(characterDirectory, { recursive: true });
const vercel = {
  buildCommand: "node scripts/generate-metadata.js --skip-share-cards",
  outputDirectory: ".",
  trailingSlash: false,
  rewrites: [
    { source: "/character", destination: "/index.html" },
    ...characters.map((character) => ({
      source: `/character/${character.name.toLowerCase()}`,
      destination: `/character/${character.name.toLowerCase()}.html`,
    })),
    { source: "/character/(.*)", destination: "/index.html" },
  ],
  headers: JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")).headers,
};
const generatedVercel = JSON.stringify(vercel, null, 2) + "\n";
for (const [file, content] of [[cataloguePath, catalogueSource], [indexPath, generatedIndex], [path.join(root, "sitemap.xml"), sitemap], [path.join(root, "vercel.json"), generatedVercel], ...pages]) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const changed = normalizeNewlines(current) !== normalizeNewlines(content);
  if (check && changed) throw new Error(`${path.basename(file)} is out of date. Run node scripts/generate-metadata.js`);
  if (!check && changed) fs.writeFileSync(file, normalizeNewlines(content));
}
const expectedPages = new Set(pages.map(([file]) => file));
if (fs.existsSync(characterDirectory)) {
  for (const file of fs.readdirSync(characterDirectory).filter((name) => name.endsWith(".html"))) {
    const fullPath = path.join(characterDirectory, file);
    if (!expectedPages.has(fullPath)) {
      if (check) throw new Error(`Stale character page: ${file}`);
      fs.unlinkSync(fullPath);
    }
  }
}
if (!process.argv.includes("--skip-share-cards")) {
  // Vercel only needs URL/HTML generation; share cards are generated locally.
  const python = process.platform === "win32" ? "python" : "python3";
  const cards = spawnSync(python, [path.join(__dirname, "generate-share-cards.py"), ...(check ? ["--check"] : [])], {
    cwd: root, encoding: "utf8", input: JSON.stringify(characters),
  });
  if (cards.status !== 0) throw new Error(cards.stderr || cards.stdout || "Share card generation failed");
}
console.log(check ? "Metadata is current." : "Metadata generated.");
