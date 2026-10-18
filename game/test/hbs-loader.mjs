import fs from "node:fs";

export async function load(url, context, nextLoad) {
  if (url.endsWith(".hbs") || url.endsWith(".html")) {
    const content = fs.readFileSync(new URL(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(content)};`,
    };
  }
  if (url.endsWith(".png")) {
    const base64 = fs.readFileSync(new URL(url)).toString("base64");
    return {
      format: "module",
      shortCircuit: true,
      source: `export default Uint8Array.from(atob(${JSON.stringify(base64)}), (c) => c.charCodeAt(0)).buffer;`,
    };
  }
  return nextLoad(url, context);
}
