import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { aiHandler } from "./server/http";
export default defineConfig({
  base: process.env.DEPLOY_BASE_PATH || "/",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "moodnomad-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!(await aiHandler(req, res))) next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/") &&
            /\/(react|react-dom|scheduler)\//.test(id)
          )
            return "react-vendor";
        },
      },
    },
  },
  server: { host: "0.0.0.0", port: 5173 },
});
