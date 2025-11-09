import React from "react";
import logo from "@/assets/logo.png";
import "./AppLogo.css";

export default function AppLogo() {
  return (
    <div className="app-logo-container">
      <img src={logo} alt="Logo" className="app-logo" />
    </div>
  );
}
