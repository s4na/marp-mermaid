import { resolve } from "node:path";

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

const PATH_OPTIONS = new Set([
  "--output",
  "-o",
  "--config-file",
  "--config",
  "-c",
  "--theme-set",
  "--browser-path",
]);

export function normalizeMarpArgs(args, cwd = process.cwd()) {
  const normalized = [...args];

  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    const [flag, inlineValue] = argument.split("=", 2);

    if (PATH_OPTIONS.has(flag) && inlineValue !== undefined) {
      normalized[index] = `${flag}=${resolve(cwd, inlineValue)}`;
      continue;
    }

    if (flag === "--theme" && inlineValue !== undefined) {
      normalized[index] = `${flag}=${resolveTheme(inlineValue, cwd)}`;
      continue;
    }

    if (
      index < normalized.length - 1 &&
      (PATH_OPTIONS.has(argument) || argument === "--theme")
    ) {
      normalized[index + 1] =
        argument === "--theme"
          ? resolveTheme(normalized[index + 1], cwd)
          : resolve(cwd, normalized[index + 1]);
      index += 1;
    }
  }

  return normalized;
}

function resolveTheme(value, cwd) {
  return /[/\\]|\.css$/i.test(value) ? resolve(cwd, value) : value;
}
