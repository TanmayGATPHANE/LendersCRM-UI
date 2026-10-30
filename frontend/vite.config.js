import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite dev server + build config. Tailwind v4 runs as a Vite plugin,
// so there is no tailwind.config.js — theming lives in src/index.css.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});