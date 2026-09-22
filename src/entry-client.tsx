import { hydrate } from "solid-js/web";
import { StartClient } from "@solidjs/start/client";
import "~/app.css";
import "./lib/stores/migrate";

hydrate(() => <StartClient />, document.getElementById("app")!);
