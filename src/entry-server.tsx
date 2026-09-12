import { StartServer, createHandler } from "@solidjs/start/server";
import { toWebHandler } from "h3";
import type { Component } from "solid-js";

const Document: Component<{ assets?: import("solid-js").JSX.Element; scripts: import("solid-js").JSX.Element; children?: import("solid-js").JSX.Element }> = (props) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>OtakuReader</title>
      {props.assets}
    </head>
    <body>
      <div id="app">{props.children}</div>
      {props.scripts}
    </body>
  </html>
);

const render = () => {
  return <StartServer document={Document} />;
};

// Platform adapter entry point: @solidjs/start@2.0.5 is the Vite-native
// version with no built-in Nitro/vinxi deployment presets, so this file
// (the "server" Vite environment's build input, per @solidjs/start/config)
// is the correct place to wire up a fetch-compatible request handler.
// createHandler must run through this file specifically because its
// dependency chain (@solidjs/start/server -> handler.js) imports the
// "solid-start:middleware" virtual module, which only resolves inside
// @solidjs/start's own Vite plugin pipeline (see
// node_modules/@solidjs/start/dist/config/manifest.js). Calling
// createHandler from a plain Node file outside that pipeline (e.g. a
// hand-written api/*.ts Vercel Function importing this package directly)
// throws ERR_UNSUPPORTED_ESM_URL_SCHEME.
//
// The `default export = { fetch }` shape below (rather than a bare
// function) is not a stylistic choice: it's the exact contract
// @solidjs/start's own dev server and `vite preview` server expect from
// this file (see `serverEntry.default.fetch(...)` in
// node_modules/@solidjs/start/dist/config/dev-server.js). Matching it
// means `vite dev`/`vite preview` work unmodified, and our Vercel
// Function (api/render.ts) can just re-export dist/server/entry-server.js's
// default.fetch too.
const app = createHandler(render, { mode: "stream" });
export default { fetch: toWebHandler(app) };
