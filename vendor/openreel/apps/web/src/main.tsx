import "./reelfinisher/network";
import "./reelfinisher/captions";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./index.css";
import "./reelfinisher/theme.css";
import { AstryxProvider } from "./components/astryx/AstryxProvider";
import { registerServiceWorker } from "./services/service-worker";
import { initCustomFonts } from "./components/editor/inspector/font-options";




registerServiceWorker().then((registration) => {
  if (registration) {
  }
});

void initCustomFonts();

const root = document.getElementById("root")!;

async function renderApplication(): Promise<void> {
  const application: React.ReactNode = <App />;

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AstryxProvider>{application}</AstryxProvider>
    </React.StrictMode>,
  );
}

let applicationReady = false;
let creatorImport: Promise<void> | null = null;
const notifyHost = () => parent.postMessage({ type: "reelfinisher:ready" }, location.origin);
window.addEventListener("message", (event: MessageEvent) => {
  if (applicationReady && event.origin === location.origin && event.source === parent && event.data?.type === "reelfinisher:probe") notifyHost();
  if (applicationReady && event.origin === location.origin && event.source === parent && event.data?.type === "reelfinisher:open-creator" && typeof event.data.id === "string" && !creatorImport) {
    creatorImport = import("./reelfinisher/creator-import").then(module => module.importCreatorProject(event.data.id));
    void creatorImport.then(() => parent.postMessage({ type: "reelfinisher:creator-opened" }, location.origin), () => parent.postMessage({ type: "reelfinisher:creator-error", message: "Cannot open this Short. Return to Shorts Maker and retry with the original video. Existing projects are unchanged." }, location.origin));
  }
});
void renderApplication().then(() => { applicationReady = true; notifyHost(); });
