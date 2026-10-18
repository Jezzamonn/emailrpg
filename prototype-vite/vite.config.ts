import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [{
    name: "hbs",
    enforce: "pre",
    async load(id) {
      if (id.endsWith(".hbs") || (id.endsWith(".html") && !id.endsWith("index.html"))) {
        const fs = await import("node:fs/promises");
        const code = await fs.readFile(id, "utf-8");
        return {
          code: "export default " + JSON.stringify(code) + ";",
          moduleType: "js",
        };
      }
    }
  }],
  resolve: {
    alias: {
      "@game": fileURLToPath(new URL("../game", import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
});

