import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/caveat/500.css";
import "@/app/globals.css";
import { createRoot } from "react-dom/client";
import { initStore } from "@/lib/local/store-core";
import { App } from "./App";

const root = createRoot(document.getElementById("root")!);
void initStore().then(() => root.render(<App />));
