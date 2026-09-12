import { StartServer, createHandler } from "@solidjs/start/server";
import { toWebHandler } from "h3";
import { toNodeHandler } from "h3/node";
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
// means `vite dev`/`vite preview` work unmodified.
//
// `node` is a *separate* export for api/render.ts: Vercel's Node.js
// runtime (config.runtime = "nodejs") invokes functions with the classic
// (req, res) Node signature, not a Web-standard (Request) => Response
// signature — there's no automatic conversion for "nodejs" runtime the
// way there is for "edge". Re-exporting `.fetch` directly there made
// h3 receive a raw Node IncomingMessage as if it were a Web Request:
// its `.url` is just the path ("/"), not absolute, so h3's internal
// `new URL(event.request.url)` threw ERR_INVALID_URL, and because a
// Fetch-style handler never calls `res.end()` itself, the Node response
// was left hanging until Vercel's function-timeout fired (504
// FUNCTION_INVOCATION_TIMEOUT, not the 500 the thrown error implied).
// `toNodeHandler` from h3/node builds the absolute URL correctly from
// the raw request's headers and writes the Response back onto `res`.
const app = createHandler(render, { mode: "stream" });
export default { fetch: toWebHandler(app), node: toNodeHandler(app) };
