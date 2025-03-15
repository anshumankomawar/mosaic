import React, { useState, useEffect } from "react";
import { Panel, usePanelStore } from "@/stores/commandStore";
import { useTabStore } from "@/stores/tabStore";
import { Input } from "@/components/ui/input";
import { TelescopeDialog } from "@/components/command/TelescopeDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Search, Clock, AlertCircle, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Document } from "@/stores/tabStore";

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
      <span className="flex-grow truncate">{file.title}</span>
      <span className="text-xs text-muted-foreground">
        {formatDate(file.lastModified)}
      </span>
    </div>
  );
};

export function TelescopePanel() {
  const panel = usePanelStore((state) => state);
  const { 
    getCachedDocuments, 
    refreshDocuments,
    openDocumentInTab,
    isLoadingDocuments
  } = useTabStore();
  
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<Document[]>([]);
  const [error, setError] = useState("");
  
  // Fetch documents when the panel opens
  useEffect(() => {
    if (panel.editor) {
      fetchDocuments();
    }
  }, [panel.editor]);
  
  // Fetch documents from cache or API
  const fetchDocuments = async () => {
    setError("");
    
    try {
      // This will use cached documents if available and fresh, otherwise fetch from API
      const docs = await getCachedDocuments();
      setDocuments(docs);
      setFilteredFiles(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError("Failed to load documents");
    }
  };
  
  // Force refresh documents from API
  const handleRefresh = async () => {
    setError("");
    
    try {
      const docs = await refreshDocuments();
      setDocuments(docs);
      setFilteredFiles(docs);
    } catch (err) {
      console.error("Failed to refresh documents:", err);
      setError("Failed to refresh documents");
    }
  };
  
  // Filter files based on search query
  useEffect(() => {
    if (!query) {
      setFilteredFiles(documents);
    } else {
      const filtered = documents.filter(doc => 
        doc.title.toLowerCase().includes(query.toLowerCase())
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
          handleOpenDocument(filteredFiles[selectedIndex]);
        }
        break;
      case "Escape":
        panel.setPanel(Panel.EDITOR, false);
        break;
    }
  };
  
  // Open document in a new tab
  const handleOpenDocument = (file: Document) => {
    openDocumentInTab(file.id);
    panel.setPanel(Panel.EDITOR, false);
  };
  
  const selectedFile = filteredFiles[selectedIndex];

  return (
    <div className="flex flex-col h-full p-2 space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-8 text-sm"
          placeholder="Search documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
      
      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filteredFiles.length} document{filteredFiles.length !== 1 ? 's' : ''}
        </span>
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent"
          onClick={handleRefresh}
          disabled={isLoadingDocuments}
        >
          <RefreshCcw className={cn(
            "w-3 h-3", 
            isLoadingDocuments && "animate-spin"
          )} />
          {isLoadingDocuments ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-2 text-sm bg-destructive/10 text-destructive rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      
      {/* File list */}
      {filteredFiles.length > 0 ? (
        <ScrollArea className="flex-grow">
          <div className="space-y-1">
            {filteredFiles.map((file, index) => (
              <FileItem
                key={file.id}
                file={file}
                isSelected={index === selectedIndex}
                onSelect={() => setSelectedIndex(index)}
                onOpenTab={() => handleOpenDocument(file)}
              />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center flex-grow gap-2 text-center">
          {query ? (
            <>
              <Search className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No documents matching "{query}"
              </p>
            </>
          ) : (
            <>
              <FileText className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isLoadingDocuments ? "Loading documents..." : "No documents found"}
              </p>
            </>
          )}
        </div>
      )}
      
      {/* File details */}
      {selectedFile && (
        <div className="p-2 mt-2 space-y-1 border rounded-md">
          <h3 className="font-medium text-sm">{selectedFile.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Last modified: {new Date(selectedFile.lastModified).toLocaleString()}</span>
          </div>
          <button
            className="w-full px-2 py-1 mt-1 text-xs text-center rounded bg-primary text-primary-foreground"
            onClick={() => handleOpenDocument(selectedFile)}
          >
            Open
          </button>
        </div>
      )}
    </div>
  );
}