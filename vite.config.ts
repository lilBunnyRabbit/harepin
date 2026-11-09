import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { BRAND_INK } from "./pwa-assets.config";
import { CHANGELOG } from "./src/changelog";
import type { RemoteVersion, VersionInfo } from "./src/version";

// version.json carries the newest releases so a tab several versions behind still lists what it skipped.
const NOTES_KEPT = 10;

function git_commit(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch (error) {
    console.warn("version: no git commit, building as unknown", error);
    return "unknown";
  }
}

const VERSION: VersionInfo = {
  version: JSON.parse(readFileSync("package.json", "utf8")).version,
  commit: git_commit(),
  built: Date.now(),
};

// The bundle and version.json carry one stamp, so a tab can tell its own build from the deployed one.
function version_file(): Plugin {
  let out_dir = "dist";
  return {
    name: "harepin-version",
    apply: "build",
    configResolved(config) {
      out_dir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file: RemoteVersion = { ...VERSION, notes: CHANGELOG.slice(0, NOTES_KEPT) };
      writeFileSync(resolve(out_dir, "version.json"), JSON.stringify(file, null, 2));
    },
  };
}

export default defineConfig({
  // Relative asset URLs so the same build works at a domain root and under a GitHub Pages project path (/<repo>/).
  base: "./",
  define: { __HAREPIN_VERSION__: JSON.stringify(VERSION) },
  resolve: { dedupe: ["three"] },
  optimizeDeps: {
    include: [
      "three",
      "three/examples/jsm/postprocessing/EffectComposer.js",
      "three/examples/jsm/postprocessing/OutputPass.js",
      "three/examples/jsm/postprocessing/RenderPass.js",
      "three/examples/jsm/postprocessing/UnrealBloomPass.js",
    ],
  },
  plugins: [
    version_file(),
    VitePWA({
      // prompt: a new build waits until the player picks Update now (src/update.ts), so nothing reloads mid-race.
      registerType: "prompt",
      injectRegister: false,
      // Relative, so the worker controls /harepin/ only: WebOS and Series Tracker share the origin.
      scope: "./",
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico,webp}"],
      },
      manifest: {
        id: "harepin",
        name: "Harepin",
        short_name: "Harepin",
        description: "Low-poly open-world driving in the browser.",
        start_url: "./",
        scope: "./",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
        orientation: "landscape",
        theme_color: BRAND_INK,
        background_color: BRAND_INK,
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
});
