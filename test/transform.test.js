import assert from "node:assert/strict";
import test from "node:test";
import { transformMermaidBlocks } from "../src/index.js";

const renderer = { render: async () => "<svg />" };

test("replaces Mermaid fences with embedded SVG images", async () => {
  const source = "# Slide\n\n```mermaid\nflowchart LR\n  A --> B\n```\n";
  const result = await transformMermaidBlocks(source, renderer);
  assert.match(result, /!\[Mermaid diagram\]\(data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(result, /```mermaid/);
});

test("supports multiple blocks, tilde fences, CRLF, and longer closing fences", async () => {
  const diagrams = [];
  const source = "~~~mermaid\r\ngraph TD\r\n A --> B\r\n~~~~\r\n\r\n```mermaid\r\nsequenceDiagram\r\n A->>B: Hi\r\n```\r\n";
  const result = await transformMermaidBlocks(source, {
    render: async (diagram) => { diagrams.push(diagram); return "<svg />"; },
  });
  assert.equal(diagrams.length, 2);
  assert.equal(result.match(/data:image\/svg\+xml;base64/g)?.length, 2);
  assert.match(result, /\r\n$/);
});

test("leaves non-Mermaid blocks and nested examples unchanged", async () => {
  for (const source of [
    "```js\nconsole.log('hello');\n```",
    "```mermaids\nnot a diagram\n```",
    "````markdown\n```mermaid\ngraph LR\n A --> B\n```\n````",
  ]) assert.equal(await transformMermaidBlocks(source), source);
});

test("does not transform Mermaid-looking content in Marp front matter", async () => {
  const source = "---\ndescription: |\n  ```mermaid\n  graph LR\n    A --> B\n  ```\n---\n\n# Slide\n";
  assert.equal(await transformMermaidBlocks(source, renderer), source);
});

test("preserves a boundary after a Mermaid fence in a container", async () => {
  for (const source of [
    "> ```mermaid\n> graph LR\n>   A --> B\n> ```\nOutside",
    "- ```mermaid\n  graph LR\n    A --> B\n  ```\nOutside",
  ]) {
    const result = await transformMermaidBlocks(source, renderer);
    assert.match(result, /data:image\/svg\+xml;base64,[^)]+\)\n\nOutside$/);
  }
});

test("removes opening-fence indentation and container markers from diagrams", async () => {
  const diagrams = [];
  await transformMermaidBlocks("  ```mermaid\n  graph LR\n    A --> B\n  ```", {
    render: async (diagram) => { diagrams.push(diagram); return "<svg />"; },
  });
  assert.deepEqual(diagrams, ["graph LR\n  A --> B"]);
});
