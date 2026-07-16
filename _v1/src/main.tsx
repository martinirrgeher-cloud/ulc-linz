import "@/lib/drive/driveAuthBridge";
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import "./assets/styles/GlobalStyles.css"
import { getStoredToken } from "@/lib/googleAuth";


// ✅ Optional: einfache ENV-Check-Ausgabe im Log
const requiredEnvVars = [
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_DRIVE_USERS_FILE_ID",
  "VITE_DRIVE_KINDERTRAINING_DATA_FILE_ID",
  "VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID"
];

const token = getStoredToken();
if (!token && window.location.pathname === "/") {
  window.location.replace("/login1");
}

console.log("🧪 TEST VITE_USERS_FILE_ID:", import.meta.env.VITE_USERS_FILE_ID);

requiredEnvVars.forEach(key => {
  if (!import.meta.env[key as keyof ImportMetaEnv]) {
    console.error(`⚠️ Fehlende ENV Variable: ${key}`);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
