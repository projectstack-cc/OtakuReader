import { StartServer } from "@solidjs/start/server";
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

export default async () => {
  return <StartServer document={Document} />;
};
