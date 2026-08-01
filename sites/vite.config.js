import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin.js";

export default defineConfig({
  publicDir: ".staging-public",
  plugins: [
    sites(),
    cloudflare({
      viteEnvironment: { name: "server" },
      config: {
        name: "server",
        main: "./worker/index.js",
        assets: {
          binding: "ASSETS",
          run_worker_first: ["/healthz", "/api/*"],
        },
      },
    }),
  ],
});
