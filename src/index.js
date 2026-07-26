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
    result += `${block.prefix}${block.indent}![Mermaid diagram](data:image/svg+xml;base64,${encoded})${block.lineEnding}`;
    cursor = block.end;
  }

  return result + markdown.slice(cursor);
}

function findMermaidBlocks(markdown) {
  const lines = markdown.match(/[^\r\n]*(?:\r\n|\n|$)/g).filter(Boolean);
  const offsets = [0];
  for (const line of lines) offsets.push(offsets.at(-1) + line.length);

  return markdownIt
    .parse(markdown, {})
    .filter(
      (token) =>
        token.type === "fence" &&
        token.info.trim().split(/[ \t]/, 1)[0] === "mermaid" &&
        token.map,
    )
    .map((token) => {
      const [startLine, endLine] = token.map;
      const openingLine = lines[startLine] ?? "";
      const markerIndex = openingLine.indexOf(token.markup);
      const prefix =
        markerIndex === -1 ? "" : openingLine.slice(0, markerIndex);
      const finalLine = lines[endLine - 1] ?? "";

      return {
        start: offsets[startLine],
        end: offsets[endLine] ?? markdown.length,
        prefix,
        indent: "",
        diagram: token.content,
        lineEnding: finalLine.match(/(\r\n|\n)$/)?.[1] ?? "",
      };
    });
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
