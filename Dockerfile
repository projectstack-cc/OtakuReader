# --- build stage: full install (Vite and friends are devDependencies), build, then prune ---
FROM node:22-alpine AS build

# sqlite3 is a native module; build tools are only needed here if no prebuilt binary matches.
RUN apk add --no-cache python3 make g++

WORKDIR /app
# .npmrc carries legacy-peer-deps (vite-plugin-pwa's peer range stops below Vite 8);
# without it `npm ci` fails with ERESOLVE.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# --- runtime stage: production node_modules + build output only ---
FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/app/data

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json server.mjs ./

# The library (SQLite db + downloaded pages) lives here. Mount a volume at this path.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
