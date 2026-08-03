import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import "@/styles/global.css";
import "@/styles/mobile.css";
import "@/styles/mobile-foundation.css";

import { installGlobalDiagnostics } from "@/lib/diagnostics";
installGlobalDiagnostics();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root-Element wurde nicht gefunden.");

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
