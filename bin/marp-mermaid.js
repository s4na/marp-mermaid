#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { transformMermaidBlocks } from "../src/index.js";
import { normalizeMarpArgs, parseArguments } from "../src/arguments.js";

const require = createRequire(import.meta.url);
const { input, marpArgs, mermaidOptions } = parseArguments(process.argv.slice(2));

if (marpArgs.some((argument) => argument === "--engine" || argument.startsWith("--engine="))) {
  throw new Error("Custom Marp engines are not supported by marp-mermaid");
}

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

function run(command, args, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") reject(error);
    });
    child.stdin.end(input);
  });
}
