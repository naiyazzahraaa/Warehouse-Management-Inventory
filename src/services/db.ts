import { InventoryItem, Transaction, TransactionType, CsvItemRow, StockSummary, LowStockActionStatus } from '../types';
import { cloudSync } from './cloudSync';
import { formatUnit } from '../utils/units';
import { formatStandardRoleName } from '../utils/roleFormat';

const DB_NAME = 'WarehouseInventoryDB_v2';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_TRANSACTIONS = 'transactions';

// Parse and format BIN location: TN 1.02.03.04B
export interface BinLocationDetail {
  raw: string;
  room: string;
  rack: string;
  column: string;
  row: string;
  suffix?: string;
  isValid: boolean;
}

export function parseBinLocation(locationStr: string): BinLocationDetail {
  const trimmed = (locationStr || '').trim();
  // Match format: TN 1.02.03.04B or TN 1.02.03.04
  const match = trimmed.match(/^TN\s*(\d+)[\.\-](\d+)[\.\-](\d+)[\.\-](\d+)([A-Za-z]?)$/i);
  if (match) {
    return {
      raw: trimmed,
      room: `TN ${match[1]}`,
      rack: match[2].padStart(2, '0'),
      column: match[3].padStart(2, '0'),
      row: match[4].padStart(2, '0'),
      suffix: match[5] ? match[5].toUpperCase() : undefined,
      isValid: true,
    };
  }
  return {
    raw: trimmed,
    room: trimmed,
    rack: '-',
    column: '-',
    row: '-',
    isValid: false,
  };
}

// Generate valid 18-digit material number
export function generate18DigitCode(seq?: number): string {
  const prefix = '031007'; // Standard 6-digit category prefix
  const num = seq !== undefined ? seq : Math.floor(1000 + Math.random() * 90000);
  return `${prefix}${String(num).padStart(12, '0')}`;
}

// Realistic sample seed data for warehouse with 18-digit material numbers & TN BIN format
const SEED_ITEMS: InventoryItem[] = [
  {
    id: 'item-001',
    material_code: '031007000000000235', // User's requested example!
    name: 'Bearing SKF 6205-2RSH Deep Groove',
    category: 'Mekanik & Sparepart',
    fpa_type: 'FPA',
    location: 'TN 1.02.03.04B', // User's requested BIN location format!
    unit: 'EA',
    current_stock: 45,
    min_stock: 15,
    description: 'Bantalan bola alur dalam presisi tinggi dengan segel karet ganda untuk motor induksi.',
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-09-08T14:30:00Z',
  },
  {
    id: 'item-002',
    material_code: '031007000000000102',
    name: 'MCB Schneider 3 Phase 16A Domae',
    category: 'Elektrikal',
    fpa_type: 'FPA',
    location: 'TN 1.01.05.02A',
    unit: 'unit',
    current_stock: 12,
    min_stock: 10,
    description: 'Miniature Circuit Breaker 3 kutub proteksi hubung singkat dan beban lebih instalasi pabrik.',
    created_at: '2026-08-02T09:15:00Z',
    updated_at: '2026-09-07T11:20:00Z',
  },
  {
    id: 'item-003',
    material_code: '031007000000000103',
    name: 'Pipa Seamless Carbon Steel Sch 40 2 inch',
    category: 'Pipa & Fitting',
    fpa_type: 'NON_FPA',
    location: 'TN 2.03.01.01A',
    unit: 'batang',
    current_stock: 80,
    min_stock: 20,
    description: 'Pipa baja seamless standar ASTM A106 Grade B panjang 6 meter untuk fluida bertekanan.',
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-09-05T16:00:00Z',
  },
  {
    id: 'item-004',
    material_code: '031007000000000104',
    name: 'Baut Hexagonal Grade 8.8 M12 x 50mm + Nut',
    category: 'Baut & Fastener',
    fpa_type: 'FPA',
    location: 'TN 1.04.02.06C',
    unit: 'set',
    current_stock: 650,
    min_stock: 200,
    description: 'Baut baja tegangan tinggi hot dip galvanized lengkap dengan mur dan ring per.',
    created_at: '2026-08-04T07:45:00Z',
    updated_at: '2026-09-08T09:10:00Z',
  },
  {
    id: 'item-005',
    material_code: '031007000000000105',
    name: 'Helm Keselamatan Kerja Proguard MSA V-Gard',
    category: 'Alat Pelindung Diri (APD)',
    fpa_type: 'FPA',
    location: 'TN 3.02.04.01A',
    unit: 'EA',
    current_stock: 24,
    min_stock: 30,
    low_stock_status: 'MINIMUM',
    low_stock_notes: 'Menunggu PR disetujui Dept. K3 untuk 50 EA',
    low_stock_updated_by: 'Evaluator',
    low_stock_updated_at: '2026-09-09T08:15:00Z',
    description: 'Safety helmet bersertifikat ANSI Z89.1 Type I Class E warna kuning dengan suspensi putar.',
    created_at: '2026-08-05T13:20:00Z',
    updated_at: '2026-09-09T08:15:00Z',
  },
  {
    id: 'item-006',
    material_code: '031007000000000106',
    name: 'Oli Hidrolik Shell Tellus S2 MX 68 (Drum 209L)',
    category: 'Pelumas & Kimia',
    fpa_type: 'NON_FPA',
    location: 'TN 2.01.01.01B',
    unit: 'drum',
    current_stock: 6,
    min_stock: 5,
    description: 'Pelumas hidrolik industri kinerja tinggi proteksi keausan termal dan stabilitas oksidasi.',
    created_at: '2026-08-06T11:00:00Z',
    updated_at: '2026-09-06T10:40:00Z',
  },
  {
    id: 'item-007',
    material_code: '031007000000000107',
    name: 'Karton Master Box Double Wall 60x40x40 cm',
    category: 'Kemasan & Packaging',
    fpa_type: 'NON_FPA',
    location: 'TN 1.05.02.03A',
    unit: 'lembar',
    current_stock: 450,
    min_stock: 100,
    description: 'Kardus packing ekspor material K150/M125/K150 daya tumpuk hingga 250 kg.',
    created_at: '2026-08-07T14:30:00Z',
    updated_at: '2026-09-08T15:00:00Z',
  },
  {
    id: 'item-008',
    material_code: '031007000000000108',
    name: 'Kabel Listrik NYM 3x2.5mm² Supreme (Roll 100m)',
    category: 'Elektrikal',
    fpa_type: 'FPA',
    location: 'TN 1.01.03.04B',
    unit: 'roll',
    current_stock: 8,
    min_stock: 10,
    low_stock_status: 'PROCESSED',
    low_stock_notes: 'PO-2026-09-088 sudah terbit ke PT Supreme Cable',
    low_stock_updated_by: 'Evaluator',
    low_stock_updated_at: '2026-09-08T10:30:00Z',
    description: 'Kabel tembaga tunggal isolasi PVC SNI untuk instalasi penerangan dan stop kontak gedung.',
    created_at: '2026-08-08T08:30:00Z',
    updated_at: '2026-09-07T13:45:00Z',
  },
  {
    id: 'item-009',
    material_code: '031007000000000109',
    name: 'Sarung Tangan Nitrile Kimia Ansell Alphatec',
    category: 'Alat Pelindung Diri (APD)',
    fpa_type: 'FPA',
    location: 'TN 3.01.02.05B',
    unit: 'pasang',
    current_stock: 180,
    min_stock: 50,
    description: 'Sarung tangan tahan bahan kimia keras, pelarut aromatik, oli, dan asam pekat.',
    created_at: '2026-08-09T09:00:00Z',
    updated_at: '2026-09-09T10:00:00Z',
  },
  {
    id: 'item-010',
    material_code: '031007000000000110',
    name: 'Ball Valve Flange Cast Steel 10K 3 inch',
    category: 'Pipa & Fitting',
    fpa_type: 'NON_FPA',
    location: 'TN 2.02.04.02A',
    unit: 'unit',
    current_stock: 14,
    min_stock: 5,
    description: 'Katup bola industri JIS 10K bodi WCB dengan dudukan PTFE tahan suhu hingga 180°C.',
    created_at: '2026-08-10T15:00:00Z',
    updated_at: '2026-09-08T11:30:00Z',
  }
];

