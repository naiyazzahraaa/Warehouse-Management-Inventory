import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { firestore, COLLECTIONS } from './firebase';
import { InventoryItem, Transaction, CloudSyncStatus, SyncInfo } from '../types';

type SyncListener = (info: SyncInfo) => void;
type DataChangeListener = () => void;

class CloudSyncService {
  private status: CloudSyncStatus = 'connecting';
  private lastSyncedAt: Date | null = null;
  private errorMessage?: string;
  private itemsUnsubscribe: Unsubscribe | null = null;
  private transactionsUnsubscribe: Unsubscribe | null = null;
  private syncListeners: Set<SyncListener> = new Set();
  private dataChangeListeners: Set<DataChangeListener> = new Set();
  private isInitialSyncDone = false;
  private isProcessingRemoteSnapshot = false;

  constructor() {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
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

  private notifyDataChanges(): void {
    this.dataChangeListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[CloudSync] Data change listener error:', e);
      }
    });
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
      this.initRealtimeListeners();
    }
  }

  /**
   * Start real-time multi-device Firestore synchronization using streaming onSnapshot() listeners.
   * Completely avoids stale client cache and static getDocs calls so every device receives live updates immediately.
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
          if (this.isProcessingRemoteSnapshot) return;
          this.isProcessingRemoteSnapshot = true;

          try {
            if (snapshot.empty && !this.isInitialSyncDone) {
              // Brand new cloud database instance: seed local default catalog
              this.isInitialSyncDone = true;
              const seedItems = localItemsProvider();
              if (seedItems.length > 0) {
                console.log('[CloudSync] Firestore items collection is empty. Seeding initial data...');
                await this.pushInitialDataToCloud(seedItems, localTransactionsProvider());
                return;
              }
            }

            this.isInitialSyncDone = true;
            const remoteItems: InventoryItem[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as InventoryItem;
              if (data && data.id) {
                remoteItems.push(data);
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
          } finally {
            this.isProcessingRemoteSnapshot = false;
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
      const txQuery = query(txCol, orderBy('transaction_date', 'desc'), limit(300));
      
      this.transactionsUnsubscribe = onSnapshot(
        txQuery,
        async (snapshot) => {
          try {
            const remoteTxs: Transaction[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as Transaction;
              if (data && data.id) {
                remoteTxs.push(data);
              }
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
          console.warn('[CloudSync] Transactions onSnapshot with orderBy warning, falling back to base collection:', err);
          this.fallbackTransactionsListener(onRemoteTransactionUpdate);
        }
      );

    } catch (err: any) {
      console.error('[CloudSync] Failed to initialize real-time cloud sync:', err);
      this.status = 'offline';
      this.errorMessage = err?.message || 'Gagal terhubung ke Cloud Database';
      this.notifySyncInfo();
    }
  }

  private fallbackTransactionsListener(onRemoteTransactionUpdate: (txs: Transaction[]) => Promise<void>) {
    try {
      const txCol = collection(firestore, COLLECTIONS.TRANSACTIONS);
      this.transactionsUnsubscribe = onSnapshot(
        txCol,
        async (snapshot) => {
          try {
            const remoteTxs: Transaction[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as Transaction;
              if (data && data.id) {
                remoteTxs.push(data);
              }
            });
            remoteTxs.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
            await onRemoteTransactionUpdate(remoteTxs.slice(0, 300));

            this.lastSyncedAt = new Date();
            this.status = 'synced';
            this.notifySyncInfo();
            this.notifyDataChanges();
          } catch (e) {
            console.error('[CloudSync] Fallback transactions handler error:', e);
          }
        },
        (err) => {
          console.warn('[CloudSync] Fallback base transactions listener warning:', err);
        }
      );
    } catch (e) {
      console.error('[CloudSync] Error setting up fallback listener:', e);
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
    return onSnapshot(itemsCol, (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as InventoryItem;
        if (item && item.id) items.push(item);
      });
      onUpdate(items);
    });
  }

  /**
   * Direct real-time streaming listener for Transactions
   */
  listenToTransactions(onUpdate: (txs: Transaction[]) => void): Unsubscribe {
    const txCol = collection(firestore, COLLECTIONS.TRANSACTIONS);
    const txQuery = query(txCol, orderBy('transaction_date', 'desc'), limit(300));
    return onSnapshot(
      txQuery,
      (snapshot) => {
        const txs: Transaction[] = [];
        snapshot.forEach((d) => {
          const tx = d.data() as Transaction;
          if (tx && tx.id) txs.push(tx);
        });
        onUpdate(txs);
      },
      () => {
        // Fallback without orderBy
        return onSnapshot(txCol, (snap) => {
          const txs: Transaction[] = [];
          snap.forEach((d) => {
            const tx = d.data() as Transaction;
            if (tx && tx.id) txs.push(tx);
          });
          txs.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
          onUpdate(txs);
        });
      }
    );
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
        batch.set(ref, item);
      }

      for (const tx of transactions.slice(0, 50)) {
        const ref = doc(firestore, COLLECTIONS.TRANSACTIONS, tx.id);
        batch.set(ref, tx);
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

      const ref = doc(firestore, COLLECTIONS.ITEMS, item.id);
      await setDoc(ref, item);

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to sync item to cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
    }
  }

  async syncDeleteItemFromCloud(itemId: string): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();

      const ref = doc(firestore, COLLECTIONS.ITEMS, itemId);
      await deleteDoc(ref);

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to delete item from cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
    }
  }

  async syncTransactionToCloud(tx: Transaction): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();

      const ref = doc(firestore, COLLECTIONS.TRANSACTIONS, tx.id);
      await setDoc(ref, tx);

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to sync transaction to cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
    }
  }

  async syncDeleteTransactionFromCloud(txId: string): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();

      const ref = doc(firestore, COLLECTIONS.TRANSACTIONS, txId);
      await deleteDoc(ref);

      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notifySyncInfo();
    } catch (err: any) {
      console.error('[CloudSync] Failed to delete transaction from cloud:', err);
      this.status = 'offline';
      this.notifySyncInfo();
    }
  }

  async syncBatchItemsToCloud(items: InventoryItem[]): Promise<void> {
    try {
      this.status = 'syncing';
      this.notifySyncInfo();

      // Chunk in groups of 400 for Firestore batch size limit
      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);
        for (const it of chunk) {
          const ref = doc(firestore, COLLECTIONS.ITEMS, it.id);
          batch.set(ref, it);
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

  private initRealtimeListeners() {
    this.status = 'synced';
    this.notifySyncInfo();
  }
}

export const cloudSync = new CloudSyncService();

