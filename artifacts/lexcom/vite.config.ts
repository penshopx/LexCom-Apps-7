import { gzipSync } from "node:zlib";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

const offlineFallback = {
  urlPattern: ({ request }: { request: Request }) =>
    request.mode === "navigate",
  handler: "NetworkFirst" as const,
  options: {
    cacheName: "lexcom-pages",
    networkTimeoutSeconds: 5,
    precacheFallback: {
      fallbackURL: `${basePath}offline.html`,
    },
  },
};

const initialJavaScriptGzipBudget = 85 * 1024;

function enforceInitialJavaScriptBudget(): Plugin {
  return {
    name: "lexcom-initial-javascript-budget",
    generateBundle(_options, bundle) {
      const pendingFiles = Object.values(bundle)
        .filter((output) => output.type === "chunk" && output.isEntry)
        .map((chunk) => chunk.fileName);
      const visitedFiles = new Set<string>();
      let rawBytes = 0;
      let gzipBytes = 0;

      while (pendingFiles.length > 0) {
        const fileName = pendingFiles.pop();

        if (!fileName || visitedFiles.has(fileName)) {
          continue;
        }

        visitedFiles.add(fileName);
        const output = bundle[fileName];

        if (!output || output.type !== "chunk") {
          continue;
        }

        rawBytes += Buffer.byteLength(output.code);
        gzipBytes += gzipSync(output.code).byteLength;
        pendingFiles.push(...output.imports);
      }

      const rawKilobytes = (rawBytes / 1024).toFixed(1);
      const gzipKilobytes = (gzipBytes / 1024).toFixed(1);
      const budgetKilobytes = (initialJavaScriptGzipBudget / 1024).toFixed(0);

      this.info(
        `Initial JavaScript: ${rawKilobytes} KiB raw, ${gzipKilobytes} KiB gzip (budget ${budgetKilobytes} KiB gzip).`,
      );

      if (gzipBytes > initialJavaScriptGzipBudget) {
        this.error(
          `Initial JavaScript is ${gzipKilobytes} KiB gzip, exceeding the ${budgetKilobytes} KiB budget.`,
        );
      }
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    enforceInitialJavaScriptBudget(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "LexCom - Agentic AI untuk Hukum Indonesia",
        short_name: "LexCom",
        description: "Legal AI Operating System Indonesia untuk riset, telaah, drafting, perkara, dan pemeriksaan sumber.",
        lang: "id",
        theme_color: "#7c3aed",
        background_color: "#0f1117",
        display: "standalone",
        orientation: "portrait",
        scope: basePath,
        start_url: basePath,
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff,woff2}"],
        navigateFallback: undefined,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          offlineFallback,
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