const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    item_id: 'item-001',
    material_code: '031007000000000235',
    item_name: 'Bearing SKF 6205-2RSH Deep Groove',
    transaction_type: 'IN',
    quantity: 50,
    balance_after: 50,
    pic_name: 'Supervisor',
    transaction_date: '2026-08-01T08:30:00Z',
    notes: 'Penerimaan stok awal dari PO #PO-SKF-2026-08',
    doc_ref: 'SJ-SKF-8891'
  },
  {
    id: 'tx-002',
    item_id: 'item-001',
    material_code: '031007000000000235',
    item_name: 'Bearing SKF 6205-2RSH Deep Groove',
    transaction_type: 'OUT',
    quantity: 5,
    balance_after: 45,
    pic_name: 'Staff Shift Group A',
    transaction_date: '2026-09-08T14:30:00Z',
    notes: 'Penggantian rutin bearing motor line conveyer 2',
    doc_ref: 'WO-MAINT-441'
  },
  {
    id: 'tx-003',
    item_id: 'item-002',
    material_code: '031007000000000102',
    item_name: 'MCB Schneider 3 Phase 16A Domae',
    transaction_type: 'IN',
    quantity: 20,
    balance_after: 20,
    pic_name: 'Supervisor',
    transaction_date: '2026-08-02T09:30:00Z',
    notes: 'Restock berkala electrical spare part',
    doc_ref: 'PO-SCH-901'
  },
  {
    id: 'tx-004',
    item_id: 'item-002',
    material_code: '031007000000000102',
    item_name: 'MCB Schneider 3 Phase 16A Domae',
    transaction_type: 'OUT',
    quantity: 8,
    balance_after: 12,
    pic_name: 'Staff Shift Group B',
    transaction_date: '2026-09-07T11:20:00Z',
    notes: 'Peremajaan panel distribusi sub-stasiun B',
    doc_ref: 'SPB-ELEC-092'
  },
  {
    id: 'tx-005',
    item_id: 'item-005',
    material_code: '031007000000000105',
    item_name: 'Helm Keselamatan Kerja Proguard MSA V-Gard',
    transaction_type: 'IN',
    quantity: 50,
    balance_after: 50,
    pic_name: 'Supervisor',
    transaction_date: '2026-08-05T14:00:00Z',
    notes: 'Pengadaan APD batch Q3',
    doc_ref: 'PO-HSE-331'
  },
  {
    id: 'tx-006',
    item_id: 'item-005',
    material_code: '031007000000000105',
    item_name: 'Helm Keselamatan Kerja Proguard MSA V-Gard',
    transaction_type: 'OUT',
    quantity: 26,
    balance_after: 24,
    pic_name: 'Staff Shift Group C',
    transaction_date: '2026-09-09T08:15:00Z',
    notes: 'Distribusi untuk teknisi kontraktor proyek ekspansi',
    doc_ref: 'BA-APD-108'
  }
];

