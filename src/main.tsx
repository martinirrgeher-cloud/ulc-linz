import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "@/styles/global.css";
import "@/styles/mobile.css";
import "@/styles/kindertraining.css";
import "@/styles/statistics.css";
import "@/styles/performance-registration.css";
import "@/styles/exercise-catalog.css";
import "@/styles/training-blocks.css";
import "@/styles/training-planning.css";
import "@/styles/dropdown-settings.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root-Element wurde nicht gefunden.");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
