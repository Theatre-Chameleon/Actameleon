#!/usr/bin/env node
/**
 * Sync play scripts from their source Google Docs.
 *
 * For every entry in src/assets/scripts.json that declares a "sourceUrl",
 * this downloads the document as Markdown, reparses it to JSON and writes
 * both files back into public/scripts/.
 *
 * Usage:
 *   node scripts/sync-scripts.mjs                 download + parse everything
 *   node scripts/sync-scripts.mjs --only comedy   restrict to one script
 *   node scripts/sync-scripts.mjs --check         report drift, write nothing
 *   node scripts/sync-scripts.mjs --no-fetch      reparse local markdown only
 *   node scripts/sync-scripts.mjs --force         skip the shrink guard
 *
 * Exit codes:
 *   0  success (with --check: no drift)
 *   1  a document was unreachable, invalid, or failed a sanity check
 *   2  --check found drift
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { parseMarkdownToJSON } from '../parse_regexp.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(repoRoot, 'src/assets/scripts.json');
const publicDir = path.join(repoRoot, 'public');

// A well-formed export should comfortably exceed this. Anything smaller is
// almost certainly an error page or an empty document.
const MIN_BYTES = 1000;
// Reject a sync that removes more than this share of the dialogue lines.
const MAX_SHRINK = 0.2;

const EXIT_FAILURE = 1;
const EXIT_DRIFT = 2;

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = { only: null, check: false, fetch: true, force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') opts.check = true;
    else if (arg === '--no-fetch') opts.fetch = false;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--only') opts.only = argv[++i];
    else if (arg.startsWith('--only=')) opts.only = arg.slice('--only='.length);
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(EXIT_FAILURE);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage: node scripts/sync-scripts.mjs [options]

  --only <name>   Sync a single script by its registry name
  --check         Report drift without writing files (exit 2 if drift)
  --no-fetch      Reparse the local markdown instead of downloading
  --force         Bypass the ${Math.round(MAX_SHRINK * 100)}% line-count shrink guard
  -h, --help      Show this message`);
}

// ---------------------------------------------------------------- utilities

/**
 * Turn a Google Docs share/edit link into its Markdown export URL.
 *
 * The tab query parameter matters: a multi-tab document exported without it
 * gets an extra "# Tab 1" heading prepended, so it must be carried over.
 */
export function toExportUrl(sourceUrl) {
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`sourceUrl is not a valid URL: ${sourceUrl}`);
  }

  if (!/(^|\.)google\.com$/.test(parsed.hostname)) {
    throw new Error(`sourceUrl is not a Google Docs link: ${sourceUrl}`);
  }

  const id = parsed.pathname.match(/\/document\/d\/([^/]+)/);
  if (!id) {
    throw new Error(`Could not find a document id in: ${sourceUrl}`);
  }

  const exportUrl = new URL(`https://docs.google.com/document/d/${id[1]}/export`);
  exportUrl.searchParams.set('format', 'md');

  const tab = parsed.searchParams.get('tab');
  if (tab) exportUrl.searchParams.set('tab', tab);

  return exportUrl.toString();
}