class WarehouseDB {
  private db: IDBDatabase | null = null;
  private memoryItems: Map<string, InventoryItem> = new Map();
  private memoryTransactions: Transaction[] = [];
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    // Automatically propagate cloudSync data changes (remote device & cross-tab) to all DB listeners
    cloudSync.subscribeDataChanges(() => {
      this.notifyDataChanged();
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Direct subscription to streaming items from cloud
  listenToItems(callback: (items: InventoryItem[]) => void): () => void {
    return cloudSync.listenToItems(callback);
  }

  // Direct subscription to streaming transactions from cloud
  listenToTransactions(callback: (txs: Transaction[]) => void): () => void {
    return cloudSync.listenToTransactions(callback);
  }

  notifyDataChanged() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Listener error:', e);
      }
    }
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.db = await this.openDatabase();
        await this.loadInitialData();
        await this.runUnitMigration();
        await this.cleanAndDeduplicateItems();
      } catch (err) {
        console.warn('IndexedDB unavailable or blocked, using direct Firestore sync:', err);
      }
      this.isInitialized = true;
      this.initCloudSync();
    })();

    return this.initPromise;
  }

  /**
   * Safe in-place database migration for Unit normalization (e.g. 'pcs' -> 'EA').
   * Strictly preserves all existing items, barcodes, locations, stock balances, and transaction history.
   * Never drops, resets, or deletes any records.
   */
  async runUnitMigration(): Promise<{ totalChecked: number; migratedCount: number }> {
    let migratedCount = 0;
    const items = Array.from(this.memoryItems.values());
    for (const item of items) {
      const normalized = formatUnit(item.unit);
      if (item.unit !== normalized) {
        item.unit = normalized;
        this.memoryItems.set(item.id, item);
        if (this.db) {
          await this.putToStore(STORE_ITEMS, item);
        }
        cloudSync.syncItemToCloud(item).catch(() => {});
        migratedCount++;
      }
    }
    if (migratedCount > 0) {
      console.log(`[Database Migration] Successfully converted ${migratedCount} legacy items to 'EA' while preserving all existing records.`);
      this.notifyDataChanged();
    }
    return { totalChecked: items.length, migratedCount };
  }

  /**
   * Automatic Elimination & Data Sanitization Engine:
   * 1. Eliminates any material number that is NOT exactly 18 digits (e.g. < 18 or > 18 digits or non-numeric).
   * 2. Eliminates duplicate material numbers (keeping only 1 unique valid item and removing duplicates).
   * 3. Normalizes FPA / Non-FPA classification ('FPA' | 'NON_FPA').
   */
  async cleanAndDeduplicateItems(): Promise<{
    totalChecked: number;
    validCount: number;
    eliminatedNot18Count: number;
    eliminatedDuplicateCount: number;
  }> {
    const items = Array.from(this.memoryItems.values());
    const seenCodes = new Set<string>();
    const itemsToKeep: InventoryItem[] = [];
    const itemsToDelete: string[] = [];
    let eliminatedNot18Count = 0;
    let eliminatedDuplicateCount = 0;

    for (const item of items) {
      const rawCode = (item.material_code || '').trim();
      const codeDigits = rawCode.replace(/\D/g, '');

      // 1. Must be exactly 18 numeric digits
      if (codeDigits.length !== 18) {
        itemsToDelete.push(item.id);
        eliminatedNot18Count++;
        continue;
      }

      // 2. Eliminate duplicate material numbers
      if (seenCodes.has(codeDigits)) {
        itemsToDelete.push(item.id);
        eliminatedDuplicateCount++;
        continue;
      }

      seenCodes.add(codeDigits);

      // Normalize FPA classification
      const rawFpa = (item.fpa_type || 'NON_FPA').toString().toUpperCase().trim();
      const cleanFpa: 'FPA' | 'NON_FPA' = (
        rawFpa === 'FPA' ||
        rawFpa === 'KONTRAK' ||
        rawFpa.includes('KONTRAK')
      ) ? 'FPA' : 'NON_FPA';

      const cleanedItem: InventoryItem = {
        ...item,
        material_code: codeDigits,
        fpa_type: cleanFpa,
        unit: formatUnit(item.unit || 'EA'),
      };

      itemsToKeep.push(cleanedItem);
    }

    // Remove deleted items from memory, local IndexedDB, and Cloud
    for (const id of itemsToDelete) {
      this.memoryItems.delete(id);
      if (this.db) {
        await this.deleteFromStore(STORE_ITEMS, id);
      }
      cloudSync.syncDeleteItemFromCloud(id).catch(() => {});
    }

    // Persist cleaned items
    for (const it of itemsToKeep) {
      this.memoryItems.set(it.id, it);
      if (this.db) {
        await this.putToStore(STORE_ITEMS, it);
      }
    }

    if (itemsToDelete.length > 0) {
      console.log(`[Sanitization] Otomatis mengeliminasi ${eliminatedNot18Count} barang bukan 18 digit dan ${eliminatedDuplicateCount} barang duplikat.`);
      this.notifyDataChanged();
    }

    return {
      totalChecked: items.length,
      validCount: itemsToKeep.length,
      eliminatedNot18Count,
      eliminatedDuplicateCount,
    };
  }

  private initCloudSync(): void {
    cloudSync.startSync(
      () => Array.from(this.memoryItems.values()),
      () => this.memoryTransactions,
      async (remoteItems) => {
        // Real-time synchronization when remote items update via onSnapshot
        if (!remoteItems) return;
        const remoteIds = new Set(remoteItems.map((i) => i.id));

        for (const rawItem of remoteItems) {
          const item: InventoryItem = { ...rawItem, unit: formatUnit(rawItem.unit) };
          this.memoryItems.set(item.id, item);
          if (this.db) {
            await this.putToStore(STORE_ITEMS, item);
          }
          if (item.unit !== rawItem.unit) {
            cloudSync.syncItemToCloud(item).catch(() => {});
          }
        }

        // If remote collection has items, sync remote deletions to local store
        if (remoteItems.length > 0) {
          for (const [id] of this.memoryItems) {
            if (!remoteIds.has(id)) {
              this.memoryItems.delete(id);
              if (this.db) {
                await this.deleteFromStore(STORE_ITEMS, id);
              }
            }
          }
        }

        this.notifyDataChanged();
      },
      async (deletedItemIds) => {
        for (const itemId of deletedItemIds) {
          this.memoryItems.delete(itemId);
          if (this.db) {
            await this.deleteFromStore(STORE_ITEMS, itemId);
          }
        }
        this.notifyDataChanged();
      },
      async (remoteTxs) => {
        // Real-time synchronization when remote transactions are logged via onSnapshot
        if (!remoteTxs) return;
        const txMap = new Map<string, Transaction>();
        // Remote Firestore stream is ground truth across all browsers/devices
        for (const t of remoteTxs) {
          txMap.set(t.id, t);
        }
        // Retain recent local transactions if created in last 60s
        for (const t of this.memoryTransactions) {
          if (!txMap.has(t.id)) {
            const ageMs = Date.now() - new Date(t.created_at || t.transaction_date).getTime();
            if (ageMs < 60000) {
              txMap.set(t.id, t);
            }
          }
        }
        this.memoryTransactions = Array.from(txMap.values()).sort(
          (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        );
        if (this.db) {
          for (const t of remoteTxs) {
            await this.putToStore(STORE_TRANSACTIONS, t);
          }
        }
        this.notifyDataChanged();
      }
    ).catch((err) => {
      console.warn('[WarehouseDB] Cloud sync background start error:', err);
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
          itemStore.createIndex('material_code', 'material_code', { unique: true });
          itemStore.createIndex('category', 'category', { unique: false });
          itemStore.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
          txStore.createIndex('item_id', 'item_id', { unique: false });
          txStore.createIndex('material_code', 'material_code', { unique: false });
          txStore.createIndex('transaction_date', 'transaction_date', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async loadInitialData(): Promise<void> {
    if (!this.db) return;
    const items = await this.getAllFromStore<InventoryItem>(STORE_ITEMS);
    if (items.length > 0) {
      for (const item of items) {
        // Auto-migrate legacy 'pcs' or 'ea' unit to standardized 'EA (Each)'
        const formatted = formatUnit(item.unit);
        if (item.unit !== formatted) {
          item.unit = formatted;
          await this.putToStore(STORE_ITEMS, item);
        }
        this.memoryItems.set(item.id, item);
      }
      this.memoryTransactions = await this.getAllFromStore<Transaction>(STORE_TRANSACTIONS);
    }
  }

  private getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve([]);
        return;
      }
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private putToStore(storeName: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private deleteFromStore(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Public API ---

  async getItems(options?: {
    search?: string;
    category?: string;
    fpaType?: 'all' | 'FPA' | 'NON_FPA';
    stockFilter?: 'all' | 'low' | 'out' | 'normal';
    page?: number;
    pageSize?: number;
    sortBy?: 'code' | 'name' | 'stock' | 'updated';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: InventoryItem[]; total: number }> {
    await this.init();

    let list = Array.from(this.memoryItems.values());

    // Search filter
    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.material_code.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.location.toLowerCase().includes(q) ||
          (i.fpa_type && i.fpa_type.toLowerCase().includes(q)) ||
          (i.low_stock_notes && i.low_stock_notes.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (options?.category && options.category !== 'all') {
      list = list.filter((i) => i.category === options.category);
    }

    // FPA Type filter
    if (options?.fpaType && options.fpaType !== 'all') {
      list = list.filter((i) => {
        const itemFpa = (i.fpa_type || 'NON_FPA').toString().toUpperCase().trim();
        const targetFpa = options.fpaType!.toString().toUpperCase().trim();
        if (targetFpa === 'FPA') {
          return itemFpa === 'FPA' || itemFpa === 'KONTRAK' || itemFpa.includes('KONTRAK');
        } else {
          return itemFpa === 'NON_FPA' || itemFpa === 'NON-FPA' || itemFpa === 'NON FPA' || itemFpa === 'REGULER' || !i.fpa_type;
        }
      });
    }

    // Stock level filter
    if (options?.stockFilter && options.stockFilter !== 'all') {
      if (options.stockFilter === 'out') {
        list = list.filter((i) => i.current_stock <= 0);
      } else if (options.stockFilter === 'low' || (options.stockFilter as string) === 'critical') {
        // Automatically categorizes both items below ROP (< min_stock) AND 0 stock (Habis) as critical stock
        list = list.filter((i) => i.current_stock <= i.min_stock);
      } else if (options.stockFilter === 'normal') {
        list = list.filter((i) => i.current_stock > i.min_stock);
      }
    }

    // Sorting
    const sortBy = options?.sortBy || 'code';
    const sortOrder = options?.sortOrder || 'asc';
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'code') {
        cmp = a.material_code.localeCompare(b.material_code, undefined, { numeric: true });
      } else if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortBy === 'stock') {
        cmp = a.current_stock - b.current_stock;
      } else if (sortBy === 'updated') {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    const total = list.length;
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 25;
    const start = (page - 1) * pageSize;
    const paginatedItems = list.slice(start, start + pageSize);

    return { items: paginatedItems, total };
  }

  async getItemById(id: string): Promise<InventoryItem | null> {
    await this.init();
    return this.memoryItems.get(id) || null;
  }

  async getItemByMaterialCode(code: string): Promise<InventoryItem | null> {
    await this.init();
    const clean = code.trim().toUpperCase();
    for (const item of this.memoryItems.values()) {
      if (item.material_code.toUpperCase() === clean) {
        return item;
      }
    }
    return null;
  }

  async addItem(itemData: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryItem> {
    await this.init();

    const cleanCode = (itemData.material_code || '').trim().replace(/\D/g, '');
    if (cleanCode.length !== 18) {
      throw new Error(`Nomor material '${itemData.material_code}' tidak valid! Harus tepat 18 angka digit (saat ini ${cleanCode.length} digit).`);
    }

    // Check duplicate code
    const existing = await this.getItemByMaterialCode(cleanCode);
    if (existing) {
      throw new Error(`Nomor material '${cleanCode}' sudah terdaftar dalam sistem (Duplikat tereliminasi)!`);
    }

    const now = new Date().toISOString();
    const rawFpa = (itemData.fpa_type || 'NON_FPA').toString().toUpperCase().trim();
    const cleanFpa: 'FPA' | 'NON_FPA' = (rawFpa === 'FPA' || rawFpa.includes('KONTRAK')) ? 'FPA' : 'NON_FPA';

    const newItem: InventoryItem = {
      ...itemData,
      material_code: cleanCode,
      fpa_type: cleanFpa,
      unit: formatUnit(itemData.unit),
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: now,
      updated_at: now,
    };

    this.memoryItems.set(newItem.id, newItem);
    await this.putToStore(STORE_ITEMS, newItem);

    // Direct write to Cloud Firestore
    await cloudSync.syncItemToCloud(newItem);
    this.notifyDataChanged();

    // If initial stock > 0, log initial IN transaction
    if (newItem.current_stock > 0) {
      await this.recordTransaction({
        item_id: newItem.id,
        material_code: newItem.material_code,
        item_name: newItem.name,
        transaction_type: 'IN',
        quantity: newItem.current_stock,
        pic_name: 'Supervisor',
        notes: 'Saldo stok awal pembukuan barang baru',
        doc_ref: 'INIT-ENTRY',
        skipStockUpdate: true,
      });
    }

    return newItem;
  }

  async updateItem(id: string, updates: Partial<Omit<InventoryItem, 'id' | 'created_at'>>): Promise<InventoryItem> {
    await this.init();
    const item = this.memoryItems.get(id);
    if (!item) throw new Error('Barang tidak ditemukan');

    if (updates.material_code) {
      const cleanCode = updates.material_code.trim().replace(/\D/g, '');
      if (cleanCode.length !== 18) {
        throw new Error(`Nomor material '${updates.material_code}' tidak valid! Harus tepat 18 angka digit (saat ini ${cleanCode.length} digit).`);
      }
      if (cleanCode.toUpperCase() !== item.material_code.toUpperCase()) {
        const existing = await this.getItemByMaterialCode(cleanCode);
        if (existing && existing.id !== id) {
          throw new Error(`Nomor material '${cleanCode}' sudah digunakan oleh barang lain.`);
        }
      }
      updates.material_code = cleanCode;
    }

    if (updates.fpa_type) {
      const rawFpa = updates.fpa_type.toString().toUpperCase().trim();
      updates.fpa_type = (rawFpa === 'FPA' || rawFpa.includes('KONTRAK')) ? 'FPA' : 'NON_FPA';
    }

    const updatedItem: InventoryItem = {
      ...item,
      ...updates,
      ...(updates.unit !== undefined ? { unit: formatUnit(updates.unit) } : {}),
      updated_at: new Date().toISOString(),
    };

    this.memoryItems.set(id, updatedItem);
    await this.putToStore(STORE_ITEMS, updatedItem);

    // Direct write to Cloud Firestore
    await cloudSync.syncItemToCloud(updatedItem);
    this.notifyDataChanged();

    return updatedItem;
  }

  async deleteItem(id: string): Promise<void> {
    await this.init();
    const item = this.memoryItems.get(id);
    if (!item) return;

    this.memoryItems.delete(id);
    await this.deleteFromStore(STORE_ITEMS, id);

    // Direct delete from Cloud Firestore
    await cloudSync.syncDeleteItemFromCloud(id);

    this.notifyDataChanged();

    // Also delete associated transactions
    this.memoryTransactions = this.memoryTransactions.filter((tx) => tx.item_id !== id);
    if (this.db) {
      const tx = this.db.transaction(STORE_TRANSACTIONS, 'readwrite');
      const store = tx.objectStore(STORE_TRANSACTIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result as Transaction[];
        for (const t of all) {
          if (t.item_id === id) {
            store.delete(t.id);
            cloudSync.syncDeleteTransactionFromCloud(t.id).catch(() => {});
          }
        }
      };
    }

    this.notifyDataChanged();
  }

  async recordTransaction(params: {
    item_id: string;
    material_code: string;
    item_name: string;
    transaction_type: TransactionType;
    quantity: number;
    pic_name: string;
    operator_username?: string;
    notes: string;
    doc_ref?: string;
    transaction_date?: string;
    skipStockUpdate?: boolean;
  }): Promise<{ transaction: Transaction; item: InventoryItem }> {
    await this.init();

    const item = this.memoryItems.get(params.item_id);
    if (!item) {
      throw new Error(`Barang dengan ID '${params.item_id}' tidak ditemukan`);
    }

    if (params.quantity <= 0) {
      throw new Error('Jumlah mutasi harus lebih besar dari 0');
    }

    let newStock = item.current_stock;
    let updatedItem = item;

    if (!params.skipStockUpdate) {
      if (params.transaction_type === 'OUT') {
        if (item.current_stock < params.quantity) {
          throw new Error(
            `Stok tidak mencukupi! Stok saat ini: ${item.current_stock} ${item.unit}, kuantitas diminta: ${params.quantity} ${item.unit}`
          );
        }
        newStock = item.current_stock - params.quantity;
      } else {
        newStock = item.current_stock + params.quantity;
      }

      // Create new immutable object clone so React state updates trigger re-renders reliably
      updatedItem = {
        ...item,
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      };
      this.memoryItems.set(item.id, updatedItem);
      await this.putToStore(STORE_ITEMS, updatedItem);

      // Direct write updated stock to Firestore
      await cloudSync.syncItemToCloud(updatedItem);
    }

    const txRecord: Transaction = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      item_id: params.item_id,
      material_code: params.material_code,
      item_name: params.item_name,
      transaction_type: params.transaction_type,
      quantity: params.quantity,
      balance_after: newStock,
      pic_name: formatStandardRoleName(params.pic_name),
      operator_username: params.operator_username,
      transaction_date: params.transaction_date || new Date().toISOString(),
      notes: params.notes || '-',
      doc_ref: params.doc_ref || '-',
    };

    this.memoryTransactions.unshift(txRecord);
    await this.putToStore(STORE_TRANSACTIONS, txRecord);

    // Direct write transaction to Cloud Firestore
    await cloudSync.syncTransactionToCloud(txRecord);

    // Immediately notify all active components (Dashboard, History, Bin Card) for zero delay
    this.notifyDataChanged();

    return { transaction: txRecord, item: updatedItem };
  }

  async updateTransaction(
    txId: string,
    updates: {
      transaction_date?: string;
      doc_ref?: string;
      pic_name?: string;
      notes?: string;
      quantity?: number;
      transaction_type?: TransactionType;
    }
  ): Promise<{ transaction: Transaction; item?: InventoryItem }> {
    await this.init();

    const txIndex = this.memoryTransactions.findIndex((t) => t.id === txId);
    if (txIndex === -1) {
      throw new Error(`Catatan transaksi dengan ID '${txId}' tidak ditemukan.`);
    }

    const oldTx = this.memoryTransactions[txIndex];
    const item = this.memoryItems.get(oldTx.item_id);

    let updatedItem = item;

    const newQty = updates.quantity !== undefined ? Math.max(0, updates.quantity) : oldTx.quantity;
    const newType = updates.transaction_type || oldTx.transaction_type;

    if (item && (newQty !== oldTx.quantity || newType !== oldTx.transaction_type)) {
      // Revert old effect
      let revertedStock = item.current_stock;
      if (oldTx.transaction_type === 'IN') {
        revertedStock -= oldTx.quantity;
      } else if (oldTx.transaction_type === 'OUT') {
        revertedStock += oldTx.quantity;
      }

      // Apply new effect
      let recalculatedStock = revertedStock;
      if (newType === 'IN') {
        recalculatedStock += newQty;
      } else if (newType === 'OUT') {
        if (revertedStock < newQty) {
          throw new Error(`Stok tidak mencukupi untuk penyesuaian! Stok tersisa: ${revertedStock} ${item.unit}`);
        }
        recalculatedStock -= newQty;
      }

      updatedItem = {
        ...item,
        current_stock: recalculatedStock,
        updated_at: new Date().toISOString(),
      };

      this.memoryItems.set(item.id, updatedItem);
      await this.putToStore(STORE_ITEMS, updatedItem);
      await cloudSync.syncItemToCloud(updatedItem);
    }

    const updatedTx: Transaction = {
      ...oldTx,
      transaction_date: updates.transaction_date || oldTx.transaction_date,
      doc_ref: updates.doc_ref !== undefined ? updates.doc_ref : oldTx.doc_ref,
      pic_name: updates.pic_name ? formatStandardRoleName(updates.pic_name) : oldTx.pic_name,
      notes: updates.notes !== undefined ? updates.notes : oldTx.notes,
      quantity: newQty,
      transaction_type: newType,
      balance_after: updatedItem ? updatedItem.current_stock : oldTx.balance_after,
    };

    this.memoryTransactions[txIndex] = updatedTx;
    await this.putToStore(STORE_TRANSACTIONS, updatedTx);

    await cloudSync.syncTransactionToCloud(updatedTx);
    this.notifyDataChanged();

    return { transaction: updatedTx, item: updatedItem };
  }

  async deleteTransaction(txId: string): Promise<{ success: boolean; item?: InventoryItem }> {
    await this.init();

    const txIndex = this.memoryTransactions.findIndex((t) => t.id === txId);
    if (txIndex === -1) {
      throw new Error(`Catatan transaksi dengan ID '${txId}' tidak ditemukan.`);
    }

    const tx = this.memoryTransactions[txIndex];
    const item = this.memoryItems.get(tx.item_id);
    let updatedItem = item;

    // Revert the transaction's effect on item stock
    if (item && tx.transaction_type !== 'STO') {
      let revertedStock = item.current_stock;
      if (tx.transaction_type === 'IN') {
        revertedStock = Math.max(0, revertedStock - tx.quantity);
      } else if (tx.transaction_type === 'OUT') {
        revertedStock = revertedStock + tx.quantity;
      }

      updatedItem = {
        ...item,
        current_stock: revertedStock,
        updated_at: new Date().toISOString(),
      };

      this.memoryItems.set(item.id, updatedItem);
      await this.putToStore(STORE_ITEMS, updatedItem);
      await cloudSync.syncItemToCloud(updatedItem);
    }

    // Remove from memory transactions
    this.memoryTransactions.splice(txIndex, 1);
    await this.deleteFromStore(STORE_TRANSACTIONS, txId);

    // Direct delete from Cloud Firestore
    await cloudSync.syncDeleteTransactionFromCloud(txId);
    this.notifyDataChanged();

    return { success: true, item: updatedItem };
  }

  async updateLowStockStatus(
    itemId: string,
    status: LowStockActionStatus,
    updatedBy: string,
    notes?: string
  ): Promise<InventoryItem> {
    await this.init();

    const item = this.memoryItems.get(itemId);
    if (!item) {
      throw new Error(`Barang dengan ID '${itemId}' tidak ditemukan`);
    }

    const updatedItem: InventoryItem = {
      ...item,
      low_stock_status: status,
      low_stock_updated_at: new Date().toISOString(),
      low_stock_updated_by: updatedBy,
      low_stock_notes: notes !== undefined ? notes : item.low_stock_notes,
      updated_at: new Date().toISOString(),
    };

    this.memoryItems.set(itemId, updatedItem);
    await this.putToStore(STORE_ITEMS, updatedItem);

    await cloudSync.syncItemToCloud(updatedItem);

    this.notifyDataChanged();
    return updatedItem;
  }

  async updateLowStockNotes(
    itemId: string,
    notes: string,
    updatedBy: string
  ): Promise<InventoryItem> {
    await this.init();

    const item = this.memoryItems.get(itemId);
    if (!item) {
      throw new Error(`Barang dengan ID '${itemId}' tidak ditemukan`);
    }

    const updatedItem: InventoryItem = {
      ...item,
      low_stock_notes: notes,
      low_stock_updated_at: new Date().toISOString(),
      low_stock_updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    };

    this.memoryItems.set(itemId, updatedItem);
    await this.putToStore(STORE_ITEMS, updatedItem);

    await cloudSync.syncItemToCloud(updatedItem);

    this.notifyDataChanged();
    return updatedItem;
  }

  async recordStockOpname(params: {
    item_id: string;
    physical_stock: number;
    pic_name: string;
    operator_username?: string;
    doc_ref: string;
    notes: string;
    sto_date?: string;
  }): Promise<{ item: InventoryItem; transaction: Transaction; difference: number }> {
    await this.init();

    const item = this.memoryItems.get(params.item_id);
    if (!item) {
      throw new Error(`Barang dengan ID '${params.item_id}' tidak ditemukan`);
    }

    const previousStock = item.current_stock;
    const physicalStock = Math.max(0, Math.round(params.physical_stock));
    const difference = physicalStock - previousStock;
    const dateStr = params.sto_date || new Date().toISOString();

    const isMatch = difference === 0;
    const isSurplus = difference > 0;
    const diffSign = difference > 0 ? `+${difference}` : `${difference}`;
    const statusNote = isMatch ? 'Cocok / Akurat' : isSurplus ? 'Surplus Fisik' : 'Selisih Kurang';

    // 1. Catat ke Riwayat Transaksi / History Log Aplikasi sebagai transaksi STO
    const txRecord: Transaction = {
      id: `tx-sto-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      item_id: item.id,
      material_code: item.material_code,
      item_name: item.name,
      transaction_type: 'STO',
      quantity: physicalStock, // Jumlah fisik hasil audit
      balance_after: previousStock, // Perilaku stock sistem: saldo aktif TIDAK berubah otomatis
      pic_name: formatStandardRoleName(params.pic_name),
      operator_username: params.operator_username,
      transaction_date: dateStr,
      notes: `[Stock Opname / STO] Fisik: ${physicalStock} ${item.unit} | Sistem: ${previousStock} ${item.unit} | Selisih: ${diffSign} ${item.unit} (${statusNote})${params.notes ? ` - ${params.notes}` : ''}`,
      doc_ref: params.doc_ref || `BA-STO-${new Date().toISOString().slice(0, 10)}`,
    };

    this.memoryTransactions.unshift(txRecord);
    await this.putToStore(STORE_TRANSACTIONS, txRecord);

    // Direct write STO transaction to Firestore
    await cloudSync.syncTransactionToCloud(txRecord);

    // 2. Perilaku Stock Sistem: Proses STO TIDAK langsung mengubah (menambah/mengurangi) stock aktif di sistem secara otomatis
    // current_stock TETAP bernilai previousStock, dan selisih tercatat di last_sto_diff
    const updatedItem: InventoryItem = {
      ...item,
      current_stock: previousStock, // Saldo sistem tidak berubah otomatis
      last_sto_date: dateStr,
      last_sto_by: formatStandardRoleName(params.pic_name),
      last_sto_diff: difference,
      last_sto_physical: physicalStock,
      last_sto_doc: params.doc_ref,
      last_sto_notes: params.notes,
      updated_at: new Date().toISOString(),
    };

    this.memoryItems.set(item.id, updatedItem);
    await this.putToStore(STORE_ITEMS, updatedItem);

    // Direct write item updates to Firestore
    await cloudSync.syncItemToCloud(updatedItem);

    this.notifyDataChanged();

    return { item: updatedItem, transaction: txRecord, difference };
  }

  async getUserTransactions(username: string, picName?: string): Promise<Transaction[]> {
    await this.init();
    const cleanUser = username.trim().toLowerCase();
    const cleanPic = (picName || '').trim().toLowerCase();

    return this.memoryTransactions
      .filter((tx) => {
        if (tx.operator_username && tx.operator_username.toLowerCase() === cleanUser) {
          return true;
        }
        const txPic = tx.pic_name.toLowerCase();
        if (cleanUser && txPic.includes(cleanUser)) return true;
        if (cleanPic && txPic.includes(cleanPic)) return true;
        return false;
      })
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }

  async getItemTransactions(itemId: string): Promise<Transaction[]> {
    await this.init();
    return this.memoryTransactions
      .filter((tx) => tx.item_id === itemId)
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }

  async getRecentTransactions(limit = 10): Promise<Transaction[]> {
    await this.init();
    return [...this.memoryTransactions]
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .slice(0, limit);
  }

  async getStockSummary(): Promise<StockSummary> {
    await this.init();
    const items = Array.from(this.memoryItems.values());
    const totalItems = items.length;
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of items) {
      totalStock += item.current_stock;
      if (item.current_stock <= 0) {
        outOfStockCount++;
      } else if (item.current_stock <= item.min_stock) {
        lowStockCount++;
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    let totalInToday = 0;
    let totalOutToday = 0;

    for (const tx of this.memoryTransactions) {
      if (tx.transaction_date.startsWith(todayStr)) {
        if (tx.transaction_type === 'IN') {
          totalInToday += tx.quantity;
        } else {
          totalOutToday += tx.quantity;
        }
      }
    }

    return {
      totalItems,
      totalStock,
      lowStockCount,
      outOfStockCount,
      totalInToday,
      totalOutToday,
      totalTransactionsCount: this.memoryTransactions.length,
    };
  }

  async getCategories(): Promise<string[]> {
    await this.init();
    const set = new Set<string>();
    for (const item of this.memoryItems.values()) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort();
  }

  // --- Mass Bulk Import with Validation & Auto-Elimination ---
  async importCsvItems(
    rows: CsvItemRow[]
  ): Promise<{
    importedCount: number;
    eliminatedDuplicateCount: number;
    eliminatedNot18Count: number;
    duplicateCodes: string[];
    invalidLengthCodes: string[];
    errors: string[];
  }> {
    await this.init();

    const existingCodes = new Set<string>();
    for (const item of this.memoryItems.values()) {
      const c = (item.material_code || '').trim().replace(/\D/g, '');
      if (c.length === 18) {
        existingCodes.add(c);
      }
    }

    const seenInBatch = new Set<string>();
    const duplicateCodes: string[] = [];
    const invalidLengthCodes: string[] = [];
    const validItems: InventoryItem[] = [];
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawCode = (row.material_code || '').trim();
      const codeDigits = rawCode.replace(/\D/g, '');

      if (!rawCode) {
        errors.push(`Baris ${i + 1}: Nomor material tidak boleh kosong.`);
        continue;
      }

      // Automatically eliminate if not exactly 18 digits (less or more than 18)
      if (codeDigits.length !== 18) {
        invalidLengthCodes.push(`${rawCode} (${codeDigits.length} digit - eliminasi otomatis)`);
        continue;
      }

      if (!row.name || !row.name.trim()) {
        errors.push(`Baris ${i + 1} (${codeDigits}): Nama barang tidak boleh kosong.`);
        continue;
      }

      // Automatically eliminate duplicate material numbers
      if (existingCodes.has(codeDigits) || seenInBatch.has(codeDigits)) {
        duplicateCodes.push(`${codeDigits} (duplikat tereliminasi)`);
        continue;
      }

      seenInBatch.add(codeDigits);
      const stock = Math.max(0, parseInt(String(row.initial_stock || 0), 10) || 0);
      const minStock = Math.max(0, parseInt(String(row.min_stock || 10), 10) || 10);

      // Determine FPA / Non-FPA classification
      const rawFpa = String(row.fpa_type || '').toUpperCase().trim();
      const fpaType: 'FPA' | 'NON_FPA' = (
        rawFpa === 'FPA' ||
        rawFpa === 'KONTRAK' ||
        rawFpa.includes('KONTRAK') ||
        rawFpa === 'YA' ||
        rawFpa === 'YES' ||
        rawFpa === 'TRUE' ||
        rawFpa === '1'
      ) ? 'FPA' : 'NON_FPA';

      const newItem: InventoryItem = {
        id: `item-csv-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        material_code: codeDigits,
        name: row.name.trim(),
        category: (row.category || 'Umum').trim(),
        fpa_type: fpaType,
        description: (row.description || '').trim() || `Material inventaris ${codeDigits}`,
        location: (row.location || 'TN 1.01.01.01A').trim(),
        unit: formatUnit(row.unit || 'EA'),
        current_stock: stock,
        min_stock: minStock,
        created_at: now,
        updated_at: now,
      };

      validItems.push(newItem);
    }

    // Persist valid items
    for (const it of validItems) {
      this.memoryItems.set(it.id, it);
      await this.putToStore(STORE_ITEMS, it);
      existingCodes.add(it.material_code);

      if (it.current_stock > 0) {
        const tx: Transaction = {
          id: `tx-csv-${it.id}`,
          item_id: it.id,
          material_code: it.material_code,
          item_name: it.name,
          transaction_type: 'IN',
          quantity: it.current_stock,
          balance_after: it.current_stock,
          pic_name: 'Supervisor',
          transaction_date: now,
          notes: `Stok awal dari CSV Bulk Import (${it.fpa_type === 'FPA' ? 'FPA Kontrak' : 'Non-FPA'})`,
          doc_ref: 'IMPORT-CSV',
        };
        this.memoryTransactions.unshift(tx);
        await this.putToStore(STORE_TRANSACTIONS, tx);
      }
    }

    // Push imported batch to cloud database
    if (validItems.length > 0) {
      await cloudSync.syncBatchItemsToCloud(validItems);
    }

    this.notifyDataChanged();

    return {
      importedCount: validItems.length,
      eliminatedDuplicateCount: duplicateCodes.length,
      eliminatedNot18Count: invalidLengthCodes.length,
      duplicateCodes,
      invalidLengthCodes,
      errors,
    };
  }

  // --- Mass Bulk Generator for 6000 Items ---
  async generateBulk6000Items(onProgress?: (count: number, total: number) => void): Promise<number> {
    await this.init();

    const TARGET = 6000;
    const currentCount = this.memoryItems.size;
    const toAdd = Math.max(0, TARGET - currentCount);

    if (toAdd <= 0) {
      return this.memoryItems.size;
    }

    const categories = [
      'Mekanik & Sparepart',
      'Elektrikal',
      'Pipa & Fitting',
      'Baut & Fastener',
      'Alat Pelindung Diri (APD)',
      'Pelumas & Kimia',
      'Kemasan & Packaging',
      'Peralatan Tangan & Power Tool',
      'Pneumatik & Hidrolik',
      'Instrumentasi & Sensor',
    ];

    const prefixes = ['MAT', 'SPP', 'ELC', 'PIP', 'FST', 'APD', 'LUB', 'PKG', 'TLS', 'PNE'];
    const nounTypes = [
      ['Bearing Roll', 'Roda Gigi Konis', 'V-Belt BANDO', 'Kopling Fleksibel', 'Seal Karet NBR', 'Rantai Roller', 'Shaft Stainless 304'],
      ['Kabel NYY', 'Kontaktor Chint', 'Relay Omron 24V', 'Terminal Block', 'Lampu LED Highbay', 'Inverter Variable Speed', 'Konektor Kabel'],
      ['Pipa Galvanis 1-1/2"', 'Elbow 90 Derajat', 'Tee Reducer Sch 40', 'Flange Blind 10K', 'Socket Weld', 'Nipple Kuningan', 'Gate Valve 2"'],
      ['Baut Hexagon M8x40', 'Mur Kunci Nylo M12', 'Ring Plat M16', 'Baut Tanam Socket', 'Angkur Baut DynaBolt', 'Sekrup Self Drilling', 'Stud Bolt B7'],
      ['Sarung Tangan Karet', 'Kacamata Safety Clear', 'Masker Respirator 3M', 'Sepatu Safety Steel Toe', 'Ear Plug Reusable', 'Rompi Safety Scotlight'],
      ['Gemuk Lithium EP-2', 'Cairan Penetrant WD', 'Minyak Rem DOT 4', 'Pembersih Kontak Cleaner', 'Sealant RTV Silicone', 'Pendingin Radiator Coolant'],
      ['Pallet Plastik Heavy Duty', 'Stretch Film 500mm', 'Tali Strapping Band', 'Bubble Wrap Tebal', 'Lakban Coklat Daimaru', 'Stiker Fragile Merah'],
      ['Kunci Pas Set 8-24mm', 'Gerinda Tangan Bosch', 'Tang Kombinasi 8"', 'Obeng Set Insulated', 'Meteran Baja 7.5m', 'Kunci Pipa 18" Ridgid'],
      ['Silinder Udara Pneumatik', 'Solenoid Valve 5/2', 'Fitting Selang One-Touch', 'Regulator Angin SMC', 'Filter Udara Kompresor', 'Selang PU 8mm'],
      ['Sensor Proximity Induktif', 'Termokopel Type K', 'Pressure Gauge 0-10 Bar', 'Flow Meter Digital', 'Limit Switch Honeywell', 'Transmitter Suhu 4-20mA'],
    ];

    const units = ['EA', 'unit', 'set', 'meter', 'roll', 'box', 'drum', 'liter', 'kg', 'batang'];

    // Generate in batches of 500 for fast UI responsiveness and low memory footprint
    const batchSize = 500;
    const now = new Date().toISOString();

    for (let i = 0; i < toAdd; i++) {
      const idx = currentCount + i + 1;
      const catIdx = i % categories.length;
      const cat = categories[catIdx];
      // Exact 18-digit numeric material code (e.g. 031007000000001234)
      const code = `031007${String(idx).padStart(12, '0')}`;
      const nouns = nounTypes[catIdx];
      const noun = nouns[i % nouns.length];
      const modelCode = `Spec-${String(1000 + (i % 8999))}`;
      const name = `${noun} ${modelCode}`;
      
      // Standard Warehouse BIN Location: TN 1.02.03.04B
      // (Ruang TN 1..3, Rak 01..12, Kolom 01..08, Baris 01..06, Bin A/B/C/D)
      const room = (i % 3) + 1;
      const rack = String((i % 12) + 1).padStart(2, '0');
      const col = String((i % 8) + 1).padStart(2, '0');
      const row = String((i % 6) + 1).padStart(2, '0');
      const suffix = ['A', 'B', 'C', 'D'][i % 4];
      const location = `TN ${room}.${rack}.${col}.${row}${suffix}`;
      
      const unit = units[i % units.length];
      const stock = Math.floor(Math.sin(i) * 150 + 200) % 350;
      const minStock = 15 + (i % 30);

      const item: InventoryItem = {
        id: `item-bulk-${idx}`,
        material_code: code,
        name,
        category: cat,
        description: `Material standar industri pergudangan spesifikasi ${name} untuk operasional fasilitas.`,
        location,
        unit,
        current_stock: Math.max(0, stock),
        min_stock: minStock,
        created_at: now,
        updated_at: now,
      };

      this.memoryItems.set(item.id, item);

      // IndexedDB persistence in chunks
      if (this.db && i % 100 === 0) {
        await this.putToStore(STORE_ITEMS, item);
      }

      if (i % batchSize === 0 && onProgress) {
        onProgress(currentCount + i, TARGET);
        // Yield thread
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (onProgress) onProgress(TARGET, TARGET);
    return this.memoryItems.size;
  }

  async resetDatabase(): Promise<void> {
    await this.init();
    this.memoryItems.clear();
    this.memoryTransactions = [];
    if (this.db) {
      await this.clearStore(STORE_ITEMS);
      await this.clearStore(STORE_TRANSACTIONS);
    }
    // Re-seed with default
    for (const item of SEED_ITEMS) {
      this.memoryItems.set(item.id, item);
      await this.putToStore(STORE_ITEMS, item);
    }
    for (const tx of SEED_TRANSACTIONS) {
      this.memoryTransactions.push(tx);
      await this.putToStore(STORE_TRANSACTIONS, tx);
    }
  }
}

export const db = new WarehouseDB();
