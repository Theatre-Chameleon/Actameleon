# Actameleon - AI Agent Guidelines

## Project Overview

Actameleon is a Vue.js 3 theatrical script reader/rehearsal application. It displays play scripts organized by Acts and Scenes, allowing actors to practice lines with features like actor filtering, text-to-speech, and self-testing mode.

**Tech Stack:** Vue.js 3.5, Vite 6, Tailwind CSS 3.4, JavaScript ES Modules (no TypeScript)

## Build & Development Commands

```bash
npm run dev          # Start development server (hot reload)
npm run build        # Production build (outputs to ./dist)
npm run preview      # Preview production build locally
npm run deploy       # Deploy to GitHub Pages

# Sync scripts from their source Google Docs (see "Script Sync" below)
npm run sync                     # Download + reparse every script with a sourceUrl
npm run sync:check               # Report drift without writing (exit 2 if any)
npm run sync -- --only <name>    # Restrict to one registry entry
npm run sync -- --force          # Bypass the 20% line-count shrink guard
npm run parse                    # Reparse local markdown only, no network

# Parse a single markdown file directly
npm run parse-fools | parse-festival | parse-memorialpray | parse-twisters | parse-lbg | parse-dreams | parse-comedy | parse-tristan

PARSE_VERBOSE=1 npm run parse    # Log every line the parser could not classify
```

### Testing & Linting

**No testing framework or linter configured.** When adding tests, consider Vitest. Follow existing code patterns for consistency.

The one automated check that does exist is the reparse invariant:

```bash
npm run parse && git diff --exit-code public/scripts
```

On a clean tree this must produce no diff, because every committed JSON is
reproducible from its committed markdown. Run it after touching
`parse_regexp.js`; a diff means either the parser changed behaviour or a
JSON was hand-edited. It is the cheapest regression check in the repo, so
prefer it over eyeballing changes.

## Code Style Guidelines

### JavaScript

- **Equality**: Project uses `==` for type coercion, `===` for strict comparison
- **Defaults**: Use `||` for fallbacks: `value || defaultValue`

### Vue Components

- **Composition API (`<script setup>`)**: Preferred for new components
- **Options API**: Used in display components (ScriptDisplay, ActDisplay, SceneDisplay, LineDisplay) with template-first layout

### Imports Order

1. Vue core (`vue`)
2. Components (`.vue` files)
3. Assets (JSON, images)
4. Services

### CSS & Styling

- **Tailwind first**: Use utility classes in templates
- **Custom classes**: Define in `src/style.css` using `@apply`
- **Scoped styles**: Use `<style scoped>` in components
- **Dark mode**: Use `prefers-color-scheme` media queries

## Project Structure

```
src/
├── main.js           # App entry point
├── App.vue           # Root component (script selection, config)
├── style.css         # Global styles + Tailwind
├── assets/           # scripts.json (script registry)
├── components/       # Vue components
│   ├── ActDisplay, SceneDisplay, LineDisplay, ScriptDisplay  # Script rendering
│   ├── FilterSheet, ActiveFilters, SceneNav                  # Filter UI
│   ├── ScriptSelector                                        # Script picker
│   └── ui/           # Reusable UI primitives (BottomSheet, FullScreenModal, etc.)
└── services/         # text2voice.js (Web Speech API wrapper), actorColor.js
scripts/              # sync-scripts.mjs, gen-actor-palette.mjs (Node only)
public/scripts/       # Play script data (JSON + source MD)
```

### Script Registry

`src/assets/scripts.json` is the single source of truth for which scripts
exist. Each entry:

| Field | Required | Purpose |
| --- | --- | --- |
| `name` | yes | Stable id; also the localStorage config key suffix |
| `title` | yes | Label shown in the UI |
| `url` | yes | Path to the parsed JSON, fetched at runtime |
| `md` | yes | Path to the source markdown |
| `sourceUrl` | no | Link to the upstream Google Doc |
| `language` | no | BCP 47 tag for text-to-speech (default `ru`) |
| `ttsFallback` | no | Ordered BCP 47 tags to try when no voice matches `language` |

Paths are relative to `public/`. `sourceUrl` is what enables both the sync
job and the source link in the script selector, so an entry without one is
simply left alone by automation.

### Text-to-Speech Language

