import fs from 'fs';
import { pathToFileURL } from 'url';

// Set PARSE_VERBOSE=1 to log every line the parser could not classify.
const verbose = !!process.env.PARSE_VERBOSE;

const regex = {
  MARKDOWN_UNSCAPE : /\\([\\`*_{}[\]()#+\-.!])/g,
  ACT : /^# \**([^\*]*)\**\s{.*}/,
  SCENE : /^## \**([^\*]*)\**\s{.*}/,
  LINE : /\s*\*\*(.*?)\.?\*\*\s*(?:\*\(?(.*?)\)?\*\s*)?\.?\s*(.*)/,
  SETTING : /#*\s*\*(.*)\*/
}

export function parseMarkdownToJSON(mdContent) {
  const lines = mdContent.split('\n');
  const jsonResult = {
    playTitle: '',
    author: '',
    description: '',
    acts: []
  };

  function unescapeMarkdown(text) {
    return text
      .replace(regex.MARKDOWN_UNSCAPE, '$1'); // Unescape common markdown characters
  }

  let currentAct = null;
  let currentScene = null;
  let actNumber = 1;
  let sceneNumber = 1;
  let lastActor = null;

  lines.forEach(line => {
    line = unescapeMarkdown(line.trim());
    if (regex.ACT.test(line)) {
      const match = line.match(regex.ACT);
        if (currentAct) {
            if (currentScene) {
              currentAct.scenes.push(currentScene);
            }
            jsonResult.acts.push(currentAct);
            currentScene = null;
        }
        currentAct = {
            actTitle: match[1],
            actNumber: actNumber++,
            scenes: []
        };
        currentScene = null;
        lastActor = null;
    }
    else if (regex.SCENE.test(line)) {
        const match = line.match(regex.SCENE);
        if (currentScene) {
            currentAct.scenes.push(currentScene);
        }
        currentScene = {
            sceneTitle: match[1],
            sceneNumber: sceneNumber++,
            setting: null,
            lines: []
        };
        lastActor = null;
    }
    else if (currentAct && currentScene && line.length > 0) {         
        const lineMatch = line.match(regex.LINE);
        const settingMatch = line.match(regex.SETTING);
        if (lineMatch) {
            const actor = lineMatch[1];
            const setting = lineMatch[2] || null;
            const text = lineMatch[3];
            currentScene.lines.push({ actor, setting, text });
            lastActor = actor;
        } else if (settingMatch) {
            const setting = settingMatch[1];
            if(currentScene.lines.length === 0) {
                currentScene.setting = currentScene.setting ? `${currentScene.setting}\n${setting}` : setting;
            } else {
                currentScene.lines.push({ setting });
            }
        } else {
            if (currentScene.lines.length === 0) {
                currentScene.setting = currentScene.setting ? `${currentScene.setting}\n${line}` : line;
            } else {
                currentScene.lines.push({ actor : lastActor , text: line });
            }
        }
    } else if (verbose) {
        console.log(`Ignored line: ${line}`);
    }

  });

  if (currentScene) {
    currentAct.scenes.push(currentScene);
  }
  if (currentAct) {
    jsonResult.acts.push(currentAct);
  }

  return jsonResult;
}

/**
 * Read a markdown file, parse it and write the resulting JSON.
 * Throws on any I/O error so callers can decide how to react.
 */
export function parseFile(inputFilePath, outputFilePath) {
  const data = fs.readFileSync(inputFilePath, 'utf8');
  const jsonData = parseMarkdownToJSON(data);
  fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));
  return jsonData;
}

// Only run the CLI when this file is executed directly, so the parser can be
// imported by other scripts (e.g. scripts/sync-scripts.mjs) without side effects.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = process.argv.slice(2);
  const inputFilePath = args[0];
  const outputFilePath = args[1];

  if (!inputFilePath || !outputFilePath) {
    console.error('Usage: node parse_regexp.js <input.md> <output.json>');
    console.error('Set PARSE_VERBOSE=1 to log unrecognised lines.');
    process.exit(1);
  }

  console.log(`Reading from ${inputFilePath} and writing to ${outputFilePath}`);

  try {
    parseFile(inputFilePath, outputFilePath);
    console.log(`JSON data has been written to ${outputFilePath}`);
  } catch (err) {
    console.error(`Error parsing ${inputFilePath}: ${err.message}`);
    process.exit(1);
  }
}
