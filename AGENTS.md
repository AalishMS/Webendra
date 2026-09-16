# Webendra Agent Guide

## The premise

Webendra is a gallery of ordinary things given unnecessarily dignified names by
adding `-endra`. A person holding a basketball is Ballendra. This is the whole joke. Treat it with the seriousness it does not
deserve.

## The humor

- Keep the delivery dry and confident. Never explain why a name is funny in the
  interface.
- Prefer familiar, visually obvious subjects. The picture should make the name
  click immediately.
- Names should be short, pronounceable, and end in `-endra`. Mild phonetic
  cheating is not only allowed; it is part of the craft.
- Present mundane objects like distinguished guests. A rock deserves celebrity
  lighting. A spoon has waited its whole life for this moment.
- Mix people, animals, food, and objects so the gallery stays pleasantly
  unpredictable.
- Avoid elaborate lore, punchlines, memes, captions, and winking commentary.
  The name beneath the image is enough.
- When suggesting additions, lead with the funniest strong ideas rather than a
  giant list of weak ones.

Good examples include Belendra, and
Shailendra. A weak idea is one whose subject cannot be recognized instantly or
whose name becomes a paragraph wearing a fake moustache.

## Visual rules

- Keep the page white, the text black, and the image-name pair unmistakably the
  main event.
- Preserve the centered square image, name below it, and arrows on either side.
- Do not add a header, navigation bar, card shell, gradient, decorative copy, or
  other furniture unless the user explicitly requests it.
- Every image must be a true PNG with a transparent background so the subject
  blends seamlessly into the white page. No solid, colored, or gradient
  backgrounds behind the subject — it should float directly on white.
- Use clean, realistic imagery with one obvious subject and no embedded text,
  logos, borders, or watermarks.
- Make controls responsive, keyboard-accessible, and respectful of reduced
  motion.
- If an image contains a weapon, keep the scene non-threatening: no firing,
  ammunition, aggression, or pointing toward the viewer.

## Idea registry

Before proposing or implementing a new character, read `Ideas.md` completely.
Never suggest a name or visually equivalent concept already recorded there.
When suggesting ideas, add every name-and-image combination to the "Previously
stated / not currently implemented" table in `Ideas.md` before presenting it to
the user. Record every suggestion whether it is accepted, rejected, ignored, or
never implemented. Do not present any idea that was not saved to the registry.
Rejected and unused ideas remain permanently reserved and must not be deleted or
suggested again. When a character is implemented, move its existing row to the
implemented table and add its asset path.

## Adding a new Endra

1. Choose a clear subject and a name that lands without explanation.
2. Generate or source a square, transparent-background PNG consistent with the
   existing studio style.
3. Inspect the final image before adding it to the project.
4. Save it in `assets/` using the lowercase character name, such as
   `assets/mugendra.png`.
5. Add the name, image path, and useful alt text to `characters` in `app.js`.
6. Test button navigation, keyboard navigation, image loading, and wraparound at
   desktop and mobile sizes.
7. Commit meaningful batches periodically and push the completed work.

## Working voice

Be concise, helpful, and lightly deadpan when reporting progress. Small lines
like “the rock is ready for its close-up” fit. A five-paragraph comedy routine
does not. The website owns the joke; the agent merely keeps a straight face.
