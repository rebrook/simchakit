import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// base: "/simcha/" tells Vite to prefix all asset paths with /simcha/.
//
// Express already serves everything under simchakit/public/ at /simcha/
// (see server.js: app.use("/simcha", express.static(..., "simchakit", "public"))).
//
// Folder layout on the NAS:
//   simchakit/public/assets/                    → served at /simcha/assets/  (shared)
//   simchakit/public/sydney-mitzvah-2026/index.html
//   simchakit/public/new-event-2027/index.html  ← adding a new event is just this one copy
//
// All events share the same assets/ folder. No config change ever needed per event.

export default defineConfig({
  plugins: [react()],
  base: "/simcha/",
  resolve: {
    alias: {
      // @ resolves to src/ — use in imports as @/constants/events, @/utils/dates, etc.
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir:      "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    // Local dev: proxy API and WebSocket calls to the running Express server.
    proxy: {
      "/simcha/api":       { target: "http://localhost:3000", changeOrigin: true },
      "/simcha/changelog": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
