import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { BRAND_INK } from "./pwa-assets.config";

export default defineConfig({
  // Relative asset URLs so the same build works at a domain root and under a GitHub Pages project path (/<repo>/).
  base: "./",
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
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      // Relative, so the worker controls /harepin/ only: WebOS and Series Tracker share the origin.
      scope: "./",
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"],
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
