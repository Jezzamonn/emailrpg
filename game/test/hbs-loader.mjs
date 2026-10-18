import fs from "node:fs";

export async function load(url, context, nextLoad) {
  if (url.endsWith(".hbs")) {
    const content = fs.readFileSync(new URL(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(content)};`,
    };
  }
  return nextLoad(url, context);
}
