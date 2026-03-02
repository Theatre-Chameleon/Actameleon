---
description: Create theatrical subtitles from a play script for OpenLP projection
---

Create English (or other language) subtitles from a theatrical play script, formatted for OpenLP custom slides with `[--}{--]` separators. Designed for live subtitle projection during performances.

## Arguments

Parse `$ARGUMENTS` to extract:

| Pattern | Meaning |
|---------|---------|
| First positional arg | Path to play script file (`.md`, `.json`, `.txt`). Supports `@path` syntax |
| Second positional arg | Target language (e.g., `english`, `french`, `german`) |
| `--sample <file-or-text>` | Reference subtitle sample to calibrate tone/style |
| `--style <description>` | Text description of desired translation style |
| `--output <path>` | Custom output path (default: `<source>_subtitles.txt` in same directory) |
| `--format openlp` | Subtitle format (default and currently only: `openlp`) |

If either the play path or target language is missing, ask the user interactively.

## Examples

```bash
# Full specification
/subtitles public/scripts/play.md english --sample reference_subs.txt

# Minimal - will prompt for style interactively
/subtitles public/scripts/play.md english

# With inline style description
/subtitles public/scripts/play.md french --style "Modern accessible French, not overly literary"
```

## Phase 1: Input Discovery & Validation

1. **Read the play script** from the provided path
   - Support `.md` (markdown script), `.json` (parsed script data), `.txt` (plain text)
   - If file is large, read in sections to understand structure
2. **Detect source language** from the script content automatically
3. **Determine output path**: default is `<scriptname>_subtitles.txt` alongside the source file
4. **Parse structure**: identify Acts, Scenes, characters, total line count
   - For `.json` files: parse the `acts[].scenes[].lines[]` structure
   - For `.md` files: parse headings, bold character names, and dialogue patterns

## Phase 2: Style Calibration

If `--sample` or `--style` was NOT provided, ask the user interactively:

Use the `question` tool to ask ALL of the following at once:

### Questions to ask:

1. **Translation style** — Options:
   - "Classic literary" (formal, slightly archaic, matching classic published translations)
   - "Modern accessible" (clear modern language, easy to read as fast subtitles)
   - "Mix: literary but readable" (theatrical and elegant but not overly archaic)
   - Custom (let user describe)

2. **Character name display** — Options:
   - "No names, dashes only" (e.g., `- Hold my robe.` with `- ` for dialogue turns)
   - "Include character names" (e.g., `- Jourdain: Hold my robe.`)
   - "Names for non-obvious lines" (include names only when speaker is unclear)

3. **Content inclusion** — Options:
   - "Dialogue only" (skip songs and stage directions)
   - "Dialogue + songs" (translate dialogue and lyrics, skip stage directions)
   - "Everything" (dialogue, songs, and key stage directions as separate slides)

4. **Act/Scene navigation headers** — Options:
   - "Yes, include headers" (add `ACT ONE` / `Scene 1` markers as slides)
   - "No headers" (just dialogue text)

5. **Provide a sample?** — Options:
   - "No sample needed, proceed with defaults"
   - "I'll paste a sample" (then wait for user to provide reference subtitle text)

If user provides a sample (via `--sample` flag or interactively), analyze it to extract:
- Tone (formal/casual/theatrical)
- Line length patterns
- How dialogue turns are marked
- Whether character names appear
- Maximum lines per slide

### Format rules (always apply):

- Slide separator: `[--}{--]`
- Max 3-4 short lines per slide
- Max 2 speakers per slide screen
- Split long speeches into multiple slides at meaningful pause points
- Song lyrics marked with musical note symbol
- No stage directions in output (unless user chose "Everything")

## Phase 3: Planning & Task Breakdown

1. **Create a todo list** with one item per act, plus review and assembly items
2. **Determine output file path** and create it with an initial header comment or empty content
3. **Log the translation parameters** (source language, target language, style, format rules) — these will be passed to each subagent

## Phase 4: Translation via Subagents

For each act in the play:

1. **Dispatch a `general` subagent** (use the Task tool) with a comprehensive prompt containing:
   - The full text of that act (all scenes)
   - The format rules from Phase 2
   - The style guide / sample analysis
   - The target language
   - Instruction: return ONLY the subtitle text, starting with `[--}{--]`, with act/scene headers as slides
   - Instruction: no explanatory text outside the subtitles

2. **CRITICAL: Write results to file immediately** after each subagent returns
   - For the first act: write (overwrite) to the output file
   - For subsequent acts: append to the output file
   - This prevents data loss if context window fills up or session is interrupted

3. **Mark the todo item as completed** after successful file write

4. **Parallelization**: If the play has 4+ acts, dispatch up to 4 subagents in parallel. For smaller plays, sequential is fine. Balance parallelism against context window — each subagent result consumes context.

### Subagent prompt template

Each subagent should receive a prompt structured like this:

```
You are creating {TARGET_LANGUAGE} subtitles for a theatrical performance.
The play is performed in {SOURCE_LANGUAGE}.

## FORMAT RULES
- Slide separator: [--}{--]
- {CHARACTER_NAME_RULE}
- Max 3-4 short lines per slide
- Max 2 speakers per slide screen
- Split long speeches at meaningful points
- {SONG_RULE}
- {STAGE_DIRECTION_RULE}
- Include Scene headers as navigation slides

## TRANSLATION STYLE
{STYLE_DESCRIPTION}

## TONE REFERENCE
{SAMPLE_TEXT_OR_ANALYSIS}

## TEXT TO TRANSLATE: {ACT_TITLE}
{ACT_FULL_TEXT}

## OUTPUT
Return ONLY subtitle text. Start with [--}{--]. Every slide separated by [--}{--].
No explanatory text. No markdown code blocks.
```

## Phase 5: Review & Report

After all acts are written to file:

1. **Read the complete output file** and report statistics:
   - Total number of slides (count `[--}{--]` occurrences)
   - Number of acts and scenes
   - Total lines of text
   - Output file path

2. **Spot-check quality**: Read a few slides from different acts to verify:
   - Consistent style across acts (different subagents may drift)
   - No broken slide separators
   - No stray explanatory text from subagents
   - Act/scene headers are present and sequential

3. **Report to user** with file path and stats

4. **Ask if user wants to commit** the new subtitles file

## Edge Cases

- **Very long acts**: If a single act has 100+ dialogue lines, split it into scene groups when sending to subagents
- **Non-dialogue content**: Songs/verses should be marked with a musical note symbol in the output
- **Adapted plays**: When the source script differs significantly from the original (e.g., adapted scenes), always translate from the source script, not from published translations — the subtitles must match what actors actually say on stage
- **Multiple languages in source**: Some plays mix languages (e.g., Latin phrases in a Russian play). Preserve these as-is or transliterate based on context
- **Intermissions**: If the source script has intermission markers, include an `INTERMISSION` slide between the relevant acts

## OpenLP Import Notes

The output file can be imported into OpenLP as Custom Slides:
- Each `[--}{--]` separator defines a new slide
- The operator clicks through slides during the live performance
- Keep slide text concise — it must be readable from a distance on a projection screen
