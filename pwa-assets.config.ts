import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Manifest and icon backgrounds need a static hex, so this is the logo's ink (WebOS and Series Tracker use it too).
export const BRAND_INK = "#17252C";

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: BRAND_INK } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: BRAND_INK } },
  },
  images: ["public/logo.svg"],
});
