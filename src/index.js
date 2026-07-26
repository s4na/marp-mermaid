import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const MERMAID_FENCE =
  /(^|\n)([ \t]*)(`{3,}|~{3,})[ \t]*mermaid[^\n]*\n([\s\S]*?)\n\2\3(?=\n|$)/g;
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
  const matches = [...markdown.matchAll(MERMAID_FENCE)];

  if (matches.length === 0) return markdown;

  let result = "";
  let cursor = 0;

  for (const match of matches) {
    result += markdown.slice(cursor, match.index);
    const svg = await render(match[4].trim(), options);
    const encoded = Buffer.from(svg).toString("base64");
    result += `${match[1]}${match[2]}![Mermaid diagram](data:image/svg+xml;base64,${encoded})`;
    cursor = match.index + match[0].length;
  }

  return result + markdown.slice(cursor);
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
