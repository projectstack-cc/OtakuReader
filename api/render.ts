// The SSR request handler is created in src/entry-server.tsx (see the
// comment there for why) and built by `vite build` into
// dist/server/entry-server.js. This file just re-exports it so Vercel's
// zero-config file routing picks up a Function here.

// @ts-ignore - dist is generated during build (npm run build / vite build)
import serverEntry from "../dist/server/entry-server.js";

export default serverEntry.fetch;

export const config = {
  runtime: "nodejs",
};
