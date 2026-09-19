const fs = require("node:fs");
const path = require("node:path");
const characters = require("../catalogue.js");

const root = path.resolve(__dirname, "..");
const siteUrl = "https://webendra.vercel.app";
const check = process.argv.includes("--check");

if (!characters.length) throw new Error("The catalogue is empty");
const seen = new Set();
for (const character of characters) {
  const slug = character.name.toLowerCase();
  if (!/^[a-z]+$/.test(slug) || seen.has(slug)) {
    throw new Error(`Invalid or duplicate character name: ${character.name}`);
  }
  seen.add(slug);
  if (!character.alt || !/^\/assets\/[a-z0-9-]+\.png$/.test(character.image)) {
    throw new Error(`Invalid image or alt text for ${character.name}`);
  }
  if (!fs.existsSync(path.join(root, character.image.slice(1)))) {
    throw new Error(`Missing image for ${character.name}: ${character.image}`);
  }
}

const urlFor = (character, index) => index === 0
  ? `${siteUrl}/`
  : `${siteUrl}/character/${character.name.toLowerCase()}`;
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[char]);

const collection = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Webendra",
  url: `${siteUrl}/`,
  description: "A small collection of things with -endra at the end.",
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
const generatedIndex = index
  .replace(/(<script id="structured-data" type="application\/ld\+json">)[\s\S]*?(\s*<\/script>)/,
    `$1\n${data}\n    </script>`)
  .replace(/(id="catalogue-number" class="catalogue-number">)№ \d+ \/ \d+/, (_, prefix) =>
    `${prefix}№ 01 / ${String(characters.length).padStart(2, "0")}`);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
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

for (const [file, content] of [[indexPath, generatedIndex], [path.join(root, "sitemap.xml"), sitemap]]) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (check && current !== content) throw new Error(`${path.basename(file)} is out of date. Run node scripts/generate-metadata.js`);
  if (!check && current !== content) fs.writeFileSync(file, content);
}
console.log(check ? "Metadata is current." : "Metadata generated.");
