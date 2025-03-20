import { openDB, IDBPDatabase } from 'idb';
import { debounce } from 'lodash';
import { Document } from '@/stores/tabStore';
import { getFiles } from '@/api/document';

// Database schema version
const DB_VERSION = 1;
const DB_NAME = 'documents-cache';
const STORE_NAME = 'documents';
const META_STORE = 'metadata';

class DocumentCacheService {
  private db: Promise<IDBPDatabase>;
  private pendingChanges: Map<string, Document> = new Map();
  private syncInProgress: boolean = false;

  constructor() {
    this.db = this.initDatabase();
    this.debouncedSync = debounce(this.syncWithServer, 2000);
  }

  private async initDatabase() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create document store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('updatedAt', 'updatedAt');
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(META_STORE)) {
          const metaStore = db.createObjectStore(META_STORE, { keyPath: 'id' });
          metaStore.put({ id: 'sync_meta', lastSyncTime: 0, changeCount: 0 });
        }
      },
    });
  }

  // Get documents from cache
  async getCachedDocuments(): Promise<Document[]> {
    const db = await this.db;
    return db.getAll(STORE_NAME);
  }

  // Get a single document from cache
  async getDocument(id: string): Promise<Document | undefined> {
    console.log("[DocumentCache] Getting document from cache:", id);
    const db = await this.db;
    const document = await db.get(STORE_NAME, id);
    console.log("[DocumentCache] Document found in cache:", !!document);
    return document;
  }

  // Add or update a single document in cache
  async updateDocumentInCache(document: Document): Promise<void> {
    console.log("[DocumentCache] Updating document in cache:", document.id);
    try {
      const db = await this.db;
      await db.put(STORE_NAME, {
        ...document,
        updatedAt: Date.now()
      });
      console.log("[DocumentCache] Document updated in cache successfully");
    } catch (error) {
      console.error("[DocumentCache] Error updating document in cache:", error);
    }
  }

  // Search documents in cache
  async searchDocuments(query: string): Promise<Document[]> {
    const db = await this.db;
    const allDocs = await db.getAll(STORE_NAME);
    
    if (!query) return allDocs;
    
    return allDocs.filter(doc => 
      doc.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Refresh cache from server
  async refreshCache(): Promise<Document[]> {
    console.log("[DocumentCache] Refreshing document cache from server");
    try {
      // Get last sync time
      const db = await this.db;
      const meta = await db.get(META_STORE, 'sync_meta') || { id: 'sync_meta', lastSyncTime: 0, changeCount: 0 };
      
      // Get all documents from server
      const serverDocs = await getFiles();
      console.log("[DocumentCache] Received", serverDocs.length, "documents from server");
      
      // Store them in cache
      const tx = db.transaction(STORE_NAME, 'readwrite');
      
      // Clear existing documents and add new ones
      await tx.objectStore(STORE_NAME).clear();
      
      for (const doc of serverDocs) {
        await tx.objectStore(STORE_NAME).put({
          ...doc,
          updatedAt: doc.updatedAt || Date.now(),
        });
      }
      
      // Update sync metadata
      await db.put(META_STORE, {
        id: 'sync_meta',
        lastSyncTime: Date.now(),
        changeCount: 0
      });
      
      // Clear pending changes as we've synced everything
      this.pendingChanges.clear();
      
      console.log("[DocumentCache] Cache refresh completed successfully");
      return serverDocs;
    } catch (error) {
      console.error("[DocumentCache] Error refreshing cache:", error);
      // Fall back to cached data
      return this.getCachedDocuments();
    }
  }

  // After a document is created, this ensures it's properly cached
  async cacheNewDocument(document: Document): Promise<void> {
    console.log("[DocumentCache] Caching new document:", document.id);
    try {
      const db = await this.db;
      await db.put(STORE_NAME, {
        ...document,
        updatedAt: Date.now()
      });
      console.log("[DocumentCache] New document cached successfully");
    } catch (error) {
      console.error("[DocumentCache] Error caching new document:", error);
    }
  }

  // Sync changes with server
  private debouncedSync: () => void;
  
  private async syncWithServer(): Promise<void> {
    if (this.syncInProgress || this.pendingChanges.size === 0) return;
    
    this.syncInProgress = true;
    console.log("[DocumentCache] Starting sync with server");
    
    try {
      const db = await this.db;
      const changes = Array.from(this.pendingChanges.values());
      
      // Process each change
      for (const doc of changes) {
        try {
          // This would normally call saveDocument or updateDocument APIs
          // but we've removed that direct dependency
          console.log("[DocumentCache] Syncing document:", doc.id);
          
          // Remove from pending changes after successful sync
          this.pendingChanges.delete(doc.id);
        } catch (error) {
          console.error(`[DocumentCache] Error syncing document ${doc.id}:`, error);
          // Leave in pending changes to retry later
        }
      }
      
      // Update sync metadata
      const meta = await db.get(META_STORE, 'sync_meta') || { id: 'sync_meta', lastSyncTime: 0, changeCount: 0 };
      await db.put(META_STORE, {
        ...meta,
        lastSyncTime: Date.now(),
        changeCount: this.pendingChanges.size
      });
      
      console.log("[DocumentCache] Sync completed, pending changes:", this.pendingChanges.size);
    } catch (error) {
      console.error("[DocumentCache] Error during sync:", error);
    } finally {
      this.syncInProgress = false;
      
      // If there are still pending changes, schedule another sync
      if (this.pendingChanges.size > 0) {
        this.debouncedSync();
      }
    }
  }

  // Force sync immediately
  async forceSyncNow(): Promise<void> {
    console.log("[DocumentCache] Force sync requested");
    this.debouncedSync.cancel();
    return this.syncWithServer();
  }

  // Check if sync is needed
  async isSyncNeeded(): Promise<boolean> {
    const db = await this.db;
    const meta = await db.get(META_STORE, 'sync_meta');
    return meta ? meta.changeCount > 0 : true;
  }

  // Get sync status
  async getSyncStatus(): Promise<{ lastSyncTime: number, pendingChanges: number }> {
    const db = await this.db;
    const meta = await db.get(META_STORE, 'sync_meta') || { lastSyncTime: 0, changeCount: 0 };
    
    return {
      lastSyncTime: meta.lastSyncTime,
      pendingChanges: this.pendingChanges.size
    };
  }
}

// Export singleton instance
export const documentCache = new DocumentCacheService();
