import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments } from "../src/arguments.js";

test("passes shared option names after the input to Marp", () => {
  assert.deepEqual(
    parseArguments(["--theme", "dark", "slides.md", "--theme", "custom.css"]),
    {
      input: "slides.md",
      mermaidOptions: { theme: "dark" },
      marpArgs: ["--theme", "custom.css"],
    },
  );
});

test("requires an input file", () => {
  assert.throws(() => parseArguments(["--theme", "dark"]), /Usage:/);
});
