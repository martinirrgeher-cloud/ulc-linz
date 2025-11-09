import React from "react";
import AppHeader from "./AppHeader";

type Props = {
  title: string;
  children: React.ReactNode;
  showHome?: boolean;
  showSettings?: boolean;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
};

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
      <main className="app-content" role="main">
        {children}
      </main>
    </div>
  );
}
