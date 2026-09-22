export type UserRole = 'supervisor' | 'staff' | 'evaluator' | 'reviewer' | 'admin';

export type LowStockActionStatus = 'MINIMUM' | 'PROCESSED' | 'UNPROCESSED' | 'PR_REQUIRED' | 'PR_PROCESSED' | 'ARRIVED';

export type StaffGroup = 'Group A' | 'Group B' | 'Group C' | 'Group D';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatar?: string;
  department: string;
  group?: StaffGroup | string; // 'Group A', 'Group B', 'Group C', 'Group D'
}

export interface InventoryItem {
  id: string;
  material_code: string;
  name: string;
  category: string;
  fpa_type?: 'FPA' | 'NON_FPA';
  description: string;
  location: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
  low_stock_status?: LowStockActionStatus;
  low_stock_updated_at?: string;
  low_stock_updated_by?: string;
  low_stock_notes?: string;
  last_sto_date?: string;
  last_sto_by?: string;
  last_sto_diff?: number;
  last_sto_physical?: number;
  last_sto_doc?: string;
  last_sto_notes?: string;
}

export type TransactionType = 'IN' | 'OUT' | 'STO';

export interface Transaction {
  id: string;
  item_id: string;
  material_code: string;
  item_name: string;
  transaction_type: TransactionType;
  quantity: number;
  balance_after: number;
  pic_name: string;
  operator_username?: string;
  transaction_date: string;
  notes: string;
  doc_ref: string; // No. Surat Jalan / PO / SPK (Mandatory)
  created_at?: string;
}

export interface StockSummary {
  totalItems: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInToday: number;
  totalOutToday: number;
  totalTransactionsCount: number;
  total_items?: number;
  total_stock?: number;
  low_stock_items?: number;
  out_of_stock_items?: number;
  fpa_items_count?: number;
  non_fpa_items_count?: number;
}

export interface CsvItemRow {
  material_code: string;
  name: string;
  category: string;
  fpa_type?: 'FPA' | 'NON_FPA' | string;
  description?: string;
  initial_stock: number;
  location?: string;
  unit?: string;
  min_stock?: number;
}

export type CloudSyncStatus = 'connecting' | 'synced' | 'syncing' | 'offline' | 'error';

export interface SyncInfo {
  status: CloudSyncStatus;
  lastSyncedAt: Date | null;
  itemsCount: number;
  txCount: number;
  errorMessage?: string;
}
