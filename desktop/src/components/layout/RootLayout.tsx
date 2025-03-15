// src/components/layout/RootLayout.tsx
import { Toaster } from "@/components/ui/sonner";
import { ThemePanel } from "@/components/command/ThemePanel";
import { GeneratePanel } from "@/components/command/GeneratePanel";
import { SearchPanel } from "@/components/command/SearchPanel";
import { CommandDialogDemo } from "@/components/command/command";
import { TelescopePanel } from "@/components/command/TelescopePanel";
import { SettingsPanel } from "@/components/command/settings_panel";
import { useKeyHandler } from "@/KeyPrefix";
import { ReactNode, useEffect } from "react";
import clsx from "clsx";
import { isTauri } from "@/platform";
import { useTabStore } from "@/stores/tabStore";
import { initStore } from "@/lib/stronghold";

type RootLayoutProps = {
  children: ReactNode;
  showSidebar?: boolean;
};

/**
 * RootLayout provides consistent UI elements across all views
 * This includes panels, sidebar, command dialog, and other global elements
 */
export function RootLayout({ children, showSidebar = true }: RootLayoutProps) {
  const { tabs, createTab } = useTabStore();
  useKeyHandler();
  
  useEffect(() => {
    // Init stores
    initStore();
    
    // Create a default tab if none exists
    if (tabs.length === 0) {
      createTab("Untitled", "<p>Welcome to your editor!</p>");
    }
  }, []);

  return (
    <div
      className={clsx("h-screen w-screen flex flex-col", {
        "pt-2": !isTauri(),
      })}
    >
      <Toaster />
      
      {/* The children prop will contain the view-specific content */}
      {children}
      
      {/* These UI elements appear in all views */}
      <CommandDialogDemo />
      <GeneratePanel />
      <SearchPanel />
      <ThemePanel />
      <TelescopePanel />
      <SettingsPanel />
    </div>
  );
}

export default RootLayout;
