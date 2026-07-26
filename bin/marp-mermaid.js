#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { transformMermaidBlocks } from "../src/index.js";
import { parseArguments } from "../src/arguments.js";

const require = createRequire(import.meta.url);

const { input, marpArgs, mermaidOptions } = parseArguments(process.argv.slice(2));
const inputPath = resolve(input);
const source = await readFile(inputPath, "utf8");
const transformed = await transformMermaidBlocks(source, mermaidOptions);
process.exitCode = await run(
  process.execPath,
  [
    resolveMarpCli(),
    ...normalizeMarpArgs(marpArgs),
    "--engine",
    fileURLToPath(new URL("../src/engine.js", import.meta.url)),
  ],
  transformed,
  dirname(inputPath),
);

function resolveMarpCli() {
  const packagePath = require.resolve("@marp-team/marp-cli/package.json");
  return join(dirname(packagePath), "marp-cli.js");
}

function normalizeMarpArgs(args) {
  const normalized = [...args];
  for (let index = 0; index < normalized.length - 1; index += 1) {
    if (normalized[index] === "--output" || normalized[index] === "-o") {
      normalized[index + 1] = resolve(normalized[index + 1]);
      index += 1;
    }
  }
  return normalized;
}

function run(command, args, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
    child.stdin.end(input);
  });
}
