// The SSR request handler is created in src/entry-server.tsx (see the
// comment there for why) and built by `vite build` into
// dist/server/entry-server.js. This file just re-exports it so Vercel's
// zero-config file routing picks up a Function here.
//
// Uses the `.node` export specifically: Vercel's Node.js runtime calls
// this with the classic (req, res) signature, and `.node` (built via
// h3/node's toNodeHandler) is the adapter that expects exactly that —
// see the comment in entry-server.tsx for why `.fetch` broke this.

// @ts-ignore - dist is generated during build (npm run build / vite build)
import serverEntry from "../dist/server/entry-server.js";

export default serverEntry.node;

export const config = {
  runtime: "nodejs",
};
