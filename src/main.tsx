import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { AppStateProvider } from "./state";
import { initializeAppTheme } from "./theme";
import "./styles.css";

const routerBaseName = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

initializeAppTheme();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}cho-service-worker.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
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
