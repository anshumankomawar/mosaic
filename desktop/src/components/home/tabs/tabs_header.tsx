import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, X, Search } from "lucide-react";
import { Tab, useTabStore } from "@/stores/tabStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import clsx from 'clsx';
import { isTauri } from '@/platform';
import { useRef, useEffect, useState } from "react";
import SettingsDropdown from "@/components/home/tabs/settings_dropdown";
import { logout } from "@/api/auth";
import { Panel, usePanelStore } from "@/stores/commandStore";
import { Input } from "@/components/ui/input";
import { useViewStore, View } from "@/stores/viewStore";

const TabItem = ({ 
  tab, 
  isActive, 
  onClick, 
  onClose,
  index,
  updateActiveTabPosition
}: { 
  tab: Tab; 
  isActive: boolean; 
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  index: number;
  updateActiveTabPosition: (rect: DOMRect | null) => void;
}) => {
  const tabRef = useRef<HTMLDivElement>(null);
  
  // Report this tab's position if it's active
  useEffect(() => {
    if (isActive && tabRef.current) {
      updateActiveTabPosition(tabRef.current.getBoundingClientRect());
    }
  }, [isActive, updateActiveTabPosition]);
  
  return (
    <div
      ref={tabRef}
      className={cn(
        "group relative flex items-center gap-1 h-8 px-3 pb-1 pt-0.5 cursor-pointer text-xs transition-all",
        "mx-0.5 mt-1.5 rounded-t-md",
        isActive 
          ? "bg-background text-foreground z-10" 
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onClick}
      data-active={isActive}
      data-index={index}
      data-tauri-drag-region={false}
    >
      {/* Tab content */}
      <span 
        className="truncate max-w-[120px] relative z-10"
        data-tauri-drag-region={false}
      >
        {tab.title}
      </span>
      <button
        className={cn(
          "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity relative z-10",
          isActive && "opacity-100"
        )}
        onClick={onClose}
        data-tauri-drag-region={false}
      >
        <X size={14} />
      </button>
      
      {/* Custom borders with rounded bottom corners for active tab */}
      {isActive && (
        <>
          {/* Top and sides border */}
          <div 
            className="absolute inset-0 rounded-t-md pointer-events-none"
            style={{
              borderTop: '1px solid hsl(var(--border))',
              borderLeft: '1px solid hsl(var(--border))',
              borderRight: '1px solid hsl(var(--border))',
              borderBottom: 'none',
              height: `calc(100% - 5px)`
            }}
          />
          
          {/* Left curved corner - flipped horizontally */}
          <div 
            className="absolute pointer-events-none z-5"
            style={{
              left: '-4px',
              bottom: 0,
              width: '5px',
              height: '5px',
              borderRight: '1px solid hsl(var(--border))',
              borderBottom: '1px solid hsl(var(--border))',
              borderBottomRightRadius: '5px',
              background: 'hsl(var(--background))'
            }}
          />
          
          {/* Right curved corner - flipped horizontally */}
          <div 
            className="absolute pointer-events-none z-5"
            style={{
              right: '-4px',
              bottom: 0,
              width: '5px',
              height: '5px',
              borderLeft: '1px solid hsl(var(--border))',
              borderBottom: '1px solid hsl(var(--border))',
              borderBottomLeftRadius: '5px',
              background: 'hsl(var(--background))'
            }}
          />
        </>
      )}
    </div>
  );
};

export function TabsHeader() {
  const { tabs, activeTabId, createTab, setActiveTab, deleteTab } = useTabStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTabPos, setActiveTabPos] = useState<{ left: number, right: number } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const commandStore = usePanelStore();
  
  const updateActiveTabPosition = (rect: DOMRect | null) => {
    if (rect && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      setActiveTabPos({
        left: rect.left - containerRect.left,
        right: rect.right - containerRect.left
      });
    } else {
      setActiveTabPos(null);
    }
  };

  const handleTabClick = (id: string) => {
    setActiveTab(id);
  };

  const handleTabClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteTab(id);
  };

  const handleNewTab = () => {
    createTab();
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    // You would implement actual theme switching logic here
    console.log(`Theme switched to: ${newTheme}`);
  };

  const handleSettings = () => {
    console.log("Settings clicked");
    // Implement settings navigation or modal here
    commandStore.setPanel(Panel.SETTINGS, true);
  };

  const viewStore = useViewStore((state) => state);

  const handleLogout = async () => {
    try {
      console.log("Logout clicked");
      await logout();
      console.log("Logout successful");
      viewStore.setView(View.LOGIN, { authRequired: true });
      
    } catch (error) {
      console.error("Logout error:", error);
      viewStore.setView(View.LOGIN, { authRequired: true });
    }
  };

  // Create a first tab if there are none
  if (tabs.length === 0) {
    return (
      <div 
        className="flex h-10 items-center border-b border-border px-2"
        data-tauri-drag-region="true"
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 rounded-sm"
          onClick={handleNewTab}
          data-tauri-drag-region={false}
        >
          <Plus size={16} />
          <span className="sr-only">New Tab</span>
        </Button>
        <div className="flex-1" data-tauri-drag-region="true" />
        
        {/* Menu button */}
        <div data-tauri-drag-region={false}>
          <SettingsDropdown 
            theme={theme} 
            onThemeChange={handleThemeChange} 
            onSettings={handleSettings} 
            onLogout={handleLogout} 
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative" 
      ref={containerRef}
      data-tauri-drag-region="true"
    >
      <div 
        className={clsx(
          "flex items-center relative overflow-x-auto scrollbar-hide",
          {
            "pl-20": isTauri()
          }
        )}
        data-tauri-drag-region="true"
      >
        <div 
          className="flex items-center h-full"
          data-tauri-drag-region="true"
        >
          {tabs.map((tab, index) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onClick={() => handleTabClick(tab.id)}
              onClose={(e) => handleTabClose(e, tab.id)}
              index={index}
              updateActiveTabPosition={updateActiveTabPosition}
            />
          ))}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 min-w-7 p-0 ml-2 rounded-sm flex-shrink-0"
                onClick={handleNewTab}
                data-tauri-drag-region={false}
              >
                <Plus size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>New Tab</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <div className="flex-1" data-tauri-drag-region="true" />
        
        {/* Settings dropdown menu */}
        <div className="mr-2" data-tauri-drag-region={false}>
          <SettingsDropdown 
            theme={theme} 
            onThemeChange={handleThemeChange} 
            onSettings={handleSettings} 
            onLogout={handleLogout} 
          />
        </div>
      </div>
      
      {/* Split bottom border that skips the active tab */}
      {activeTabPos ? (
        <>
          {/* Left border segment */}
          <div 
            className="h-[1px] bg-border absolute bottom-0 z-0" 
            style={{
              left: 0,
              width: `${activeTabPos.left - 4}px`
            }}
            data-tauri-drag-region="true"
          />
          
          {/* Right border segment */}
          <div 
            className="h-[1px] bg-border absolute bottom-0 z-0" 
            style={{
              left: `${activeTabPos.right + 4}px`,
              right: 0
            }}
            data-tauri-drag-region="true"
          />
        </>
      ) : (
        // Fallback full border if no active tab position
        <div 
          className="h-[1px] w-full bg-border relative z-0"
          data-tauri-drag-region="true" 
        />
      )}
    </div>
  );
}

export default TabsHeader;
