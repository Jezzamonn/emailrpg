import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
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

