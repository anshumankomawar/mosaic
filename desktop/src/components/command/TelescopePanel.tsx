import React, { useState, useEffect } from "react";
import { Panel, usePanelStore } from "@/stores/commandStore";
import { useTabStore } from "@/stores/tabStore";
import { Input } from "@/components/ui/input";
import { TelescopeDialog } from "@/components/command/TelescopeDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Search, Clock } from "lucide-react";

// Mock file data (replace with your actual data source)
const mockFiles = [
  { id: "1", title: "Project Overview", type: "document", content: "<h1>Project Overview</h1><p>This is an overview of our project...</p>", lastModified: new Date(2023, 3, 15) },
  { id: "2", title: "Meeting Notes", type: "document", content: "<h1>Meeting Notes</h1><p>Discussion points from our last meeting...</p>", lastModified: new Date(2023, 3, 10) },
  { id: "3", title: "Research Findings", type: "document", content: "<h1>Research Findings</h1><p>Our research indicates the following trends...</p>", lastModified: new Date(2023, 3, 5) },
  { id: "4", title: "Product Roadmap", type: "document", content: "<h1>Product Roadmap</h1><p>Our roadmap for the next quarter includes...</p>", lastModified: new Date(2023, 2, 28) },
  { id: "5", title: "Design System", type: "document", content: "<h1>Design System</h1><p>Guidelines for our design system...</p>", lastModified: new Date(2023, 2, 20) },
  { id: "6", title: "API Documentation", type: "document", content: "<h1>API Documentation</h1><p>Endpoints and usage examples...</p>", lastModified: new Date(2023, 2, 15) },
  { id: "7", title: "Content Strategy", type: "document", content: "<h1>Content Strategy</h1><p>Our approach to content creation and distribution...</p>", lastModified: new Date(2023, 2, 10) },
  { id: "8", title: "Team OKRs", type: "document", content: "<h1>Team OKRs</h1><p>Objectives and key results for this quarter...</p>", lastModified: new Date(2023, 2, 5) },
  { id: "9", title: "User Feedback", type: "document", content: "<h1>User Feedback</h1><p>Summary of recent user interviews and feedback...</p>", lastModified: new Date(2023, 1, 28) },
];

interface FileItemProps {
  file: any;
  isSelected: boolean;
  onSelect: () => void;
  onOpenTab: () => void;
}

const FileItem = ({ file, isSelected, onSelect, onOpenTab }: FileItemProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer",
        isSelected 
          ? "bg-accent text-accent-foreground" 
          : "hover:bg-accent/50"
      )}
      onClick={onSelect}
      onDoubleClick={onOpenTab}
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="flex-grow truncate">{file.title}</span>
      <span className="text-xs text-muted-foreground">
        {file.lastModified.toLocaleDateString()}
      </span>
    </div>
  );
};

export function TelescopePanel() {
  const panel = usePanelStore((state) => state);
  const { createTab, setActiveTab } = useTabStore();
  
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredFiles, setFilteredFiles] = useState(mockFiles);
  
  // Filter files based on search query
  useEffect(() => {
    if (!query) {
      setFilteredFiles(mockFiles);
    } else {
      const filtered = mockFiles.filter(file => 
        file.title.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredFiles(filtered);
    }
    
    // Reset selection when results change
    setSelectedIndex(0);
  }, [query]);
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        if (filteredFiles[selectedIndex]) {
          openFile(filteredFiles[selectedIndex]);
        }
        break;
      case "Escape":
        panel.setPanel(Panel.EDITOR, false);
        break;
    }
  };
  
  // Open the selected file in a new tab
  const openFile = (file: any) => {
    const tabId = createTab(file.title, file.content);
    setActiveTab(tabId);
    panel.setPanel(Panel.EDITOR, false);
  };
  
  const selectedFile = filteredFiles[selectedIndex];
  
  return (
    <TelescopeDialog
      open={panel.editor}
      onOpenChange={(open) => panel.setPanel(Panel.EDITOR, open)}
    >
      <div className="flex flex-col h-[66vh]" onKeyDown={handleKeyDown}>
        {/* Search bar */}
        <div className="flex items-center px-3 py-2 border-b">
          <Search className="w-4 h-4 mr-2 text-muted-foreground" />
          <Input
            className="flex-1 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Search files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* File list */}
          <div className="w-1/2 border-r">
            <div className="flex items-center px-3 py-1.5 border-b bg-muted/50">
              <span className="text-xs font-medium">FILES</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {filteredFiles.length} results
              </span>
            </div>
            
            <ScrollArea className="h-[calc(66vh-6rem)]">
              <div className="px-1 py-2">
                {filteredFiles.length > 0 ? (
                  filteredFiles.map((file, index) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      isSelected={index === selectedIndex}
                      onSelect={() => setSelectedIndex(index)}
                      onOpenTab={() => openFile(file)}
                    />
                  ))
                ) : (
                  <div className="px-2 py-6 text-sm text-center text-muted-foreground">
                    No matching files found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Preview pane */}
          <div className="flex flex-col w-1/2">
            <div className="flex items-center px-3 py-1.5 border-b bg-muted/50">
              <span className="text-xs font-medium">PREVIEW</span>
              {selectedFile && (
                <button
                  className="ml-auto text-xs hover:text-blue-600 hover:underline"
                  onClick={() => openFile(selectedFile)}
                >
                  Open
                </button>
              )}
            </div>
            
            <ScrollArea className="flex-1">
              {selectedFile ? (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5" />
                    <h3 className="text-lg font-medium">{selectedFile.title}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Modified {selectedFile.lastModified.toLocaleDateString()}</span>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t">
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedFile.content }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Select a file to preview</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        
        {/* Status bar */}
        <div className="flex items-center px-3 py-1.5 text-xs border-t bg-muted/50 text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <span className="mr-1">↑↓</span>
              <span>Navigate</span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">Enter</span>
              <span>Open</span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">DblClick</span>
              <span>Open</span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">Esc</span>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </TelescopeDialog>
  );
}
