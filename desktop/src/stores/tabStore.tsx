import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

// Define editor state that will be stored per tab
export interface EditorState {
  scrollPosition: number;
  cursorPosition: number;
  selection: {
    from: number;
    to: number;
  } | null;
  activeFormats: {
    textStyle: string;
    headingLevel: string;
    alignment: string;
    listType: string | null;
  };
}

// Extended Tab interface with editor state
export interface Tab {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  editorState: EditorState;
}

// Document interface to match your API response
export interface Document {
  id: string;
  name: string; 
  type: string; 
  content: string;
  created_at: Date;
}

// Default editor state
const createDefaultEditorState = (): EditorState => ({
  scrollPosition: 0,
  cursorPosition: 0,
  selection: null,
  activeFormats: {
    textStyle: '',
    headingLevel: '',
    alignment: 'left',
    listType: null
  }
});

interface TabState {
  // Original tab state
  tabs: Tab[];
  activeTabId: string | null;
  
  // Document cache state
  documents: Document[];
  documentsLastFetched: number | null;
  isLoadingDocuments: boolean;
  
  // Tab operations
  createTab: (title?: string, content?: string) => string;
  updateTab: (id: string, updates: Partial<Omit<Tab, 'id' | 'createdAt' | 'editorState'>>) => void;
  deleteTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  getActiveTab: () => Tab | undefined;
  
  // Editor state operations
  updateEditorState: (id: string, updates: Partial<EditorState>) => void;
  updateActiveEditorState: (updates: Partial<EditorState>) => void;
  getEditorState: (id: string) => EditorState | undefined;
  
  // Format state convenience methods
  setFormatState: (id: string, formats: Partial<EditorState['activeFormats']>) => void;
  
  // Content getters/setters that operate on the active tab
  getContent: () => string;
  setContent: (content: string) => void;
  getTitle: () => string;
  setTitle: (title: string) => void;
  
  // Document operations
  setDocuments: (documents: Document[]) => void;
  getDocuments: () => Document[];
  setIsLoadingDocuments: (isLoading: boolean) => void;
  getCachedDocuments: (maxAge?: number) => Promise<Document[]>;
  openDocumentInTab: (documentId: string) => Promise<string | null>;
  refreshDocuments: () => Promise<Document[]>;
}