`language` and `ttsFallback` live in the registry rather than in the script
JSON, because the sync job regenerates the JSON from the Google Doc and
would drop them. `App.vue` merges them onto the reactive script object when
it loads, and `text2voice.js` reads them from there.

Installed voices differ per device, so `text2voice.js` resolves a concrete
voice instead of only setting `utterance.lang`. It tries, in order: an exact
match on `language`, then a match on the bare subtag (`be-BY` matches a
`be` voice), then the same two steps for each `ttsFallback` entry. If
nothing matches it sets `utterance.lang` and lets the browser decide.

This matters because a missing voice is not a graceful failure: browsers
fall back to their own default, which is usually the UI language, and
Cyrillic read by an English voice is unusable. Declaring a realistic
fallback keeps the closest available voice. Resolution happens lazily on
the first line of playback, since `speechSynthesis.getVoices()` is commonly
empty until the list loads asynchronously.

Scripts without a `language` fall back to `ru`, so only add it where the
script is not Russian.

### Script Sync

`scripts/sync-scripts.mjs` downloads each script from its Google Doc,
reparses it and writes both the markdown and the JSON.

- The export URL is derived from `sourceUrl`. The `tab` query parameter is
  carried over, otherwise a multi-tab document gains a stray `# Tab 1`
  heading and every downstream diff is noise.
- The document must be shared as "anyone with the link can view"; the job
  makes unauthenticated requests.
- Downloads are rejected unless they are HTTP 200, have a markdown content
  type, are not HTML and clear a minimum size, so a sign-in page cannot
  overwrite a script. After parsing, a drop of more than 20% in dialogue
  lines aborts the sync unless `--force` is passed.
- `.github/workflows/sync-scripts.yml` runs this daily and on demand, then
  opens one pull request per changed script. Nothing is merged
  automatically.

Because the job overwrites `public/scripts/*.md`, the Google Doc is the
source of truth: fix formatting in the document, never in the committed
markdown, or the next sync will revert it.

To onboard a script, add its `sourceUrl` to the registry. No other change
is needed.

### Actor Colour Coding

Off by default, toggled by `config.colorActors`. When on, every character's
name is drawn in its own colour in the script body, the actor filter list
and the active filter pills.

Each scene heading carries a row of pills naming the characters who speak in
it and how many lines each has *in that scene*, busiest first. It uses the
same ordering rule as the actor filter list, which is why the comparator and
the tally live in `actorColor.js` rather than being written out a third time.
The row sits inside the scene header element on purpose: row striping keys
off `.scene > :nth-child(even)`, so adding a direct child would flip the
stripes of every line in the scene. The pills show whether or not colour
coding is on; without it they use the default text colour.

Colours come from cast rank, not from the name. Roles are ordered by how
many lines they speak and rank picks the palette entry, so the characters
on stage most often get the most clearly different colours and
near-duplicates only ever reach walk-on parts. The ranking tiebreak is the
name compared by code unit, not `localeCompare`, which would make colours
depend on the device; ties are common, and in the largest script most of
the cast shares a line count with somebody. `FilterSheet` must sort the
actor list the same way or the swatches stop matching the colours.

An earlier version hashed the name so colours survived a cast change. It
scattered a small cast across the whole palette, which let a twelve-role
play draw two neighbouring desaturated teals for its two leads. Rank trades
that stability away on purpose: colours may shuffle when a script is
edited, and anything the user has pinned survives because overrides are
stored against the name.

Users can override a colour per role from the swatch in the actor filter
list. Overrides live in `config.actorHueOverrides` as `name -> index into
HUE_CHOICES`, keyed by name so they survive the re-ranking that follows a
script edit. Two roles are allowed to share a colour this way.

The picker offers `HUE_CHOICES`, a separate hue-ordered ramp, rather than
the palette. Showing the palette was a mistake: it is ordered so that every
prefix is well spread, which leaves its later entries existing only to fill
gaps, and 33 of the 48 had a near twin once laid out as a grid. Sorted by
hue, neighbours are meant to resemble each other and the set reads as a
spectrum. Lightness there is chosen per hue, because the best lightness
runs from about 0.45 for violet to 0.57 for red and holding it constant
drives yellows and greens to zero chroma, turning them grey.

The palette is generated, not hand-picked:

