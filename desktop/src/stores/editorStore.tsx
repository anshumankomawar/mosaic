import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Type for editor state 
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

// Interface for the entire editor store
interface EditorStoreState {
  // Document content state
  documentTitle: string;
  documentHTML: string;
  documentPlainText: string;
  
  // Active tab tracking
  activeTabId: string | null;
  
  // Tab-specific editor states
  editorStates: Record<string, EditorState>;
  
  // Document content setters
  setDocumentTitle: (title: string) => void;
  setDocumentHTML: (html: string) => void;
  setDocumentPlainText: (text: string) => void;
  
  // Tab management
  setActiveTabId: (id: string | null) => void;
  
  // Editor state management
  getEditorState: (tabId: string) => EditorState;
  updateEditorState: (tabId: string, updates: Partial<EditorState>) => void;
  
  // Convenience methods for active tab
  updateActiveEditorState: (updates: Partial<EditorState>) => void;
  getActiveEditorState: () => EditorState | undefined;
  
  // Specialized editor operations
  setScrollPosition: (tabId: string, position: number) => void;
  setCursorPosition: (tabId: string, position: number) => void;
  setSelection: (tabId: string, from: number, to: number) => void;
  clearSelection: (tabId: string) => void;
  setActiveFormats: (tabId: string, formats: Partial<EditorState['activeFormats']>) => void;
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

const useEditorStore = create<EditorStoreState>()(
  persist(
    (set, get) => ({
      // Document content state
      documentTitle: '',
      documentHTML: '<h1></h1><p></p>',
      documentPlainText: '',
      
      // Active tab tracking
      activeTabId: null,
      
      // Tab-specific editor states
      editorStates: {},
      
      // Document content setters
      setDocumentTitle: (title) => set({ documentTitle: title }),
      setDocumentHTML: (html) => set({ documentHTML: html }),
      setDocumentPlainText: (text) => set({ documentPlainText: text }),
      
      // Tab management
      setActiveTabId: (id) => set({ activeTabId: id }),
      
      // Editor state management
      getEditorState: (tabId) => {
        const { editorStates } = get();
        return editorStates[tabId] || createDefaultEditorState();
      },
      
      updateEditorState: (tabId, updates) => {
        // Prevent unnecessary state updates by checking if values actually changed
        const currentState = get().getEditorState(tabId);
        let hasChanges = false;
        
        // Check each property to see if it changed
        for (const key in updates) {
          if (JSON.stringify(currentState[key]) !== JSON.stringify(updates[key])) {
            hasChanges = true;
            break;
          }
        }
        
        // Only update state if something changed
        if (hasChanges) {
          set((state) => ({
            editorStates: {
              ...state.editorStates,
              [tabId]: {
                ...currentState,
                ...updates
              }
            }
          }));
        }
      },
      
      // Convenience methods for active tab
      updateActiveEditorState: (updates) => {
        const { activeTabId } = get();
        if (activeTabId) {
          get().updateEditorState(activeTabId, updates);
        }
      },
      
      getActiveEditorState: () => {
        const { activeTabId, editorStates } = get();
        return activeTabId ? editorStates[activeTabId] : undefined;
      },
      
      // Specialized editor operations
      setScrollPosition: (tabId, position) => {
        get().updateEditorState(tabId, { scrollPosition: position });
      },
      
      setCursorPosition: (tabId, position) => {
        // get().updateEditorState(tabId, { cursorPosition: position });
      },
      
      setSelection: (tabId, from, to) => {
        get().updateEditorState(tabId, { selection: { from, to } });
      },
      
      clearSelection: (tabId) => {
        get().updateEditorState(tabId, { selection: null });
      },
      
      setActiveFormats: (tabId, formats) => {
        const currentEditorState = get().getEditorState(tabId);
        get().updateEditorState(tabId, { 
          activeFormats: { 
            ...currentEditorState.activeFormats, 
            ...formats 
          } 
        });
      }
    }),
    {
      name: 'editor-store',
      partialize: (state) => ({
        documentTitle: state.documentTitle,
        documentHTML: state.documentHTML,
        documentPlainText: state.documentPlainText,
        activeTabId: state.activeTabId,
        // Only persist necessary editor state
        editorStates: Object.entries(state.editorStates).reduce((acc, [tabId, state]) => {
          acc[tabId] = {
            ...state,
            // Don't persist selection as it might be invalid when reopening
            selection: null
          };
          return acc;
        }, {} as Record<string, EditorState>)
      }),
    }
  )
);

export default useEditorStore;