async function downloadMarkdown(sourceUrl) {
  const exportUrl = toExportUrl(sourceUrl);
  const response = await fetch(exportUrl, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} from ${exportUrl}. ` +
      'The document may have been deleted, or is no longer shared with "anyone with the link".'
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (!/^text\/(x-markdown|markdown|plain)/.test(contentType)) {
    throw new Error(
      `Expected markdown but got "${contentType}" from ${exportUrl}. ` +
      'This usually means Google returned a sign-in or error page.'
    );
  }

  const body = await response.text();

  if (/^\s*<(!doctype|html)/i.test(body)) {
    throw new Error(`Response from ${exportUrl} looks like HTML, not markdown.`);
  }
  if (Buffer.byteLength(body, 'utf8') < MIN_BYTES) {
    throw new Error(
      `Response from ${exportUrl} is only ${Buffer.byteLength(body, 'utf8')} bytes ` +
      `(minimum ${MIN_BYTES}). Refusing to overwrite a script with a near-empty file.`
    );
  }

  return body;
}

/** Collect the counts we use for sanity checks and PR summaries. */
export function statsFor(parsed) {
  const actors = new Set();
  let scenes = 0;
  let lines = 0;

  for (const act of parsed.acts || []) {
    for (const scene of act.scenes || []) {
      scenes++;
      for (const line of scene.lines || []) {
        lines++;
        if (line.actor) actors.add(line.actor);
      }
    }
  }

  return { acts: (parsed.acts || []).length, scenes, lines, actors };
}

function assertUsable(stats, name) {
  if (stats.acts === 0) throw new Error(`Parsed "${name}" contains no acts.`);
  if (stats.scenes === 0) throw new Error(`Parsed "${name}" contains no scenes.`);
  if (stats.lines === 0) throw new Error(`Parsed "${name}" contains no dialogue lines.`);
}

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sorted(set) {
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------- reporting

function describeChange(before, after) {
  const lines = [
    `| metric | before | after |`,
    `| --- | --- | --- |`,
    `| acts | ${before ? before.acts : '—'} | ${after.acts} |`,
    `| scenes | ${before ? before.scenes : '—'} | ${after.scenes} |`,
    `| lines | ${before ? before.lines : '—'} | ${after.lines} |`,
    `| actors | ${before ? before.actors.size : '—'} | ${after.actors.size} |`
  ];

  if (before) {
    const added = sorted(after.actors).filter(a => !before.actors.has(a));
    const removed = sorted(before.actors).filter(a => !after.actors.has(a));
    if (added.length) lines.push('', `**Actors added:** ${added.join(', ')}`);
    if (removed.length) lines.push('', `**Actors removed:** ${removed.join(', ')}`);
  }

  return lines.join('\n');
}

function summaryLine(before, after) {
  if (!before) return `new script: ${after.acts} acts, ${after.scenes} scenes, ${after.lines} lines`;
  const bits = [];
  if (before.acts !== after.acts) bits.push(`acts ${before.acts}→${after.acts}`);
  if (before.scenes !== after.scenes) bits.push(`scenes ${before.scenes}→${after.scenes}`);
  if (before.lines !== after.lines) bits.push(`lines ${before.lines}→${after.lines}`);
  if (before.actors.size !== after.actors.size) {
    bits.push(`actors ${before.actors.size}→${after.actors.size}`);
  }
  return bits.length ? bits.join(', ') : 'text changes only';
}

// ---------------------------------------------------------------- main flow

async function syncEntry(entry, opts) {
  const mdPath = path.join(publicDir, entry.md);
  const jsonPath = path.join(publicDir, entry.url);

  const previousMd = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : null;
  const previousJsonRaw = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, 'utf8') : null;
  const previousParsed = readJsonIfPresent(jsonPath);
  const before = previousParsed ? statsFor(previousParsed) : null;

  let markdown;
  if (opts.fetch) {
    markdown = await downloadMarkdown(entry.sourceUrl);
  } else {
    if (previousMd === null) throw new Error(`No local markdown at ${entry.md}`);
    markdown = previousMd;
  }

  const parsed = parseMarkdownToJSON(markdown);
  const after = statsFor(parsed);
  assertUsable(after, entry.name);

  if (before && before.lines > 0 && !opts.force) {
    const shrink = (before.lines - after.lines) / before.lines;
    if (shrink > MAX_SHRINK) {
      throw new Error(
        `Line count fell from ${before.lines} to ${after.lines} ` +
        `(-${Math.round(shrink * 100)}%, limit ${Math.round(MAX_SHRINK * 100)}%). ` +
        'This looks like a broken export rather than an edit. Rerun with --force to accept.'
      );
    }
  }

  const nextJsonRaw = JSON.stringify(parsed, null, 2);
  const mdChanged = previousMd !== markdown;
  const jsonChanged = previousJsonRaw !== nextJsonRaw;

  if (!mdChanged && !jsonChanged) {
    return { entry, changed: false };
  }

  if (!opts.check) {
    fs.writeFileSync(mdPath, markdown);
    fs.writeFileSync(jsonPath, nextJsonRaw);
  }

  return {
    entry,
    changed: true,
    mdChanged,
    jsonChanged,
    summary: summaryLine(before, after),
    body: describeChange(before, after)
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

  if (opts.only && !registry.some(e => e.name === opts.only)) {
    console.error(`No script named "${opts.only}" in src/assets/scripts.json.`);
    console.error(`Known names: ${registry.map(e => e.name).join(', ')}`);
    process.exit(EXIT_FAILURE);
  }

  let candidates = registry.filter(e => e.md && (opts.fetch ? e.sourceUrl : true));
  if (opts.only) candidates = candidates.filter(e => e.name === opts.only);

  if (candidates.length === 0) {
    console.log(
      opts.fetch
        ? 'No scripts with a sourceUrl to sync. Add one to src/assets/scripts.json.'
        : 'No scripts to parse.'
    );
    return;
  }

  const changed = [];
  const failed = [];

  for (const entry of candidates) {
    process.stdout.write(`${entry.name}: `);
    try {
      const result = await syncEntry(entry, opts);
      if (result.changed) {
        console.log(`changed (${result.summary})`);
        changed.push(result);
      } else {
        console.log('up to date');
      }
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      failed.push({ entry, error: err });
    }
  }

  writeGithubOutputs(changed);
  writeStepSummary(changed, failed);

  if (failed.length) {
    console.error(
      `\n${failed.length} script(s) failed to sync: ${failed.map(f => f.entry.name).join(', ')}`
    );
    process.exit(EXIT_FAILURE);
  }

  if (changed.length === 0) {
    console.log('\nAll scripts are up to date.');
    return;
  }

  if (opts.check) {
    console.error(`\n${changed.length} script(s) are out of date (--check made no changes).`);
    process.exit(EXIT_DRIFT);
  }

  console.log(`\nUpdated ${changed.length} script(s).`);
}

// ------------------------------------------------------- GitHub Actions glue

function writeGithubOutputs(changed) {
  if (!process.env.GITHUB_OUTPUT) return;

  const payload = changed.map(c => ({
    name: c.entry.name,
    title: c.entry.title,
    md: c.entry.md,
    json: c.entry.url,
    sourceUrl: c.entry.sourceUrl || '',
    summary: c.summary,
    body: c.body
  }));

  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `changed=${JSON.stringify(payload)}\n` +
    `changed_count=${payload.length}\n` +
    `changed_names=${payload.map(p => p.name).join(' ')}\n`
  );
}

function writeStepSummary(changed, failed) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;

  const out = ['## Script sync', ''];
  if (!changed.length && !failed.length) out.push('All scripts are up to date.');
  for (const c of changed) out.push(`- **${c.entry.title}** (\`${c.entry.name}\`): ${c.summary}`);
  for (const f of failed) out.push(`- **${f.entry.title}** (\`${f.entry.name}\`): FAILED — ${f.error.message}`);

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n');
}

// Only run when executed directly, so helpers stay importable and testable.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch(err => {
    console.error(`\nSync aborted: ${err.stack || err.message}`);
    process.exit(EXIT_FAILURE);
  });
}
