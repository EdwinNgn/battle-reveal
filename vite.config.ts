import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works on GitHub Pages project sites,
  // Netlify, Vercel, or any static host / subdirectory.
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
  },
  server: {
    host: true,
    port: 5173,
  },
});
