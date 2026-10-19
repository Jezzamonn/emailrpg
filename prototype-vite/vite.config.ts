import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [{
    name: "hbs",
    enforce: "pre",
    async load(id) {
      const file = id.split("?")[0];
      if (file.endsWith(".hbs") || (file.endsWith(".html") && !file.endsWith("index.html"))) {
        this.addWatchFile(file);
        const fs = await import("node:fs/promises");
        const code = await fs.readFile(file, "utf-8");
        return {
          code: "export default " + JSON.stringify(code) + ";",
          moduleType: "js",
        };
      }
      // Load PNGs as an ArrayBuffer of the file (like the worker's "Data" rule), not a URL.
      if (file.endsWith(".png")) {
        this.addWatchFile(file);
        const fs = await import("node:fs/promises");
        const base64 = (await fs.readFile(file)).toString("base64");
        return {
          code: `export default Uint8Array.from(atob(${JSON.stringify(base64)}), (c) => c.charCodeAt(0)).buffer;`,
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

