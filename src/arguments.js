const MERMAID_OPTIONS = new Map([
  ["--theme", "theme"],
  ["--backgroundColor", "backgroundColor"],
  ["--configFile", "configFile"],
  ["--cssFile", "cssFile"],
  ["--puppeteerConfigFile", "puppeteerConfigFile"],
  ["--scale", "scale"],
  ["--width", "width"],
  ["--height", "height"],
]);

export function parseArguments(args) {
  const marpArgs = [];
  const mermaidOptions = {};
  let input;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const option = input ? undefined : MERMAID_OPTIONS.get(argument);

    if (option) {
      const value = args[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      mermaidOptions[option] = value;
      index += 1;
    } else if (!input && !argument.startsWith("-")) {
      input = argument;
    } else {
      marpArgs.push(argument);
    }
  }

  if (!input) {
    throw new Error(
      "Usage: marp-mermaid [Mermaid options] <input.md> [Marp options]",
    );
  }

  return { input, marpArgs, mermaidOptions };
}
