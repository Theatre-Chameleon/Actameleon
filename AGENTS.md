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
npm run parse                    # Reparse local markdown only, no network

# Parse a single markdown file directly
npm run parse-fools | parse-festival | parse-memorialpray | parse-twisters | parse-lbg | parse-dreams | parse-comedy | parse-tristan
```

### Testing & Linting

**No testing framework or linter configured.** When adding tests, consider Vitest. Follow existing code patterns for consistency.

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
└── services/         # text2voice.js (Web Speech API wrapper)
scripts/              # sync-scripts.mjs (Google Docs sync, Node only)
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

Paths are relative to `public/`. `sourceUrl` is what enables both the sync
job and the source link in the script selector, so an entry without one is
simply left alone by automation.

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
3. **Script data**: JSON files in `public/scripts/` generated from markdown via `parse_regexp.js`
4. **Multilingual**: Scripts support multiple languages via `script.language` property (default: 'ru')
5. **No play content in docs** - Don't include play-specific information (titles, quotes, character names) in documentation; scripts are runtime data
