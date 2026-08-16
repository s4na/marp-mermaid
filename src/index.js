import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import MarkdownIt from "markdown-it";

const require = createRequire(import.meta.url);
const markdownIt = new MarkdownIt();

export async function renderMermaid(diagram, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "marp-mermaid-"));
  const input = join(directory, "diagram.mmd");
  const output = join(directory, "diagram.svg");

  try {
    await writeFile(input, diagram, "utf8");
    const args = ["-i", input, "-o", output, ...toMermaidArgs(options)];
    if (options.mermaidCommand) await run(options.mermaidCommand, args);
    else await run(process.execPath, [resolveMermaidCli(), ...args]);
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
    const preceding = markdown.slice(cursor, block.start);
    result += preceding;
    const svg = await render(block.diagram.trim(), options);
    const encoded = Buffer.from(svg).toString("base64");
    const leadingBoundary = paragraphBoundaryBefore(block, preceding);
    const boundary = containerBoundary(block, markdown.slice(block.end));
    result += `${leadingBoundary}${block.prefix}![Mermaid diagram](data:image/svg+xml;base64,${encoded})${block.lineEnding}${boundary}`;
    cursor = block.end;
  }
  return result + markdown.slice(cursor);
}

function findMermaidBlocks(markdown) {
  const lines = markdown.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g).filter(Boolean);
  const offsets = [0];
  for (const line of lines) offsets.push(offsets.at(-1) + line.length);
  const frontMatterEnd = findFrontMatterEnd(lines, offsets);

  return markdownIt
    .parse(markdown, {})
    .filter(
      (token) =>
        token.type === "fence" &&
        token.info.trim().split(/[ \t]/, 1)[0] === "mermaid" &&
        token.map &&
        offsets[token.map[0]] >= frontMatterEnd,
    )
    .map((token) => {
      const [startLine, endLine] = token.map;
      const openingLine = lines[startLine] ?? "";
      const markerIndex = openingLine.indexOf(token.markup);
      const prefix = markerIndex === -1 ? "" : openingLine.slice(0, markerIndex);
      const finalLine = lines[endLine - 1] ?? "";
      return {
        start: offsets[startLine],
        end: offsets[endLine] ?? markdown.length,
        prefix,
        diagram: token.content,
        lineEnding: finalLine.match(/(\r\n|\r|\n)$/)?.[1] ?? "",
      };
    });
}

function findFrontMatterEnd(lines, offsets) {
  if (!/^\ufeff?---[\t ]*(?:\r\n|\r|\n|$)$/.test(lines[0] ?? "")) return 0;
  for (let index = 1; index < lines.length; index += 1) {
    if (/^(?:---|\.\.\.)[\t ]*(?:\r\n|\r|\n|$)$/.test(lines[index])) {
      return offsets[index + 1];
    }
  }
  return 0;
}

function containerBoundary(block, remainder) {
  if (!block.lineEnding || !remainder || /^[\t ]*(?:\r\n|\r|\n)/.test(remainder)) return "";
  if (!/\S/.test(block.prefix)) return block.lineEnding;
  if (block.prefix.includes(">") && /^[\t ]*>/.test(remainder)) {
    const quotePrefix = remainder.match(/^(?:[\t ]*>[\t ]?)+/)?.[0] ?? ">";
    return `${quotePrefix.trimEnd()}${block.lineEnding}`;
  }
  if (/^(?:[\t ]*)(?:[-+*]|\d+[.)])[\t ]/.test(remainder)) return "";
  return block.lineEnding;
}

function paragraphBoundaryBefore(block, preceding) {
  if (!preceding) return "";
  const lineEnding = preceding.match(/(\r\n|\r|\n)$/)?.[1];
  if (!lineEnding) return "";
  if (/(?:\r\n|\r|\n)[\t ]*(?:\r\n|\r|\n)$/.test(preceding)) return "";
  if (block.prefix.includes(">")) {
    const quotePrefix = block.prefix.match(/(?:^|[-+*]\s|\d+[.)]\s)((?:[\t ]*>[\t ]?)+)/)?.[1] ?? ">";
    return `${quotePrefix.trimEnd()}${lineEnding}`;
  }
  return /\S/.test(block.prefix) ? "" : lineEnding;
}

function toMermaidArgs(options) {
  const mapping = [
    ["theme", "--theme"], ["backgroundColor", "--backgroundColor"],
    ["configFile", "--configFile"], ["cssFile", "--cssFile"],
    ["puppeteerConfigFile", "--puppeteerConfigFile"], ["scale", "--scale"],
    ["width", "--width"], ["height", "--height"],
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
      if (code === 0) resolve();
      else reject(new Error(`${command} failed ${signal ? `with signal ${signal}` : `with exit code ${code}`}`));
    });
  });
}
