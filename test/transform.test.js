import assert from "node:assert/strict";
import test from "node:test";
import { transformMermaidBlocks } from "../src/index.js";

test("replaces Mermaid fences with embedded SVG images", async () => {
  const source = `# Slide

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
`;

  const result = await transformMermaidBlocks(source, {
    render: async () => "<svg>diagram</svg>",
  });

  const encoded = Buffer.from("<svg>diagram</svg>").toString("base64");
  assert.equal(
    result,
    `# Slide

![Mermaid diagram](data:image/svg+xml;base64,${encoded})
`,
  );
});

test("supports multiple blocks and tilde fences", async () => {
  const diagrams = [];
  const source = `~~~mermaid
graph TD
  A --> B
~~~

\`\`\`mermaid
sequenceDiagram
  A->>B: Hello
\`\`\``;

  const result = await transformMermaidBlocks(source, {
    render: async (diagram) => {
      diagrams.push(diagram);
      return `<svg>${diagrams.length}</svg>`;
    },
  });

  assert.deepEqual(diagrams, [
    "graph TD\n  A --> B",
    "sequenceDiagram\n  A->>B: Hello",
  ]);
  assert.equal(result.match(/data:image\/svg\+xml;base64/g)?.length, 2);
});

test("leaves non-Mermaid code blocks unchanged", async () => {
  const source = "```js\nconsole.log('hello');\n```";
  assert.equal(await transformMermaidBlocks(source), source);
});

test("preserves indentation around an indented fence", async () => {
  const source = "  ```mermaid\n  graph LR\n    A --> B\n  ```";
  const result = await transformMermaidBlocks(source, {
    render: async () => "<svg />",
  });

  assert.match(result, /^  !\[Mermaid diagram\]/);
});

test("does not transform Mermaid examples inside an outer fence", async () => {
  const source = `\`\`\`\`markdown
\`\`\`mermaid
graph LR
  A --> B
\`\`\`
\`\`\`\``;

  assert.equal(await transformMermaidBlocks(source), source);
});

test("accepts a closing fence longer than its opening fence", async () => {
  const source = "```mermaid\ngraph LR\n  A --> B\n````";
  const result = await transformMermaidBlocks(source, {
    render: async () => "<svg />",
  });

  assert.match(result, /^!\[Mermaid diagram\]/);
});

test("transforms Mermaid blocks in CRLF documents", async () => {
  const source = "```mermaid\r\ngraph LR\r\n  A --> B\r\n```\r\n";
  const result = await transformMermaidBlocks(source, {
    render: async () => "<svg />",
  });

  assert.match(result, /^!\[Mermaid diagram\].*\r\n$/);
});

test("requires Mermaid to be a complete info-string token", async () => {
  for (const language of ["mermaids", "mermaid-example"]) {
    const source = `\`\`\`${language}\nnot a diagram\n\`\`\``;
    assert.equal(await transformMermaidBlocks(source), source);
  }
});

test("transforms Mermaid fences inside block quotes", async () => {
  const source = "> ```mermaid\n> graph LR\n>   A --> B\n> ```";
  const diagrams = [];
  const result = await transformMermaidBlocks(source, {
    render: async (diagram) => {
      diagrams.push(diagram);
      return "<svg />";
    },
  });

  assert.deepEqual(diagrams, ["graph LR\n  A --> B"]);
  assert.match(result, /^> !\[Mermaid diagram\]/);
});

test("removes opening-fence indentation from every content line", async () => {
  const source = "  ```mermaid\n  ---\n  title: Example\n  ---\n  graph LR\n    A --> B\n  ```";
  const diagrams = [];
  await transformMermaidBlocks(source, {
    render: async (diagram) => {
      diagrams.push(diagram);
      return "<svg />";
    },
  });

  assert.deepEqual(diagrams, [
    "---\ntitle: Example\n---\ngraph LR\n  A --> B",
  ]);
});

test("stops an unclosed quoted fence when the block quote ends", async () => {
  const source = "> ```mermaid\n> graph LR\n>   A --> B\n\nOutside";
  const diagrams = [];
  const result = await transformMermaidBlocks(source, {
    render: async (diagram) => {
      diagrams.push(diagram);
      return "<svg />";
    },
  });

  assert.deepEqual(diagrams, ["graph LR\n  A --> B"]);
  assert.match(result, /\nOutside$/);
});

test("transforms Mermaid fences following list markers", async () => {
  for (const marker of ["-", "1."]) {
    const source = `${marker} \`\`\`mermaid\n   graph LR\n     A --> B\n   \`\`\``;
    const result = await transformMermaidBlocks(source, {
      render: async () => "<svg />",
    });

    assert.match(result, new RegExp(`^${marker.replace(".", "\\.")} !\\[`));
  }
});
