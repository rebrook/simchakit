import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src-v3"),
    },
  },
  build: {
    outDir:      "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.v3.html"),
      output: {
        manualChunks: undefined,
      },
    },
  },
});
