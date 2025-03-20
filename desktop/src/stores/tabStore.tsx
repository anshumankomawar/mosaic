import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { debounce } from 'lodash';
import { useBufferStore } from '@/stores/bufferStore';
import { toast } from 'sonner';

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
  bufferId?: string;
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
  isLoading: boolean;
  currentAction: string | null;
  error: Error | null;
  
  // Tab management
  createTab: (
    title?: string, 
    content?: string,
    bufferId?: string | null,
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
  
  // Editor state
  updateEditorState: (id: string, updates: Partial<EditorState>) => void;
  updateActiveEditorState: (updates: Partial<EditorState>) => void;
  getEditorState: (id: string) => EditorState | undefined;
  setFormatState: (id: string, formats: Partial<EditorState['activeFormats']>) => void;
  
  // Content management
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
  
  // Buffer integration
  openBufferInTab: (
    bufferId: string, 
    onSuccess?: (tabId: string) => void,
    onError?: (error: Error) => void
  ) => Promise<string | null>;
  
  // State management
  setLoading: (isLoading: boolean) => void;
  setCurrentAction: (action: string | null) => void;
  setError: (error: Error | null) => void;
  updateTabBufferId: (tabId: string, bufferId: string) => void;
  
  // Ensure default tab
  ensureActiveTab: () => void;
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => {
      const debouncedSave = debounce(
        async (tabToSave: Tab) => {
          const bufferStore = useBufferStore.getState();
          try {
            const { id, title, content, bufferId } = tabToSave;
            
            set(state => ({
              tabs: state.tabs.map(tab => 
                tab.id === id ? { ...tab, pendingSave: true } : tab
              )
            }));
            
            if (bufferId) {
              // Update existing buffer
              await bufferStore.updateBuffer(bufferId, {
                name: title,
                content
              });
              
              toast.success("Buffer updated successfully");
            } else {
              // Create new buffer
              const newBufferId = await bufferStore.createBuffer({
                name: title,
                content,
                type: "txt"
              });
              
              if (newBufferId) {
                get().updateTabBufferId(id, newBufferId);
                toast.success("Buffer created successfully");
              } else {
                throw new Error("Failed to create buffer");
              }
            }
            
            // Remove pending save flag and error flag if exists
            set(state => ({
              tabs: state.tabs.map(tab => 
                tab.id === id ? { 
                  ...tab, 
                  pendingSave: false, 
                  saveError: false 
                } : tab
              )
            }));
          } catch (error) {
            console.error(`[TabStore] Error saving tab ${tabToSave.id}:`, error);
            toast.error("Failed to save buffer");
            
            set(state => ({
              tabs: state.tabs.map(tab => 
                tab.id === tabToSave.id ? { 
                  ...tab, 
                  pendingSave: false, 
                  saveError: true 
                } : tab
              )
            }));
            
            get().setError(error instanceof Error ? error : new Error(String(error)));
          }
        }, 
        5000,
        { leading: false, trailing: true }
      );
      
      // Helper to create a default tab
      const createDefaultTab = (): Tab => {
        const id = nanoid();
        const now = Date.now();
        
        return {
          id,
          title: 'Untitled',
          content: '<h1></h1><p></p>',
          createdAt: now,
          updatedAt: now,
          editorState: createDefaultEditorState()
        };
      };

      return {
        tabs: [],
        activeTabId: null,
        isLoading: false,
        currentAction: null,
        error: null,
        
        setLoading: (isLoading) => set({ isLoading }),
        setCurrentAction: (action) => set({ currentAction: action }),
        setError: (error) => set({ error }),
        
        // Ensure there's always an active tab
        ensureActiveTab: () => {
          const { tabs, activeTabId } = get();
          
          // If there are no tabs, create a default one
          if (tabs.length === 0) {
            const defaultTab = createDefaultTab();
            set({
              tabs: [defaultTab],
              activeTabId: defaultTab.id
            });
            
            // Trigger save of the default tab
            setTimeout(() => {
              debouncedSave(defaultTab);
            }, 0);
            
            return;
          }
          
          // If there are tabs but no active tab, set the first one as active
          if (tabs.length > 0 && !activeTabId) {
            set({ activeTabId: tabs[0].id });
          }
        },
        
        updateTabBufferId: (tabId, bufferId) => {
          set(state => ({
            tabs: state.tabs.map(tab => 
              tab.id === tabId ? { ...tab, bufferId } : tab
            )
          }));
        },
        
        createTab: (
          title = 'Untitled', 
          content = '<h1></h1><p></p>', 
          bufferId = null,
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
            editorState: createDefaultEditorState(),
            bufferId: bufferId || undefined
          };
        
          set(state => ({
            tabs: [...state.tabs, newTab],
            activeTabId: id
          }));
        
          onSuccess?.(id);
          
          // If no bufferId provided, save it as a new buffer
          if (!bufferId) {
            const updatedTab = get().tabs.find(tab => tab.id === id);
            if (updatedTab) {
              debouncedSave(updatedTab);
            }
          }
          
          return id;
        },
        
        updateTab: (id, updates, onSuccess, onError) => {
          const currentTab = get().tabs.find(tab => tab.id === id);
          if (!currentTab) {
            const error = new Error(`Tab with ID ${id} not found`);
            get().setError(error);
            onError?.(error);
            return;
          }

          const updatedTab = { 
            ...currentTab, 
            ...updates, 
            updatedAt: Date.now()
          };

          set(state => ({
            tabs: state.tabs.map(tab => 
              tab.id === id ? { ...tab, ...updates, updatedAt: Date.now() } : tab
            )
          }));

          // Only save if content or title changed
          if (updates.content || updates.title) {
            debouncedSave(updatedTab);
          }

          onSuccess?.();
        },
        
        deleteTab: (id, onSuccess, onError) => {
          const { tabs, activeTabId } = get();
          
          // Don't allow deleting the only tab
          if (tabs.length <= 1) {
            console.log("[TabStore] Cannot delete the only tab");
            onError?.(new Error("Cannot delete the only tab"));
            return;
          }
          
          const filteredTabs = tabs.filter(tab => tab.id !== id);
        
          let newActiveId = activeTabId;
          if (activeTabId === id) {
            const idx = tabs.findIndex(tab => tab.id === id);
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
          
          // After deleting, ensure there's an active tab
          setTimeout(() => {
            get().ensureActiveTab();
          }, 0);

          onSuccess?.();
        },
        
        setActiveTab: (id, onSuccess, onError) => {
          const { tabs } = get();
          
          const newActiveTab = tabs.find(tab => tab.id === id);
          if (!newActiveTab) {
            const error = new Error(`Tab with ID ${id} not found`);
            get().setError(error);
            onError?.(error);
            return;
          }

          set({ activeTabId: id });
          onSuccess?.();
        },
        
        getActiveTab: () => {
          const { tabs, activeTabId } = get();
          
          // If there's no active tab but there are tabs, return the first one
          if (!activeTabId && tabs.length > 0) {
            return tabs[0];
          }
          
          return tabs.find(tab => tab.id === activeTabId);
        },
        
        updateEditorState: (id, updates) => {
          set(state => ({
            tabs: state.tabs.map(tab => 
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
          const activeTab = get().getActiveTab();
          if (activeTab) {
            get().updateEditorState(activeTab.id, updates);
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
          const activeTab = get().getActiveTab();
          if (activeTab) {
            get().updateTab(activeTab.id, { content }, onSuccess, onError);
          } else {
            const error = new Error("No active tab");
            get().setError(error);
            onError?.(error);
          }
        },
        
        getTitle: () => {
          const activeTab = get().getActiveTab();
          return activeTab?.title || 'Untitled';
        },
        
        setTitle: (title, onSuccess, onError) => {
          const activeTab = get().getActiveTab();
          if (activeTab) {
            get().updateTab(activeTab.id, { title }, onSuccess, onError);
          } else {
            const error = new Error("No active tab");
            get().setError(error);
            onError?.(error);
          }
        },
        
        openBufferInTab: async (
          bufferId, 
          onSuccess, 
          onError
        ) => {
          const bufferStore = useBufferStore.getState();
          const { setLoading, setCurrentAction, setError, createTab, setActiveTab } = get();
          
          setLoading(true);
          setCurrentAction(`Opening buffer ${bufferId}`);
          
          try {
            // Get buffer from store
            const buffer = await bufferStore.getBuffer(bufferId);
            
            if (!buffer) {
              throw new Error(`Buffer with ID ${bufferId} not found`);
            }
            
            // Create a new tab with buffer
            const tabId = createTab(
              buffer.name,
              buffer.content,
              buffer.id,
              createdTabId => {
                setActiveTab(createdTabId);
                onSuccess?.(createdTabId);
              },
              onError
            );
            
            return tabId;
          } catch (error) {
            setError(error instanceof Error ? error : new Error(String(error)));
            onError?.(error instanceof Error ? error : new Error(String(error)));
            return null;
          } finally {
            setLoading(false);
            setCurrentAction(null);
          }
        }
      };
    },
    {
      name: 'tab-store',
      partialize: (state) => ({
        tabs: state.tabs.map(tab => ({
          ...tab,
          editorState: {
            ...tab.editorState,
            selection: null,
          }
        })),
        activeTabId: state.tabs.length > 0 ? state.tabs[0].id : null
      }),
      onRehydrateStorage: (state) => {
        return (rehydratedState, error) => {
          if (error) {
            console.error('Error rehydrating tab store:', error);
          }
          
          // After rehydration, ensure there's an active tab
          if (rehydratedState) {
            setTimeout(() => {
              rehydratedState.ensureActiveTab();
            }, 0);
          }
        };
      }
    }
  )
);

// Add the init hook to ensure there's always an active tab
if (typeof window !== 'undefined') {
  // Run on next tick to ensure the store is initialized
  setTimeout(() => {
    useTabStore.getState().ensureActiveTab();
  }, 0);
}
