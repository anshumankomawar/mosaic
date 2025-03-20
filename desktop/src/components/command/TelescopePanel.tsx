import { TelescopeDialog } from "@/components/command/TelescopeDialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBufferStore } from "@/stores/bufferStore";
import { Panel, usePanelStore } from "@/stores/commandStore";
import { AlertCircle, Clock, FileText, Search, RefreshCw, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTabStore } from "@/stores/tabStore";

// Sort type enum for sorting options
enum SortType {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  NAME_AZ = 'name_az',
  NAME_ZA = 'name_za'
}

export function TelescopePanel() {
  const panel = usePanelStore((state) => state);
  const bufferStore = useBufferStore();
  const { createTab, setActiveTab } = useTabStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [documents, setDocuments] = useState<Buffer[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<Buffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [sortType, setSortType] = useState<SortType>(SortType.NEWEST);

  // Fetch initial documents on component mount
  useEffect(() => {
    // Load buffers immediately
    loadBuffers();

    // Set up background refresh interval (every 30 seconds)
    const intervalId = setInterval(loadBuffers, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // Load documents when panel is opened
  useEffect(() => {
    if (panel.editor) {
      loadBuffers();
    }
  }, [panel.editor]);

  // Load buffers from store
  const loadBuffers = async () => {
    try {
      setIsLoading(true);
      const fetchedBuffers = await bufferStore.fetchBuffers();
      setDocuments(sortDocuments(fetchedBuffers, sortType));
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load buffers:", err);
      setError("Failed to load buffers");
      setIsLoading(false);
    }
  };

  // Sort documents based on sort type
  const sortDocuments = (docs: Buffer[], sort: SortType): Buffer[] => {
    const sortedDocs = [...docs];

    switch (sort) {
      case SortType.NEWEST:
        return sortedDocs.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Most recent first
        });

      case SortType.OLDEST:
        return sortedDocs.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateA - dateB; // Oldest first
        });

      case SortType.NAME_AZ:
        return sortedDocs.sort((a, b) => 
          a.name.localeCompare(b.name)
        );

      case SortType.NAME_ZA:
        return sortedDocs.sort((a, b) => 
          b.name.localeCompare(a.name)
        );

      default:
        return sortedDocs;
    }
  };

  // Change sorting method
  const changeSortType = (newSortType: SortType) => {
    setSortType(newSortType);
    setDocuments(sortDocuments(documents, newSortType));
  };

  // Refresh documents from server
  const refreshDocuments = async () => {
    setRefreshing(true);
    setError("");

    try {
      const freshBuffers = await bufferStore.fetchBuffers();
      setDocuments(sortDocuments(freshBuffers, sortType));
      toast.success("Files refreshed");
    } catch (err) {
      console.error("Failed to refresh buffers:", err);
      setError("Failed to load buffers");
      toast.error("Failed to refresh files");
    } finally {
      setRefreshing(false);
    }
  };

  // Filter files based on search query
  useEffect(() => {
    if (!query) {
      setFilteredFiles(documents);
    } else {
      const filtered = documents.filter((doc) =>
        doc.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredFiles(filtered);
    }

    // Reset selection when results change
    setSelectedIndex(0);
  }, [query, documents]);

  // Fetch preview content when selection changes
  useEffect(() => {
    const selectedFile = filteredFiles[selectedIndex];
    if (!selectedFile) {
      setPreviewContent(null);
      return;
    }

    const loadPreview = async () => {
      console.log("Loading preview for:", selectedFile.name);
      setIsLoadingPreview(true);
      try {
        // If content is already available in the document, use it
        console.log("Selected file:", selectedFile);
        if (selectedFile.content) {
          console.log("Using existing content for preview");
          setPreviewContent(selectedFile.content);
        } else {
          // Otherwise fetch it from buffer store
          const fullBuffer = await bufferStore.getBuffer(selectedFile.id);
          if (fullBuffer && fullBuffer.content) {
            setPreviewContent(fullBuffer.content);
          } else {
            setPreviewContent("<p>Content not available</p>");
          }
        }
      } catch (error) {
        console.error("Error loading preview:", error);
        setPreviewContent("<p>Failed to load content</p>");
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();
  }, [selectedIndex, filteredFiles]);

  // Handle keyboard navigation
  const fileRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Update selection and scroll to the selected item
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev < filteredFiles.length - 1 ? prev + 1 : prev;
          fileRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return newIndex;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : prev;
          fileRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return newIndex;
        });
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
  const openFile = async (file: Buffer) => {
    try {
      // Get the full buffer with content if needed
      let bufferWithContent = file;
      if (!file.content) {
        const fullBuffer = await bufferStore.getBuffer(file.id);
        if (fullBuffer) {
          bufferWithContent = fullBuffer;
        } else {
          throw new Error("Could not load buffer content");
        }
      }

      // Create a new tab with this buffer
      const tabId = createTab(
        bufferWithContent.name, 
        bufferWithContent.content,
        bufferWithContent.id
      );

      // Set it as active
      setActiveTab(tabId);
      toast.success(`Opened "${file.name}"`);

      // Close panel
      panel.setPanel(Panel.EDITOR, false);
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Failed to open file");
    }
  };

  // Render FileItem as before, but using Buffer type
  const FileItem = forwardRef<HTMLDivElement, { 
    file: Buffer, 
    isSelected: boolean, 
    onSelect: () => void, 
    onOpenTab: () => void 
  }>(
    ({ file, isSelected, onSelect, onOpenTab }, ref) => {
      const formatDate = (date: Date | string) => {
        if (date instanceof Date) {
          return date.toLocaleDateString();
        }
        return new Date(date).toLocaleDateString();
      };

      // Get file type - fallback to "txt" if not defined
      const fileType = file.type || "txt";

      return (
        <div
          ref={ref}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer",
            isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
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
    }
  );

  const selectedFile = filteredFiles[selectedIndex];

  return (
    <TelescopeDialog
      open={panel.editor}
      onOpenChange={(open) => panel.setPanel(Panel.EDITOR, open)}
    >
        <div className="flex flex-col h-[66vh]" onKeyDown={handleKeyDown}>
          {/* Search bar */}
          <div className="flex items-center px-3 py-2 border-b max-h-10">
            <Search className="w-4 h-4 mr-2 text-muted-foreground" />
            <Input
            className="flex-1 text-sm shadow-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Search files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
            <Button 
            variant="ghost" 
            size="icon_sm" 
            className="ml-2" 
            onClick={refreshDocuments}
            disabled={refreshing}
            title="Refresh files"
          >
              <RefreshCw className={cn(
                "w-4 h-4",
                refreshing && "animate-spin"
              )} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* File list */}
            <div className="w-1/2 border-r">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50 h-10">
                <span className="text-xs font-medium">FILES</span>

                {/* Sort options */}
                <div className="flex items-center ml-2">
                  <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs",
                    sortType === SortType.NEWEST && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => changeSortType(SortType.NEWEST)}
                  title="Sort by newest first"
                >
                  Newest
                </Button>
                  <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs",
                    sortType === SortType.OLDEST && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => changeSortType(SortType.OLDEST)}
                  title="Sort by oldest first"
                >
                  Oldest
                </Button>
                  <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => changeSortType(
                    sortType === SortType.NAME_AZ ? SortType.NAME_ZA : SortType.NAME_AZ
                  )}
                  title={sortType === SortType.NAME_AZ ? "Sort Z-A" : "Sort A-Z"}
                >
                    {sortType === SortType.NAME_AZ ? (
                      <ArrowDownAZ className="h-3 w-3" />
                    ) : sortType === SortType.NAME_ZA ? (
                        <ArrowUpAZ className="h-3 w-3" />
                      ) : (
                          <ArrowDownAZ className="h-3 w-3" />
                        )}
                  </Button>
                </div>

                <span className="ml-auto text-xs text-muted-foreground">
                  {filteredFiles.length} results
              </span>
              </div>

              <ScrollArea className="h-[calc(66vh-6rem)]">
                {documents.length === 0 && isLoading ? (
                  <div className="px-2 py-6 text-sm text-center text-muted-foreground">
                    Loading files...
                  </div>
                ) : error && documents.length === 0 ? (
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
                            ref={el => fileRefs.current[index] = el}
                          />
                        ))}
                        </div>
                    ) : (
                        <div className="px-2 py-6 text-sm text-center text-muted-foreground">
                          {documents.length === 0
                            ? "No files found"
                            : "No matching files found"}
                          </div>
                      )}

                {refreshing && documents.length > 0 && (
                  <div className="flex justify-center py-2 text-xs text-muted-foreground">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Refreshing...
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Preview pane */}
            <div className="flex flex-col w-1/2">
              <div className="flex items-center px-3 py-1.5 border-b bg-muted/50 h-10">
                <span className="text-xs font-medium">PREVIEW</span>
                {selectedFile && (
                  <button
                    className="ml-auto text-xs hover:text-primary hover:underline"
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
                          <span>
                            {selectedFile.updatedAt 
                              ? `Updated ${new Date(selectedFile.updatedAt).toLocaleString()}`
                              : `Created ${new Date(selectedFile.created_at).toLocaleString()}`
                          }
                          </span>
                        </div>

                        <div className="flex items-center text-muted-foreground">
                          <span className="ml-6">Type: {selectedFile.type || "txt"}</span>
                        </div>

                        <div className="pt-4 mt-4 border-t">
                          {isLoadingPreview ? (
                            <div className="flex justify-center py-8">
                              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                              </div>
                          ) : (
                              <div
                                className="prose prose-sm dark:prose-invert max-w-none overflow-hidden"
                                dangerouslySetInnerHTML={{
                                  __html: previewContent || "<p>No content available</p>",
                                }}
                              />
                            )}
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
