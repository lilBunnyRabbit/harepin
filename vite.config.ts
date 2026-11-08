import { defineConfig } from "vite";

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
  build: { chunkSizeWarningLimit: 1200 },
});
