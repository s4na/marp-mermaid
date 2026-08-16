import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMarpArgs, parseArguments } from "../src/arguments.js";

test("passes shared option names after the input to Marp", () => {
  assert.deepEqual(parseArguments(["--theme", "dark", "slides.md", "--theme", "custom.css"]), {
    input: "slides.md",
    mermaidOptions: { theme: "dark" },
    marpArgs: ["--theme", "custom.css"],
  });
});

test("requires an input file", () => {
  assert.throws(() => parseArguments(["--theme", "dark"]), /Usage:/);
});

test("accepts attached Mermaid option values before the input", () => {
  assert.deepEqual(parseArguments(["--theme=dark", "--configFile=mermaid=a.json", "slides.md"]), {
    input: "slides.md",
    mermaidOptions: { theme: "dark", configFile: "mermaid=a.json" },
    marpArgs: [],
  });
});

test("resolves file-valued Marp options against the caller directory", () => {
  assert.deepEqual(
    normalizeMarpArgs([
      "--output", "build/slides.html", "--theme", "themes/custom.css",
      "--theme", "gaia", "--config=marp.config.js", "--output=build/deck=v2.html",
    ], "/project"),
    [
      "--output", "/project/build/slides.html", "--theme", "/project/themes/custom.css",
      "--theme", "gaia", "--config=/project/marp.config.js", "--output=/project/build/deck=v2.html",
    ],
  );
});

test("resolves every variadic theme-set path", () => {
  assert.deepEqual(
    normalizeMarpArgs(["--theme-set", "themes/a.css", "themes/b.css", "--pdf"], "/project"),
    ["--theme-set", "/project/themes/a.css", "/project/themes/b.css", "--pdf"],
  );
});
