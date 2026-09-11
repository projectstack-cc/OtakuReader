import { hydrate } from "solid-js/web";
import { StartClient } from "@solidjs/start/client";
import "~/app.css";

hydrate(() => <StartClient />, document.getElementById("app")!);
