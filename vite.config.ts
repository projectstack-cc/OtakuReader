import { defineConfig } from "vite";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    solidStart({ ssr: true }),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/*.png"],
      manifest: false,
      devOptions: {
        enabled: true,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mangadex\.org\/at-home\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "mangadex-at-home",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.mangadex\.org\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "mangadex-api",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60,
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/graphql\.anilist\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "anilist-api",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5,
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.jikan\.mo\/v4\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "jikan-api",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 10,
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
});
