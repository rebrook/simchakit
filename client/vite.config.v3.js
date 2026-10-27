import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { buildChangelog } from "./scripts/build-changelog.mjs";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Release notes: builds public/whats-new/*.json from changelog/entries.json and fails the build on a
// rule break. Runs when the config loads so the files exist before Vite copies public/.
const whatsNew = buildChangelog();
console.log(`[whats-new] ${whatsNew.hostCount} host entries, latest ${whatsNew.index.latestRelease}`);

// Guide content check: fails the build on a section with no topics, a missing summary, a dead related link, etc.
execFileSync(process.execPath, [path.resolve(__dirname, "scripts/check-guide.mjs")], { stdio: "inherit" });

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
