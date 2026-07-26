#!/usr/bin/env node

import { readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { transformMermaidBlocks } from "../src/index.js";
import { parseArguments } from "../src/arguments.js";

const require = createRequire(import.meta.url);

const { input, marpArgs, mermaidOptions } = parseArguments(process.argv.slice(2));
const source = await readFile(input, "utf8");
const transformed = await transformMermaidBlocks(source, mermaidOptions);
const temporary = join(
  dirname(input),
  `${basename(input)}.marp-mermaid-${randomUUID()}.md`,
);

try {
  await writeFile(temporary, transformed, "utf8");
  process.exitCode = await run(process.execPath, [
    resolveMarpCli(),
    temporary,
    "--no-stdin",
    ...marpArgs,
  ]);
} finally {
  await rm(temporary, { force: true });
}

function resolveMarpCli() {
  const packagePath = require.resolve("@marp-team/marp-cli/package.json");
  return join(dirname(packagePath), "marp-cli.js");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
