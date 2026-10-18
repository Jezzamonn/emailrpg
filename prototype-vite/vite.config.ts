import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [{
    name: "hbs",
    transform(code, id) {
      if (id.endsWith(".hbs")) {
        return { code: "export default " + JSON.stringify(code) + ";", map: null };
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

