import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

test("builds Marp HTML containing an embedded Mermaid SVG", { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "marp-mermaid-integration-"));
  const input = join(directory, "slides.md");
  const output = join(directory, "slides.html");
  const puppeteerConfig = join(directory, "puppeteer.json");

  try {
    await writeFile(
      puppeteerConfig,
      JSON.stringify({ args: ["--no-sandbox"] }),
      "utf8",
    );
    await writeFile(
      input,
      `---
marp: true
---

\`\`\`mermaid
flowchart LR
  A[Prompt] --> B[AI Agent]
\`\`\`
`,
      "utf8",
    );

    const code = await run(process.execPath, [
      join(process.cwd(), "bin/marp-mermaid.js"),
      "--puppeteerConfigFile",
      puppeteerConfig,
      input,
      "--output",
      output,
    ]);
    assert.equal(code, 0);

    const html = await readFile(output, "utf8");
    assert.match(html, /data:image\/svg\+xml;base64/);
    assert.doesNotMatch(html, /```mermaid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
