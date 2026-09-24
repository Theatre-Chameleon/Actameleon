/**
 * Split a cue line so its last few spoken words can be emphasised.
 *
 * In rehearsal the cue is the end of the previous speech: those are the words
 * an actor listens for before coming in. On a short line that is the whole
 * line, so only longer ones are split.
 *
 * Stage directions in brackets are not what anyone listens for, so a
 * direction at the very end is skipped, and the emphasised run never reaches
 * back across one in the middle. For "...віцязі!” *(Рагоча).*" the emphasis
 * lands on the words before "(Рагоча)", not on the direction.
 *
 * Returns { lead, tail, after } whose concatenation is the original text, or
 * null when the line is too short to be worth splitting.
 */

// Fewer spoken words than this and the whole line already is the cue.
const MIN_WORDS = 9;

// How many trailing words to emphasise.
const TAIL_WORDS = 4;

// A bracketed or starred direction at the end of the text, with the stray
// punctuation that tends to surround it: " *(Рагоча).*", " (Сыходзіць.)".
const DIRECTION_AT_END = /\s*(?:\*?\([^()]*\)[.,!?…]*\*?[.,!?…]*|\*[^*]+\*[.,!?…]*)\s*$/;

// Directions anywhere in the text, for counting spoken words only.
const ANY_DIRECTION = /\([^()]*\)|\*[^*]*\*/g;

export function splitCueTail(text) {
  if (!text) return null;

  let end = text.length;
  for (;;) {
    const match = text.slice(0, end).match(DIRECTION_AT_END);
    if (!match || match[0].length === 0) break;
    end = match.index;
  }

  const spoken = text.slice(0, end);
  const wordCount = spoken.replace(ANY_DIRECTION, ' ').trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_WORDS) return null;

  // Start after the last direction, so the run never spans one.
  const boundary = Math.max(spoken.lastIndexOf(')'), spoken.lastIndexOf('*')) + 1;
  const run = spoken.slice(boundary);

  const starts = [];
  for (const word of run.matchAll(/\S+/g)) starts.push(word.index);
  if (starts.length === 0) return null;

  const start = boundary + starts[Math.max(0, starts.length - TAIL_WORDS)];
  return { lead: text.slice(0, start), tail: text.slice(start, end), after: text.slice(end) };
}
