import React from "react";
import AppHeader from "@/components/AppHeader";

type Props = {
  title?: string;
  showHome?: boolean;
  showSettings?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export default function AppShell({
  title,
  showHome = true,
  showSettings = true,
  leftSlot,
  rightSlot,
  children,
  className = ""
}: Props) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <AppHeader />
      <main className="container mx-auto p-4 w-full">
        {title && <h1 className="text-2xl font-semibold mb-4 text-center">{title}</h1>}
        <div className="flex items-start gap-4">
          {leftSlot && <aside className="hidden lg:block w-64 shrink-0">{leftSlot}</aside>}
          <section className="flex-1">{children}</section>
          {rightSlot && <aside className="hidden xl:block w-72 shrink-0">{rightSlot}</aside>}
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-gray-500">ULC Linz</footer>
    </div>
  );
}
