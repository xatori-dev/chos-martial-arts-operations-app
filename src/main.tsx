import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { startInstalledAppUpdateChecks } from "./appUpdate";
import { AppStateProvider } from "./state";
import { registerChoServiceWorker } from "./serviceWorkerRegistration";
import { initializeAppTheme } from "./theme";
import "./styles.css";

const routerBaseName = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

initializeAppTheme();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void registerChoServiceWorker();
    startInstalledAppUpdateChecks();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={routerBaseName}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>
);