// Import the getFiles function
import { getFiles, saveDocument } from '@/api/document';
export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      // Original tab state
      tabs: [],
      activeTabId: null,
      
      // Document cache state
      documents: [],
      documentsLastFetched: null,
      isLoadingDocuments: false,
      
      // Tab operations
      createTab: (title = 'Untitled', content = '<h1></h1><p></p>') => {
        const id = nanoid();
        const now = Date.now();
        const newTab: Tab = {
          id,
          title,
          content,
          createdAt: now,
          updatedAt: now,
          editorState: createDefaultEditorState(),
        };
      
        set((state) => {
          const newDocument: Document = {
            id,
            name: title,
            type: "text/html", // Adjust this type based on actual usage
            content,
            created_at: new Date(),
          };
      
          return {
            tabs: [...state.tabs, newTab],
            activeTabId: id,
            documents: [...state.documents, newDocument], // Update document cache
            documentsLastFetched: now, // Refresh timestamp
          };
        });
      
        return id;
      },
      
      updateTab: (id, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => 
            tab.id === id 
              ? { 
                  ...tab, 
                  ...updates, 
                  updatedAt: Date.now() 
                } 
              : tab
          )
        }));
      },
      
      deleteTab: (id) => {
        const { tabs, activeTabId } = get();
        const filteredTabs = tabs.filter((tab) => tab.id !== id);
        
        // If we're deleting the active tab, switch to another tab
        let newActiveId = activeTabId;
        if (activeTabId === id) {
          const idx = tabs.findIndex((tab) => tab.id === id);
          if (filteredTabs.length > 0) {
            // Prefer the tab to the right, or if none, the tab to the left
            newActiveId = filteredTabs[Math.min(idx, filteredTabs.length - 1)].id;
          } else {
            newActiveId = null;
          }
        }
        
        set({
          tabs: filteredTabs,
          activeTabId: newActiveId,
        });
      },
      
      setActiveTab: (id) => {
        const { activeTabId, getActiveTab } = get();
        if (activeTabId) {
          const activeTab = getActiveTab();
          if (activeTab) {
            // TODO: use update document
            saveDocument({ 
              title: activeTab.title, 
              content: activeTab.content, 
            });
          }
        }
        set({ activeTabId: id });
      },
      
      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((tab) => tab.id === activeTabId);
      },
      
      updateEditorState: (id, updates) => {
        // Only update if there are actually changes
        set((state) => ({
          tabs: state.tabs.map((tab) => 
            tab.id === id 
              ? { 
                  ...tab, 
                  editorState: { ...tab.editorState, ...updates },
                } 
              : tab
          )
        }));
      },
      
      updateActiveEditorState: (updates) => {
        const { activeTabId } = get();
        if (activeTabId) {
          get().updateEditorState(activeTabId, updates);
        }
      },
      
      getEditorState: (id) => {
        const tab = get().tabs.find(tab => tab.id === id);
        return tab?.editorState;
      },
      
      // Format state convenience methods
      setFormatState: (id, formats) => {
        const tab = get().tabs.find(tab => tab.id === id);
        if (tab) {
          get().updateEditorState(id, {
            activeFormats: { ...tab.editorState.activeFormats, ...formats }
          });
        }
      },
      
      // Content getters/setters
      getContent: () => {
        const activeTab = get().getActiveTab();
        return activeTab?.content || '';
      },
      
      setContent: (content) => {
        const { activeTabId } = get();
        if (activeTabId) {
          get().updateTab(activeTabId, { content });
        }
      },
      
      getTitle: () => {
        const activeTab = get().getActiveTab();
        return activeTab?.title || 'Untitled';
      },
      
      setTitle: (title) => {
        const { activeTabId } = get();
        if (activeTabId) {
          get().updateTab(activeTabId, { title });
        }
      },
      
      // Document operations
      setDocuments: (documents) => {
        set({ 
          documents,
          documentsLastFetched: Date.now()
        });
      },
      
      getDocuments: () => {
        return get().documents;
      },
      
      setIsLoadingDocuments: (isLoading) => {
        set({ isLoadingDocuments: isLoading });
      },
      
      // Get cached documents or fetch from API if cache is stale
      // maxAge is in milliseconds, defaults to 5 minutes
      getCachedDocuments: async (maxAge = 5 * 60 * 1000) => {
        const { documents, documentsLastFetched, isLoadingDocuments } = get();
        
        // If already loading, return current documents
        if (isLoadingDocuments) {
          return documents;
        }
        
        // Check if we have documents and if they're still fresh
        const now = Date.now();
        const isCacheFresh = documentsLastFetched && (now - documentsLastFetched < maxAge);
        
        // Return cached documents if they're fresh
        if (documents.length > 0 && isCacheFresh) {
          return documents;
        }
        
        // Otherwise fetch fresh documents
        return get().refreshDocuments();
      },
      
      // Force a refresh of documents from the API
      refreshDocuments: async () => {
        const { setIsLoadingDocuments, setDocuments } = get();
        
        setIsLoadingDocuments(true);
        try {
          const documents = await getFiles();
          setDocuments(documents);
          return documents;
        } catch (error) {
          console.error("Failed to fetch documents:", error);
          // Return current documents on error
          return get().documents;
        } finally {
          setIsLoadingDocuments(false);
        }
      },
      
      // Open a document from cache in a new tab
      openDocumentInTab: async (documentId) => {
        const { documents, createTab, setActiveTab } = get();
        
        // Try to find document in cache
        let document = documents.find(doc => doc.id === documentId);
        
        // If not in cache, try to fetch documents
        if (!document) {
          const freshDocuments = await get().refreshDocuments();
          document = freshDocuments.find(doc => doc.id === documentId);
        }
        
        // If document found, open in new tab
        if (document) {
          const tabId = createTab(document.name, document.content);
          setActiveTab(tabId);
          return tabId;
        }
        
        return null;
      }
    }),
    {
      name: 'editor-state',
      partialize: (state) => ({
        tabs: state.tabs.map(tab => ({
          ...tab,
          // Don't persist selection state
          editorState: {
            ...tab.editorState,
            selection: null,
          }
        })),
        activeTabId: state.activeTabId,
        // Cache the documents but not loading state
        documents: state.documents,
        documentsLastFetched: state.documentsLastFetched
      }),
    }
  )
);