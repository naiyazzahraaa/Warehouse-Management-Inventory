import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  limit, 
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { firestore, COLLECTIONS } from './firebase';
import { InventoryItem, Transaction, CloudSyncStatus, SyncInfo } from '../types';

type SyncListener = (info: SyncInfo) => void;
type DataChangeListener = () => void;

/**
 * Helper to strip undefined values recursively so Firestore setDoc / writeBatch never throws
 * "Unsupported field value: undefined"
 */
export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        cleaned[key] = cleanForFirestore(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

class CloudSyncService {
  private status: CloudSyncStatus = 'connecting';
  private lastSyncedAt: Date | null = null;
  private errorMessage?: string;
  private itemsUnsubscribe: Unsubscribe | null = null;
  private transactionsUnsubscribe: Unsubscribe | null = null;
  private syncListeners: Set<SyncListener> = new Set();
  private dataChangeListeners: Set<DataChangeListener> = new Set();
  private isInitialSyncDone = false;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Instant cross-tab communication on the same device
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('warehouse_inventory_sync');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'DATA_MUTATED') {
              this.notifyDataChanges();
            }
          };
        } catch (e) {
          console.warn('[CloudSync] BroadcastChannel not available:', e);
        }
      }
    }
  }

  // Subscribe to sync state changes (for UI badge, status indicators)
  subscribeSyncInfo(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    listener(this.getSyncInfo());
    return () => this.syncListeners.delete(listener);
  }

  // Subscribe to data changes (when another device modifies items/transactions)
  subscribeDataChanges(listener: DataChangeListener): () => void {
    this.dataChangeListeners.add(listener);
    return () => this.dataChangeListeners.delete(listener);
  }

  private notifySyncInfo(): void {
    const info = this.getSyncInfo();
    this.syncListeners.forEach((fn) => {
      try {
        fn(info);
      } catch (e) {
        console.error('[CloudSync] Sync listener error:', e);
      }
    });
  }

  notifyDataChanges(): void {
    this.dataChangeListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[CloudSync] Data change listener error:', e);
      }
    });
  }

  broadcastLocalMutation(): void {
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'DATA_MUTATED', timestamp: Date.now() });
      }
    } catch (e) {
      console.warn('[CloudSync] Broadcast error:', e);
    }
  }

  getSyncInfo(): SyncInfo {
    return {
      status: this.status,
      lastSyncedAt: this.lastSyncedAt,
      itemsCount: 0,
      txCount: 0,
      errorMessage: this.errorMessage,
    };
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.status = 'offline';
      this.notifySyncInfo();
    } else {
      this.status = 'syncing';
      this.notifySyncInfo();
    }
  }

  /**
   * Start real-time multi-device Firestore synchronization using streaming onSnapshot() listeners.
   * Ensures every device and browser tab receives live updates immediately.
   */
  async startSync(
    localItemsProvider: () => InventoryItem[],
    localTransactionsProvider: () => Transaction[],
    onRemoteItemUpdate: (items: InventoryItem[]) => Promise<void>,
    onRemoteItemDelete: (itemIds: string[]) => Promise<void>,
    onRemoteTransactionUpdate: (txs: Transaction[]) => Promise<void>
  ): Promise<void> {
    if (typeof window === 'undefined') return;

    // Clean up any existing listeners before attaching fresh ones
    this.unsubscribeAll();

    try {
      this.status = 'syncing';
      this.notifySyncInfo();

      // 1. Real-Time Streaming Listener on Items Collection (onSnapshot)
      const itemsCol = collection(firestore, COLLECTIONS.ITEMS);
      this.itemsUnsubscribe = onSnapshot(
        itemsCol,
        async (snapshot) => {
          try {
            this.isInitialSyncDone = true;
            const remoteItems: InventoryItem[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as InventoryItem;
              if (data) {
                remoteItems.push({
                  ...data,
                  id: data.id || d.id,
                });
              }
            });

            const removedItemIds = snapshot
              .docChanges()
              .filter((change) => change.type === 'removed')
              .map((change) => change.doc.id);

            await onRemoteItemUpdate(remoteItems);

            if (removedItemIds.length > 0) {
              await onRemoteItemDelete(removedItemIds);
            }

            this.lastSyncedAt = new Date();
            this.status = 'synced';
            this.errorMessage = undefined;
            this.notifySyncInfo();
            this.notifyDataChanges();
          } catch (err: any) {
            console.error('[CloudSync] Error in items onSnapshot handler:', err);
          }
        },
        (err) => {
          console.warn('[CloudSync] Items onSnapshot listener warning:', err);
          this.status = 'offline';
          this.errorMessage = err?.message || 'Koneksi Firestore terganggu';
          this.notifySyncInfo();
        }
      );

      // 2. Real-Time Streaming Listener on Transactions Collection (onSnapshot)
      const txCol = collection(firestore, COLLECTIONS.TRANSACTIONS);
      const txQuery = query(txCol, limit(1000));
      
      this.transactionsUnsubscribe = onSnapshot(
        txQuery,
        async (snapshot) => {
          try {
            const remoteTxs: Transaction[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as Transaction;
              if (data) {
                remoteTxs.push({
                  ...data,
                  id: data.id || d.id,
                });
              }
            });

            // In-memory sort by transaction date descending
            remoteTxs.sort((a, b) => {
              const dateA = new Date(a.transaction_date || a.created_at || 0).getTime();
              const dateB = new Date(b.transaction_date || b.created_at || 0).getTime();
              return dateB - dateA;
            });

            await onRemoteTransactionUpdate(remoteTxs);

            this.lastSyncedAt = new Date();
            this.status = 'synced';
            this.notifySyncInfo();
            this.notifyDataChanges();
          } catch (err: any) {
            console.error('[CloudSync] Error in transactions onSnapshot handler:', err);
          }
        },
        (err) => {
          console.warn('[CloudSync] Transactions onSnapshot listener warning:', err);
        }
      );

    } catch (err: any) {
      console.error('[CloudSync] Failed to initialize real-time cloud sync:', err);
      this.status = 'offline';
      this.errorMessage = err?.message || 'Gagal terhubung ke Cloud Database';
      this.notifySyncInfo();
    }
  }

  /**
   * Clean up and unsubscribe all active Firestore real-time streaming listeners.
   */
  unsubscribeAll(): void {
    if (this.itemsUnsubscribe) {
      this.itemsUnsubscribe();
      this.itemsUnsubscribe = null;
    }
    if (this.transactionsUnsubscribe) {
      this.transactionsUnsubscribe();
      this.transactionsUnsubscribe = null;
    }
  }

  /**
   * Direct real-time streaming listener for Inventory Items
   */
  listenToItems(onUpdate: (items: InventoryItem[]) => void): Unsubscribe {
    const itemsCol = collection(firestore, COLLECTIONS.ITEMS);
    return onSnapshot(itemsCol, { includeMetadataChanges: false }, (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as InventoryItem;
        if (item) items.push({ ...item, id: item.id || d.id });
      });
      onUpdate(items);
    });
  }

  /**
   * Direct real-time streaming listener for Transactions
   */
  listenToTransactions(onUpdate: (txs: Transaction[]) => void): Unsubscribe {
    const txCol = collection(firestore, COLLECTIONS.TRANSACTIONS);
    const txQuery = query(txCol, limit(500));
    return onSnapshot(txQuery, { includeMetadataChanges: false }, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((d) => {
        const tx = d.data() as Transaction;
        if (tx) txs.push({ ...tx, id: tx.id || d.id });
      });
      txs.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
      onUpdate(txs);
    });
  }

  // Initial cloud seed
  private async pushInitialDataToCloud(
    items: InventoryItem[],
    transactions: Transaction[]
  ): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      
      // Seed up to 300 initial items in batch to stay within Firestore 500 limit
      const itemsToSeed = items.slice(0, 300);
      for (const item of itemsToSeed) {
        const ref = doc(firestore, COLLECTIONS.ITEMS, item.id);
        batch.set(ref, cleanForFirestore(item));
      }

      for (const tx of transactions.slice(0, 50)) {
        const ref = doc(firestore, COLLECTIONS.TRANSACTIONS, tx.id);
        batch.set(ref, cleanForFirestore(tx));
      }

      await batch.commit();
      console.log(`[CloudSync] Seeded ${itemsToSeed.length} items to cloud database successfully.`);
    } catch (e) {
      console.error('[CloudSync] Failed to push initial data to cloud:', e);
    }
  }

  // --- Real-Time Push Handlers ---

  async syncItemToCloud(item: InventoryItem): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();
      this.broadcastLocalMutation();

      const ref = doc(firestore, COLLECTIONS.ITEMS, item.id);
      await setDoc(ref, cleanForFirestore(item));

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to sync item to cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
      throw err;
    }
  }

  async syncDeleteItemFromCloud(itemId: string): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();
      this.broadcastLocalMutation();

      const ref = doc(firestore, COLLECTIONS.ITEMS, itemId);
      await deleteDoc(ref);

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to delete item from cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
      throw err;
    }
  }

  async syncTransactionToCloud(tx: Transaction): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();
      this.broadcastLocalMutation();

      const ref = doc(firestore, COLLECTIONS.TRANSACTIONS, tx.id);
      await setDoc(ref, cleanForFirestore(tx));

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to sync transaction to cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
      throw err;
    }
  }

  async syncDeleteTransactionFromCloud(txId: string): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();
      this.broadcastLocalMutation();

      const ref = doc(firestore, COLLECTIONS.TRANSACTIONS, txId);
      await deleteDoc(ref);

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to delete transaction from cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
      throw err;
    }
  }

  async syncBatchItemsToCloud(items: InventoryItem[]): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();
      this.broadcastLocalMutation();

      // Chunk in groups of 400 for Firestore batch size limit
      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);
        for (const it of chunk) {
          const ref = doc(firestore, COLLECTIONS.ITEMS, it.id);
          batch.set(ref, cleanForFirestore(it));
        }
        await batch.commit();
      }

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to sync batch items to cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
    }
  }
}

export const cloudSync = new CloudSyncService();

