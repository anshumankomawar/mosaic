import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { openDB, IDBPDatabase } from 'idb';
import { toast } from 'sonner';

// DB Configuration
const DB_VERSION = 1;
const DB_NAME = 'buffers-cache';
const STORE_NAME = 'buffers';
const META_STORE = 'metadata';

// Types
export interface Buffer {
  id: string;
  name: string;
  type: string;
  content: string;
  created_at: Date;
  updatedAt?: number;
}

interface BufferMeta {
  lastSyncTime: number;
  changeCount: number;
}

interface BufferState {
  buffers: Buffer[];
  buffersLastFetched: number | null;
  isLoading: boolean;
  currentAction: string | null;
  error: Error | null;
  
  // Buffer actions
  fetchBuffers: () => Promise<Buffer[]>;
  getBuffer: (id: string) => Promise<Buffer | undefined>;
  createBuffer: (buffer: Omit<Buffer, 'id' | 'created_at' | 'updatedAt'>) => Promise<string | null>;
  updateBuffer: (id: string, updates: Partial<Omit<Buffer, 'id' | 'created_at'>>) => Promise<boolean>;
  deleteBuffer: (id: string) => Promise<boolean>;
  
  // Cache operations
  refreshCache: () => Promise<Buffer[]>;
  clearCache: () => Promise<void>;
  getSyncStatus: () => Promise<{ lastSyncTime: number, pendingChanges: number }>;
  
  // State modifiers
  setLoading: (isLoading: boolean) => void;
  setCurrentAction: (action: string | null) => void;
  setError: (error: Error | null) => void;
  
  // Internal methods - not meant to be called from outside components
  _cacheBuffer: (buffer: Buffer) => Promise<void>;
  _updateBufferInCache: (buffer: Buffer) => Promise<void>;
}

class BufferDBService {
  private db: Promise<IDBPDatabase>;
  
  constructor() {
    this.db = this.initDatabase();
  }
  
  private async initDatabase() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('updatedAt', 'updatedAt');
        }
        
        if (!db.objectStoreNames.contains(META_STORE)) {
          const metaStore = db.createObjectStore(META_STORE, { keyPath: 'id' });
          metaStore.put({ id: 'sync_meta', lastSyncTime: 0, changeCount: 0 });
        }
      },
    });
  }
  
  async getAllBuffers(): Promise<Buffer[]> {
    const db = await this.db;
    return db.getAll(STORE_NAME);
  }
  
  async getBuffer(id: string): Promise<Buffer | undefined> {
    const db = await this.db;
    return db.get(STORE_NAME, id);
  }
  
  async cacheBuffer(buffer: Buffer): Promise<void> {
    const db = await this.db;
    await db.put(STORE_NAME, {
      ...buffer,
      updatedAt: Date.now()
    });
  }
  
  async deleteBuffer(id: string): Promise<void> {
    const db = await this.db;
    await db.delete(STORE_NAME, id);
  }
  
  async clearBuffers(): Promise<void> {
    const db = await this.db;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).clear();
    await tx.done;
  }
  
  async getSyncMeta(): Promise<BufferMeta> {
    const db = await this.db;
    return (await db.get(META_STORE, 'sync_meta')) || { lastSyncTime: 0, changeCount: 0 };
  }
  
  async updateSyncMeta(meta: Partial<BufferMeta>): Promise<void> {
    const db = await this.db;
    const currentMeta = await this.getSyncMeta();
    await db.put(META_STORE, {
      ...currentMeta,
      ...meta,
    });
  }
}

// Buffer service instance
const bufferDB = new BufferDBService();

