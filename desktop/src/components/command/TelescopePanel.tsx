import React, { useState, useEffect } from "react";
import { Panel, usePanelStore } from "@/stores/commandStore";
import { useTabStore } from "@/stores/tabStore";
import { Input } from "@/components/ui/input";
import { TelescopeDialog } from "@/components/command/TelescopeDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Search, Clock, AlertCircle } from "lucide-react";
import { getFiles } from "@/api/document";

// Match the mock file structure you were using before
interface Document {
  id: string;
  name: string; 
  type: string; 
  content: string;
  created_at: Date;
}

interface FileItemProps {
  file: Document;
  isSelected: boolean;
  onSelect: () => void;
  onOpenTab: () => void;
}

const FileItem = ({ file, isSelected, onSelect, onOpenTab }: FileItemProps) => {
  // Format date properly whether it's a string or Date object
  const formatDate = (date: Date | string) => {
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  };

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
      <span className="flex-grow truncate">{file.name}</span>
      <span className="text-xs text-muted-foreground">
        {formatDate(file.created_at)}
      </span>
    </div>
  );
};

export function TelescopePanel() {
  const panel = usePanelStore((state) => state);
  const { createTab, setActiveTab, getCachedDocuments } = useTabStore();
  
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Fetch documents when the panel opens
  useEffect(() => {
    if (panel.editor) {
      fetchDocuments();
    }
  }, [panel.editor]);
  
  // Fetch documents from the API
  const fetchDocuments = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // Use the getFiles function to fetch documents
      // const data = await getFiles();
      const data = await getCachedDocuments(); 
      setDocuments(data);
      setFilteredFiles(data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter files based on search query
  useEffect(() => {
    if (!query) {
      setFilteredFiles(documents);
    } else {
      const filtered = documents.filter(doc => 
        doc.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredFiles(filtered);
    }
    
    // Reset selection when results change
    setSelectedIndex(0);
  }, [query, documents]);
  
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
  
  // Open file in a new tab
  const openFile = (file: Document) => {
    // For this version, we assume the content is already available
    // in the file object, just like in your mock data
    const tabId = createTab(file.name, file.content);
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
              {isLoading ? (
                <div className="px-2 py-6 text-sm text-center text-muted-foreground">
                  Loading documents...
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center px-2 py-6 text-sm text-center text-red-500">
                  <AlertCircle className="w-5 h-5 mb-2" />
                  {error}
                </div>
              ) : filteredFiles.length > 0 ? (
                <div className="px-1 py-2">
                  {filteredFiles.map((file, index) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      isSelected={index === selectedIndex}
                      onSelect={() => setSelectedIndex(index)}
                      onOpenTab={() => openFile(file)}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-2 py-6 text-sm text-center text-muted-foreground">
                  {documents.length === 0 ? "No documents found" : "No matching files found"}
                </div>
              )}
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
                    <h3 className="text-lg font-medium">{selectedFile.name}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Modified {selectedFile.created_at instanceof Date ? 
                        selectedFile.created_at.toLocaleDateString() : 
                        new Date(selectedFile.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center text-muted-foreground">
                      <span className="ml-6">Type: {selectedFile.type}</span>
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