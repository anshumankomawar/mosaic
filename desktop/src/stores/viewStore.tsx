// src/stores/viewStore.ts
import { create } from 'zustand';

// Define all possible views/pages in your application
export enum View {
  LOGIN = 'login',
  REGISTER = 'register',
  HOME = 'home',
  GENERATE = 'generate',
  SEARCH = 'search',
  SETTINGS = 'settings',
}

// Interface for a history entry
interface HistoryEntry {
  view: View;
  params: Record<string, any>;
}

// Define the shape of the store
interface ViewState {
  currentView: View;
  viewParams: Record<string, any>; // For passing parameters between views
  history: HistoryEntry[]; // Full history stack
  historyIndex: number; // Current position in history
  
  // Navigation methods
  setView: (view: View, params?: Record<string, any>) => void;
  goBack: () => boolean;
  goForward: () => boolean;
  resetHistory: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
}

// Maximum size of history stack to prevent memory issues
const MAX_HISTORY_SIZE = 50;

// Create the store
export const useViewStore = create<ViewState>((set, get) => ({
  currentView: View.HOME, // Default view
  viewParams: {},
  history: [{ view: View.HOME, params: {} }], // Initialize with home page
  historyIndex: 0,
  
  // Navigate to a new view
  setView: (view, params = {}) => set((state) => {
    // Special handling for auth pages (login/register)
    // Reset history for these pages when navigating to them due to auth issues
    if ((view === View.LOGIN || view === View.REGISTER) && params.authRequired === true) {
      return {
        currentView: view,
        viewParams: params,
        history: [{ view, params }],
        historyIndex: 0
      };
    }
    
    // Create the new history entry
    const newEntry = { view, params };
    
    // Remove any forward history when navigating to a new page
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    
    // Add the new entry to history
    newHistory.push(newEntry);
    
    // Trim history if it exceeds max size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }
    
    return { 
      currentView: view,
      viewParams: params,
      history: newHistory,
      historyIndex: newHistory.length - 1
    };
  }),
  
  // Go back to previous page in history
  goBack: () => {
    const state = get();
    
    if (!state.canGoBack()) {
      return false;
    }
    
    const newIndex = state.historyIndex - 1;
    const entry = state.history[newIndex];
    
    set({
      currentView: entry.view,
      viewParams: entry.params,
      historyIndex: newIndex
    });
    
    return true;
  },
  
  // Go forward to next page in history
  goForward: () => {
    const state = get();
    
    if (!state.canGoForward()) {
      return false;
    }
    
    const newIndex = state.historyIndex + 1;
    const entry = state.history[newIndex];
    
    set({
      currentView: entry.view,
      viewParams: entry.params,
      historyIndex: newIndex
    });
    
    return true;
  },
  
  // Reset history to just the current page
  resetHistory: () => set((state) => ({
    history: [{ view: state.currentView, params: state.viewParams }],
    historyIndex: 0
  })),
  
  // Check if we can go back
  canGoBack: () => {
    const state = get();
    return state.historyIndex > 0;
  },
  
  // Check if we can go forward
  canGoForward: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  }
}));

// Export a hook to easily access navigation functions
export const useNavigation = () => {
  const viewStore = useViewStore();
  
  return {
    currentView: viewStore.currentView,
    viewParams: viewStore.viewParams,
    navigate: viewStore.setView,
    goBack: viewStore.goBack,
    goForward: viewStore.goForward,
    canGoBack: viewStore.canGoBack(),
    canGoForward: viewStore.canGoForward(),
    resetHistory: viewStore.resetHistory
  };
};

export default useViewStore;