// API functions
async function fetchBuffersFromAPI() {
  try {
    const token = await import('@/lib/stronghold').then(module => module.getToken());
    const response = await fetch("http://localhost:8000/secure/document", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch buffers: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Fetched buffers:", data.documents);
    return data.documents || [];
  } catch (error) {
    console.error("Error fetching buffers:", error);
    throw error;
  }
}

async function saveBufferToAPI(buffer: { title: string, content: string }) {
  try {
    const token = await import('@/lib/stronghold').then(module => module.getToken());
    console.log("Saving buffer:", buffer.title);
    console.log("Content length:", buffer.content);
    toast("saving...");
    const response = await fetch("http://localhost:8000/secure/document", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: buffer.title,
        file_content: buffer.content,
        file_type: "txt"
      }),
    });

    toast.dismiss();
    if (!response.ok) {
      throw new Error(`Failed to save buffer: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error saving buffer:", error);
    throw error;
  }
}

async function updateBufferInAPI(buffer: { documentId: string, title: string, content: string }) {
  try {
    const token = await import('@/lib/stronghold').then(module => module.getToken());
    console.log("Saving buffer:", buffer.title);
    console.log("Content length:", buffer.content);
    toast("updating...");
    const response = await fetch("http://localhost:8000/secure/document", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        document_id: buffer.documentId,
        name: buffer.title,
        file_content: buffer.content,
        file_type: "txt"
      }),
    });

    toast.dismiss();
    if (!response.ok) {
      throw new Error(`Failed to update buffer: ${response.status} ${response.statusText}`);
    }

    // Handle different response formats
    const text = await response.text();
    if (!text.trim()) {
      return { success: true };
    }
    
    try {
      return JSON.parse(text);
    } catch {
      return { message: text, success: true };
    }
  } catch (error) {
    console.error("Error updating buffer:", error);
    throw error;
  }
}

// Zustand store
export const useBufferStore = create<BufferState>()(
  persist(
    (set, get) => ({
      buffers: [],
      buffersLastFetched: null,
      isLoading: false,
      currentAction: null,
      error: null,
      
      setLoading: (isLoading) => set({ isLoading }),
      setCurrentAction: (action) => set({ currentAction: action }),
      setError: (error) => set({ error }),
      
      fetchBuffers: async () => {
        const { setLoading, setCurrentAction, setError } = get();
        
        setLoading(true);
        setCurrentAction("Fetching buffers");
        setError(null);
        
        try {
          const buffers = await fetchBuffersFromAPI();
          set({ buffers, buffersLastFetched: Date.now() });
          return buffers;
        } catch (error) {
          setError(error instanceof Error ? error : new Error(String(error)));
          return get().buffers;
        } finally {
          setLoading(false);
          setCurrentAction(null);
        }
      },
      
      getBuffer: async (id) => {
        // First check in-memory store
        const bufferInStore = get().buffers.find(buffer => buffer.id === id);
        if (bufferInStore) return bufferInStore;
        
        // Then check IndexedDB cache
        try {
          const buffer = await bufferDB.getBuffer(id);
          if (buffer) return buffer;
          
          // If not found, refresh buffers and look again
          await get().refreshCache();
          return get().buffers.find(buffer => buffer.id === id);
        } catch (error) {
          console.error(`Error getting buffer ${id}:`, error);
          return undefined;
        }
      },
      
      createBuffer: async (bufferData) => {
        const { setLoading, setCurrentAction, setError, _cacheBuffer } = get();
        
        setLoading(true);
        setCurrentAction("Creating buffer");
        setError(null);
        
        try {
          const response = await saveBufferToAPI({
            title: bufferData.name,
            content: bufferData.content
          });
          
          if (response && response.document_id) {
            const newBuffer: Buffer = {
              id: response.document_id,
              name: bufferData.name,
              type: bufferData.type,
              content: bufferData.content,
              created_at: new Date(),
              updatedAt: Date.now()
            };
            
            // Update store
            set(state => ({
              buffers: [...state.buffers, newBuffer]
            }));
            
            // Update cache
            await _cacheBuffer(newBuffer);
            
            return response.document_id;
          } else {
            throw new Error("Failed to create buffer: No document_id returned");
          }
        } catch (error) {
          setError(error instanceof Error ? error : new Error(String(error)));
          return null;
        } finally {
          setLoading(false);
          setCurrentAction(null);
        }
      },
      
      updateBuffer: async (id, updates) => {
        const { setLoading, setCurrentAction, setError, _updateBufferInCache } = get();
        const buffer = get().buffers.find(buffer => buffer.id === id);
        
        if (!buffer) {
          setError(new Error(`Buffer with ID ${id} not found`));
          return false;
        }
        
        setLoading(true);
        setCurrentAction("Updating buffer");
        setError(null);
        
        try {
          await updateBufferInAPI({
            documentId: id,
            title: updates.name || buffer.name,
            content: updates.content || buffer.content
          });
          
          // Create updated buffer object
          const updatedBuffer: Buffer = {
            ...buffer,
            ...updates,
            updatedAt: Date.now()
          };
          
          // Update store
          set(state => ({
            buffers: state.buffers.map(b => b.id === id ? updatedBuffer : b)
          }));
          
          // Update cache
          await _updateBufferInCache(updatedBuffer);
          
          return true;
        } catch (error) {
          setError(error instanceof Error ? error : new Error(String(error)));
          return false;
        } finally {
          setLoading(false);
          setCurrentAction(null);
        }
      },
      
      deleteBuffer: async (id) => {
        // Implementation would go here - keeping the API consistent
        // as you mentioned not to change the APIs
        return false;
      },
      
      refreshCache: async () => {
        const { setLoading, setCurrentAction, setError } = get();
        
        setLoading(true);
        setCurrentAction("Refreshing buffer cache");
        setError(null);
        
        try {
          // Fetch all buffers from API
          const buffers = await fetchBuffersFromAPI();
          
          // Clear existing cache
          await bufferDB.clearBuffers();
          
          // Cache all buffers
          for (const buffer of buffers) {
            await bufferDB.cacheBuffer({
              ...buffer,
              updatedAt: Date.now()
            });
          }
          
          // Update state
          set({
            buffers,
            buffersLastFetched: Date.now()
          });
          
          // Update sync metadata
          await bufferDB.updateSyncMeta({
            lastSyncTime: Date.now(),
            changeCount: 0
          });
          
          return buffers;
        } catch (error) {
          setError(error instanceof Error ? error : new Error(String(error)));
          return get().buffers;
        } finally {
          setLoading(false);
          setCurrentAction(null);
        }
      },
      
      clearCache: async () => {
        try {
          await bufferDB.clearBuffers();
        } catch (error) {
          console.error("Error clearing buffer cache:", error);
        }
      },
      
      getSyncStatus: async () => {
        try {
          const meta = await bufferDB.getSyncMeta();
          return {
            lastSyncTime: meta.lastSyncTime,
            pendingChanges: meta.changeCount
          };
        } catch (error) {
          console.error("Error getting sync status:", error);
          return {
            lastSyncTime: 0,
            pendingChanges: 0
          };
        }
      },
      
      _cacheBuffer: async (buffer) => {
        try {
          await bufferDB.cacheBuffer(buffer);
        } catch (error) {
          console.error(`Error caching buffer ${buffer.id}:`, error);
        }
      },
      
      _updateBufferInCache: async (buffer) => {
        try {
          await bufferDB.cacheBuffer(buffer);
        } catch (error) {
          console.error(`Error updating buffer ${buffer.id} in cache:`, error);
        }
      }
    }),
    {
      name: 'buffer-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        buffers: state.buffers,
        buffersLastFetched: state.buffersLastFetched
      }),
    }
  )
);
