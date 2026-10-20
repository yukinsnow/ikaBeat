import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const config = JSON.parse(
  readFileSync(new URL("./src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { host: "0.0.0.0", port: 1420, strictPort: true },
  preview: { headers: { "Content-Security-Policy": config.app.security.csp } },
  build: { target: "es2022" },
});
