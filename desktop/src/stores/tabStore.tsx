import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { debounce } from 'lodash';
import { saveDocument } from '@/api/document';
import { documentCache } from '@/services/DocumentCacheService'; 

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

export interface Tab {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  editorState: EditorState;
  saveError?: boolean;
  pendingSave?: boolean;
}

export interface Document {
  id: string;
  name: string; 
  type: string; 
  content: string;
  created_at: Date;
}

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
  tabs: Tab[];
  activeTabId: string | null;
  documents: Document[];
  documentsLastFetched: number | null;
  isLoadingDocuments: boolean;
  
  createTab: (
    title?: string, 
    content?: string, 
    onSuccess?: (tabId: string) => void,
    onError?: (error: Error) => void
  ) => string;
  
  updateTab: (
    id: string, 
    updates: Partial<Omit<Tab, 'id' | 'createdAt' | 'editorState'>>,
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => void;
  
  deleteTab: (
    id: string, 
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => void;
  
  setActiveTab: (
    id: string, 
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => void;
  
  getActiveTab: () => Tab | undefined;
  
  updateEditorState: (id: string, updates: Partial<EditorState>) => void;
  updateActiveEditorState: (updates: Partial<EditorState>) => void;
  getEditorState: (id: string) => EditorState | undefined;
  
  setFormatState: (id: string, formats: Partial<EditorState['activeFormats']>) => void;
  
  getContent: () => string;
  setContent: (
    content: string, 
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => void;
  
  getTitle: () => string;
  setTitle: (
    title: string, 
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => void;
  
  setDocuments: (documents: Document[]) => void;
  getDocuments: () => Document[];
  setIsLoadingDocuments: (isLoading: boolean) => void;
  openDocumentInTab: (
    documentId: string, 
    onSuccess?: (tabId: string) => void,
    onError?: (error: Error) => void
  ) => Promise<string | null>;
  refreshDocuments: () => Promise<Document[]>;
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => {
      // Async function to refresh cache without blocking
      const refreshCacheAsync = async () => {
        try {
          await documentCache.refreshCache();
        } catch (error) {
          console.error("Background cache refresh failed:", error);
        }
      };

      const debouncedSave = debounce(
        async (tabToSave: Tab) => {
          try {
            const tabClone = { ...tabToSave };

            await saveDocument({ 
              title: tabClone.title, 
              content: tabClone.content 
            });
            
            // After successful save, refresh the cache asynchronously
            refreshCacheAsync();
          } catch (error) {
            console.error("Failed to save document:", error);
          }
        }, 
        1000,
        { 
          leading: false, 
          trailing: true 
        }
      );

      return {
        tabs: [],
        activeTabId: null,
        
        documents: [],
        documentsLastFetched: null,
        isLoadingDocuments: false,
        
        createTab: (
          title = 'Untitled', 
          content = '<h1></h1><p></p>', 
          onSuccess, 
          onError
        ) => {
          const id = nanoid();
          const now = Date.now();
          const newTab: Tab = {
            id,
            title,
            content,
            createdAt: now,
            updatedAt: now,
            editorState: createDefaultEditorState()
          };
        
          set((state) => {
            const newDocument: Document = {
              id,
              name: title,
              type: "text/html",
              content,
              created_at: new Date(),
            };
        
            return {
              tabs: [...state.tabs, newTab],
              activeTabId: id,
              documents: [...state.documents, newDocument],
              documentsLastFetched: now,
            };
          });
        
          onSuccess?.(id);
          
          // Refresh cache asynchronously after creating a new tab
          refreshCacheAsync();
          
          return id;
        },
        
        updateTab: (id, updates, onSuccess, onError) => {
          const currentTab = get().tabs.find(tab => tab.id === id);
          if (!currentTab) return;

          const updatedTab = { 
            ...currentTab, 
            ...updates, 
            updatedAt: Date.now()
          };

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

          if (updates.content || updates.title) {
            debouncedSave(updatedTab);
          }

          onSuccess?.();
        },
        
        deleteTab: (id, onSuccess, onError) => {
          const { tabs, activeTabId } = get();
          const filteredTabs = tabs.filter((tab) => tab.id !== id);
        
          let newActiveId = activeTabId;
          if (activeTabId === id) {
            const idx = tabs.findIndex((tab) => tab.id === id);
            if (filteredTabs.length > 0) {
              newActiveId = filteredTabs[Math.min(idx, filteredTabs.length - 1)].id;
            } else {
              newActiveId = null;
            }
          }
        
          set({
            tabs: filteredTabs,
            activeTabId: newActiveId,
          });

          onSuccess?.();
          
          // Refresh cache asynchronously after deleting a tab
          refreshCacheAsync();
        },
        
        setActiveTab: (id, onSuccess, onError) => {
          const { tabs } = get();
          
          const newActiveTab = tabs.find(tab => tab.id === id);
          if (!newActiveTab) return;

          set({ activeTabId: id });
          onSuccess?.();
        },
        
        getActiveTab: () => {
          const { tabs, activeTabId } = get();
          return tabs.find((tab) => tab.id === activeTabId);
        },
        
        updateEditorState: (id, updates) => {
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
        
        setFormatState: (id, formats) => {
          const tab = get().tabs.find(tab => tab.id === id);
          if (tab) {
            get().updateEditorState(id, {
              activeFormats: { ...tab.editorState.activeFormats, ...formats }
            });
          }
        },
        
        getContent: () => {
          const activeTab = get().getActiveTab();
          return activeTab?.content || '';
        },
        
        setContent: (content, onSuccess, onError) => {
          const { activeTabId } = get();
          if (activeTabId) {
            get().updateTab(activeTabId, { content }, onSuccess, onError);
          }
        },
        
        getTitle: () => {
          const activeTab = get().getActiveTab();
          return activeTab?.title || 'Untitled';
        },
        
        setTitle: (title, onSuccess, onError) => {
          const { activeTabId } = get();
          if (activeTabId) {
            get().updateTab(activeTabId, { title }, onSuccess, onError);
          }
        },
        
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
        
        refreshDocuments: async () => {
          const { setIsLoadingDocuments, setDocuments } = get();
          
          setIsLoadingDocuments(true);
          try {
            // Use document cache instead of direct API call
            const documents = await documentCache.refreshCache();
            setDocuments(documents);
            return documents;
          } catch (error) {
            console.error("Failed to fetch documents:", error);
            return get().documents;
          } finally {
            setIsLoadingDocuments(false);
          }
        },
        
        openDocumentInTab: async (
          documentId, 
          onSuccess, 
          onError
        ) => {
          const { documents, createTab, setActiveTab } = get();
          
          let document = documents.find(doc => doc.id === documentId);
          
          if (!document) {
            try {
              // Try getting the document from cache first
              document = await documentCache.getDocument(documentId);
              
              // If not in cache, refresh and try again
              if (!document) {
                const freshDocuments = await get().refreshDocuments();
                document = freshDocuments.find(doc => doc.id === documentId);
              }
            } catch (error) {
              onError?.(error as Error);
              return null;
            }
          }
          
          if (document) {
            const tabId = createTab(document.name, document.content, 
              (createdTabId) => {
                setActiveTab(createdTabId);
                onSuccess?.(createdTabId);
              },
              onError
            );
            
            return tabId;
          }
          
          return null;
        }
      };
    },
    {
      name: 'editor-state',
      partialize: (state) => ({
        tabs: state.tabs.map(tab => ({
          ...tab,
          editorState: {
            ...tab.editorState,
            selection: null,
          }
        })),
        activeTabId: state.activeTabId,
        documents: state.documents,
        documentsLastFetched: state.documentsLastFetched
      }),
    }
  )
);