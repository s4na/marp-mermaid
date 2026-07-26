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
