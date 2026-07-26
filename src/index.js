import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function renderMermaid(diagram, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "marp-mermaid-"));
  const input = join(directory, "diagram.mmd");
  const output = join(directory, "diagram.svg");

  try {
    await writeFile(input, diagram, "utf8");

    const args = ["-i", input, "-o", output, ...toMermaidArgs(options)];
    if (options.mermaidCommand) {
      await run(options.mermaidCommand, args);
    } else {
      await run(process.execPath, [resolveMermaidCli(), ...args]);
    }

    return await readFile(output, "utf8");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function resolveMermaidCli() {
  const entrypoint = require.resolve("@mermaid-js/mermaid-cli");
  return join(dirname(entrypoint), "cli.js");
}

export async function transformMermaidBlocks(markdown, options = {}) {
  const render = options.render ?? ((diagram) => renderMermaid(diagram, options));
  const blocks = findMermaidBlocks(markdown);

  if (blocks.length === 0) return markdown;

  let result = "";
  let cursor = 0;

  for (const block of blocks) {
    result += markdown.slice(cursor, block.start);
    const svg = await render(block.diagram.trim(), options);
    const encoded = Buffer.from(svg).toString("base64");
    result += `${block.indent}![Mermaid diagram](data:image/svg+xml;base64,${encoded})${block.lineEnding}`;
    cursor = block.end;
  }

  return result + markdown.slice(cursor);
}

function findMermaidBlocks(markdown) {
  const lines = markdown.match(/[^\r\n]*(?:\r\n|\n|$)/g).filter(Boolean);
  const blocks = [];
  let offset = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const opening = parseOpeningFence(line);

    if (!opening) {
      offset += line.length;
      continue;
    }

    const start = offset;
    const contentStart = start + line.length;
    let contentEnd = markdown.length;
    let end = markdown.length;
    let lineEnding = "";
    let closingIndex = lines.length;
    let closingOffset = contentStart;

    for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
      const candidateLine = lines[candidate];
      if (isClosingFence(candidateLine, opening.marker)) {
        contentEnd = closingOffset;
        end = closingOffset + candidateLine.length;
        lineEnding = candidateLine.match(/(\r\n|\n)$/)?.[1] ?? "";
        closingIndex = candidate;
        break;
      }
      closingOffset += candidateLine.length;
    }

    if (opening.language === "mermaid") {
      blocks.push({
        start,
        end,
        indent: opening.indent,
        diagram: markdown.slice(contentStart, contentEnd),
        lineEnding,
      });
    }

    const lastSkipped = Math.min(closingIndex, lines.length - 1);
    for (let skipped = index; skipped <= lastSkipped; skipped += 1) {
      offset += lines[skipped].length;
    }
    index = closingIndex;
  }

  return blocks;
}

function parseOpeningFence(line) {
  const match = line.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)(?:\r?\n)?$/);
  if (!match) return null;

  const [, indent, marker, rawInfo] = match;
  if (marker[0] === "`" && rawInfo.includes("`")) return null;

  const language = rawInfo.trim().split(/[ \t]/, 1)[0];
  return { indent, marker, language };
}

function isClosingFence(line, openingMarker) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*(?:\r?\n)?$/);
  return (
    match !== null &&
    match[1][0] === openingMarker[0] &&
    match[1].length >= openingMarker.length
  );
}

function toMermaidArgs(options) {
  const mapping = [
    ["theme", "--theme"],
    ["backgroundColor", "--backgroundColor"],
    ["configFile", "--configFile"],
    ["cssFile", "--cssFile"],
    ["puppeteerConfigFile", "--puppeteerConfigFile"],
    ["scale", "--scale"],
    ["width", "--width"],
    ["height", "--height"],
  ];

  return mapping.flatMap(([key, flag]) =>
    options[key] === undefined ? [] : [flag, String(options[key])],
  );
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} failed ${signal ? `with signal ${signal}` : `with exit code ${code}`}`,
          ),
        );
      }
    });
  });
}