```bash
node scripts/gen-actor-palette.mjs        # print the table
```

The output must match the `PALETTE` constant in `actorColor.js`. Regenerate
and paste if the generator changes. It solves four things at once: WCAG AA
on every background the app uses in both themes, colours that read as
different colours, separability under red-green colour vision deficiency,
and a sequence whose every prefix is the best palette of that size, which
is what makes rank-based assignment work.

Two details in the generator are worth keeping. It maximises *chromatic*
distance, measured in the a-b plane, rather than total OKLab distance: a
pair can otherwise "pass" on a lightness difference alone, which is exactly
the bug the hashed version shipped with. And it solves slightly above the
real thresholds, because the emitted values are rounded to three decimals
and that is enough to drop a colour below AA.

A coloured line also carries an edge in the character's colour and a 6% wash
of the same colour, 7% with a heavier edge for a selected actor in highlight
mode. Highlight drops its yellow while colour coding is on, because once
colour carries identity a second colour for "mine" only competes with it.
Row striping and the hairline dividers are suppressed for the same reason,
via `scene-colored`, so a character's wash is the same on every row.

This is the tightest contrast in the app: the name sits on a tint of itself
and shares its hue with it. The generator solves for that case explicitly,
at the stronger of the two washes, which is why `usableChroma` checks the
colour against a tint of itself and not only against plain backgrounds.
Hidden lines stay inline markers and take the colour on the asterisk, so a
run of them shows who speaks in what order without giving the words away.

Components receive a single `actorColors` prop, `{ [actor]: { light, dark,
index } }` or `null` when the feature is off, drilled the same way as
`hideToCheck`. Each element carries both variants as custom properties and
`style.css` picks one per `prefers-color-scheme`, so nothing has to read
the theme from JavaScript.


### State Management

- **No Vuex/Pinia**: State managed via props and reactive objects
- **Local Storage**: Persists config per script (`config.${scriptName}`)
- **Reactive Objects**: Use `reactive()` for complex state, `ref()` for primitives

## Deployment

- **CI/CD**: GitHub Actions deploys to GitHub Pages on push to `main`
- **Node version**: 22 (see `.github/workflows/deploy.yml`)
- **Custom domain**: Configured via `CNAME` file
- **Script sync**: `.github/workflows/sync-scripts.yml` needs "Allow GitHub
  Actions to create and approve pull requests" enabled under
  Settings → Actions → General

## Workflow Rules

* Recommend to commit and push changes at session end

## Important Notes

1. **No tests exist** - Be careful with refactoring; manually verify changes
2. **No linter** - Follow existing code patterns for consistency
3. **Script data is generated - never hand-edit it**: the JSON files in
   `public/scripts/` are produced from the markdown by `parse_regexp.js`.
   Edit the markdown (or the Google Doc, if the script has a `sourceUrl`)
   and reparse. Editing a JSON directly makes it unreproducible and it will
   be silently overwritten by the next parse or sync.
4. **Multilingual**: the language used for text-to-speech comes from the
   registry, not from the script JSON. See "Text-to-Speech Language" below.
5. **No play content in docs** - Don't include play-specific information (titles, quotes, character names) in documentation; scripts are runtime data

## Known Issues

Longstanding defects, recorded so they are not rediscovered as surprises.
None are urgent; each needs a decision rather than just a patch.

* **The script heading is always blank.** `ScriptDisplay.vue` renders
  `script.title`, but the parsed JSON has no `title` - it has `playTitle`,
  which the parser hardcodes to an empty string. Both halves are wrong, so
  fixing it means choosing a source: parse a title out of the markdown, or
  use the registry `title` the selector already shows.
* **`playTitle`, `author` and `description` are dead fields.** The parser
  emits them on every script and never fills them in. Either populate them
  from the markdown front matter or drop them from the format.
* **Two actor display-name rules.** `FilterSheet.vue` and
  `ActiveFilters.vue` each independently map a missing actor to
  "Stage Directions". Colour coding hashes the raw name instead, so the
  three surfaces agree, but the duplicated label logic remains.
* **Scene numbers are global, not per act.** The parser counts scenes
  across the whole play, so the second act does not restart at 1. Config
  stored in localStorage keys off these numbers, so renumbering would
  invalidate saved scene selections.
