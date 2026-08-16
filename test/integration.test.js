import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

test("builds HTML, PDF, and PPTX with a Mermaid diagram", { timeout: 180_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "marp-mermaid-integration-"));
  const input = join(directory, "slides.md");
  const puppeteerConfig = join(directory, "puppeteer.json");
  try {
    await writeFile(puppeteerConfig, JSON.stringify({ args: ["--no-sandbox"] }), "utf8");
    await writeFile(input, "---\nmarp: true\n---\n\n```mermaid\nflowchart LR\n A --> B\n```\n", "utf8");

    for (const extension of ["html", "pdf", "pptx"]) {
      const output = join(directory, `slides.${extension}`);
      const code = await run(process.execPath, [
        join(process.cwd(), "bin/marp-mermaid.js"),
        "--puppeteerConfigFile", puppeteerConfig,
        input, "--output", output,
      ]);
      assert.equal(code, 0, `${extension} conversion failed`);
      assert.ok((await stat(output)).size > 0, `${extension} output is empty`);
      const content = await readFile(output);
      if (extension === "html") {
        assert.match(content.toString(), /<img src="data:image\/svg\+xml;base64,/);
      } else if (extension === "pdf") assert.equal(content.subarray(0, 5).toString(), "%PDF-");
      else assert.equal(content.subarray(0, 2).toString(), "PK");
    }
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
