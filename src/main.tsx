// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import "./assets/styles/GlobalStyles.css"


// 🛑 Frühzeitige Prüfung – bricht sofort mit klarer Meldung ab, falls ENV fehlt
[
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_USERS_FILE_ID",
  "VITE_DRIVE_KINDERTRAINING_FILE_ID",
  "VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID"
].forEach(requireEnv)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)