"""Check the metadata and cards delivered before client JavaScript runs."""

import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://webendra.vercel.app"
subprocess.run(["node", "scripts/generate-metadata.js", "--check"], cwd=ROOT, check=True)
characters = json.loads(subprocess.check_output(
    ["node", "-e", "console.log(JSON.stringify(require('./catalogue.js')))"], cwd=ROOT, text=True,
))
rewrites = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))["rewrites"]
routes = {route["source"]: route["destination"] for route in rewrites}


class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = {}
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            self.tags[attrs.get("property") or attrs.get("name")] = attrs.get("content")
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.tags["canonical"] = attrs.get("href")

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


for character in characters:
    slug = character["name"].lower()
    route = f"/character/{slug}"
    assert routes[route] == f"/character/{slug}.html"
    html = (ROOT / routes[route].lstrip("/")).read_text(encoding="utf-8")
    parser = HeadParser()
    parser.feed(html)
    expected_url = f"{SITE}{route}"
    expected_card = f"{SITE}/assets/share/{slug}.png"
    expected_title = f"{character['name']} — Webendra"
    assert parser.title == expected_title
    assert parser.tags["application-name"] == "Webendra"
    assert parser.tags["og:site_name"] == "Webendra"
    assert parser.tags["canonical"] == parser.tags["og:url"] == expected_url
    assert parser.tags["og:title"] == parser.tags["twitter:title"] == expected_title
    assert parser.tags["og:image"] == parser.tags["twitter:image"] == expected_card
    assert parser.tags["og:image:width"] == "1200"
    assert parser.tags["og:image:height"] == "630"
    assert parser.tags["description"] == parser.tags["og:description"] == parser.tags["twitter:description"]
    assert re.search(rf'<img\s+id="character-image"\s+src="{re.escape(character["image"])}"', html)
    with Image.open(ROOT / "assets" / "share" / f"{slug}.png") as card:
        assert card.format == "PNG" and card.size == (1200, 630)

home = HeadParser()
home.feed((ROOT / "index.html").read_text(encoding="utf-8"))
assert home.title == "Webendra"
assert home.tags["og:image"] == f"{SITE}/assets/webendra-share.png"
print(f"Initial metadata and share cards passed for {len(characters)} character links.")
