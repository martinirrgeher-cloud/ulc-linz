import React from "react";
import AppHeader from "./AppHeader";
import "./AppShell.css";

type Props = {
  title: string;
  children: React.ReactNode;
  showHome?: boolean;
  showSettings?: boolean;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
};

/**
 * AppShell
 * - Kein zusätzlicher Spacer unter dem Header
 * - Content startet direkt ohne oberen Abstand
 */
export default function AppShell({
  title,
  children,
  showHome = true,
  showSettings = false,
  rightSlot,
  leftSlot,
}: Props) {
  return (
    <div className="app-shell">
      <AppHeader
        title={title}
        showHome={showHome}
        showSettings={showSettings}
        rightSlot={rightSlot}
        leftSlot={leftSlot}
      />
      {/* Kein Spacer hier! */}
      <main className="app-content" role="main">
        {children}
      </main>
    </div>
  );
}
