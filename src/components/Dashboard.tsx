import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore, COLLECTIONS } from '../services/firebase';
import { useCloudSync } from '../hooks/useCloudSync';
import { 
  Boxes, 
  Package, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scan, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  ExternalLink, 
  Clock, 
  Printer, 
  Zap, 
  Sparkles, 
  CheckCircle2,
  Cloud,
  RefreshCw,
  Download,
  Shield,
  User as UserIcon,
  Check,
  ChevronDown,
  X,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
  Users,
  FileText,
  Edit3,
  MessageSquare,
  Tag
} from 'lucide-react';
import { InventoryItem, Transaction, StockSummary, LowStockActionStatus } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { exportUserTransactionsToExcel, exportAllTransactionsToExcel } from '../utils/exportTransactions';
import { formatUnit } from '../utils/units';
import { formatStandardRoleName } from '../utils/roleFormat';

interface DashboardProps {
  onSelectItem: (item: InventoryItem) => void;
  onOpenScanner: () => void;
  onOpenAddItem: () => void;
  onOpenImportCsv: () => void;
  onGoToItemsTab: () => void;
  onOpenSyncGuide?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectItem,
  onOpenScanner,
  onOpenAddItem,
  onOpenImportCsv,
  onGoToItemsTab,
  onOpenSyncGuide,
}) => {
  const { user, isAdmin, isSupervisor, isEvaluator, canEditLowStockStatus } = useAuth();
  const standardName = user ? formatStandardRoleName(user.name || user.role) : '';
  const syncInfo = useCloudSync();
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [criticalItems, setCriticalItems] = useState<InventoryItem[]>([]);
  const [quickSearch, setQuickSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userTxCount, setUserTxCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // Evaluator PR Notes Modal State
  const [editingNoteItem, setEditingNoteItem] = useState<InventoryItem | null>(null);
  const [noteInputText, setNoteInputText] = useState('');
  const [noteStatus, setNoteStatus] = useState<LowStockActionStatus>('MINIMUM');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Real-time Firestore onSnapshot listeners with automatic cleanup
  useEffect(() => {
    let isMounted = true;

    // 1. Real-time items listener for stock summaries and critical low-stock items
    const unsubItems = onSnapshot(
      collection(firestore, COLLECTIONS.ITEMS),
      (snapshot) => {
        let totalItems = 0;
        let totalStock = 0;
        let outOfStock = 0;
        let lowStock = 0;
        let fpaCount = 0;
        let nonFpaCount = 0;
        const lowItems: InventoryItem[] = [];

        snapshot.forEach((docSnap) => {
          const item = docSnap.data() as InventoryItem;
          if (item) {
            totalItems++;
            const stock = item.current_stock ?? 0;
            const min = item.min_stock ?? 0;
            totalStock += stock;
            if (stock <= 0) {
              outOfStock++;
              lowItems.push({ ...item, id: docSnap.id || item.id, unit: formatUnit(item.unit) });
            } else if (stock <= min) {
              lowStock++;
              lowItems.push({ ...item, id: docSnap.id || item.id, unit: formatUnit(item.unit) });
            }

            const fpa = (item.fpa_type || 'NON_FPA').toUpperCase();
            if (fpa === 'FPA' || fpa.includes('KONTRAK')) {
              fpaCount++;
            } else {
              nonFpaCount++;
            }
          }
        });

        if (isMounted) {
          setSummary({
            total_items: totalItems,
            total_stock: totalStock,
            out_of_stock_items: outOfStock,
            low_stock_items: lowStock,
            fpa_items_count: fpaCount,
            non_fpa_items_count: nonFpaCount,
          });
          setCriticalItems(lowItems.slice(0, 25));
        }
      },
      (err) => {
        console.warn('[Dashboard] Items onSnapshot fallback to local DB:', err);
        db.getStockSummary().then((st) => isMounted && setSummary(st));
        db.getItems({ stockFilter: 'low', pageSize: 25 }).then((res) => isMounted && setCriticalItems(res.items));
      }
    );

    // 2. Real-time transactions listener for recent activity
    const qTx = query(
      collection(firestore, COLLECTIONS.TRANSACTIONS),
      orderBy('transaction_date', 'desc'),
      limit(50)
    );
    const unsubTx = onSnapshot(
      qTx,
      (snapshot) => {
        const txs: Transaction[] = [];
        let myCount = 0;
        const cleanUser = user?.username?.toLowerCase() || '';
        const cleanName = user?.name?.toLowerCase() || '';

        snapshot.forEach((docSnap) => {
          const t = docSnap.data() as Transaction;
          if (t) {
            txs.push({ ...t, id: docSnap.id || t.id });
            if (
              cleanUser &&
              ((t.operator_username && t.operator_username.toLowerCase() === cleanUser) ||
                (t.pic_name && t.pic_name.toLowerCase().includes(cleanName)))
            ) {
              myCount++;
            }
          }
        });

        if (isMounted) {
          setRecentTransactions(txs.slice(0, 8));
          setUserTxCount(myCount);
        }
      },
      (err) => {
        console.warn('[Dashboard] Transactions onSnapshot fallback:', err);
        db.getRecentTransactions(8).then((tx) => isMounted && setRecentTransactions(tx));
      }
    );

    // 3. Also subscribe to local DB event bus as backup
    const unsubLocal = db.subscribe(() => {
      db.getStockSummary().then((st) => isMounted && setSummary(st));
      db.getRecentTransactions(8).then((tx) => isMounted && setRecentTransactions(tx));
    });

    return () => {
      isMounted = false;
      unsubItems();
      unsubTx();
      unsubLocal();
    };
  }, [user]);

  // Quick search handler with immediate responsive debounce and error tolerance
  useEffect(() => {
    const q = quickSearch.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await db.getItems({ search: q, pageSize: 10 });
        setSearchResults(res.items);
      } catch (e) {
        console.error('Quick search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [quickSearch]);

  const handleExportMyTransactions = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const myTxs = await db.getUserTransactions(user.username, user.name);
      if (myTxs.length === 0) {
        alert(`Belum ada riwayat transaksi yang tercatat atas nama akun '${user.name}'. Lakukan mutasi barang masuk/keluar untuk mencatat transaksi.`);
        return;
      }
      exportUserTransactionsToExcel(myTxs, user);
    } catch (err) {
      console.error('Failed to export user transactions:', err);
      alert('Terjadi kesalahan saat mengekspor riwayat transaksi.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateLowStockStatus = async (itemId: string, newStatus: LowStockActionStatus) => {
    if (!canEditLowStockStatus) {
      alert('Hanya akun dengan role Evaluator yang berwenang mengubah status pengadaan stok menipis.');
      return;
    }
    setUpdatingItemId(itemId);
    try {
      await db.updateLowStockStatus(itemId, newStatus, user?.name || 'Evaluator');
    } catch (err) {
      console.error('Update status error:', err);
      alert('Gagal memperbarui status pengadaan stok.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleOpenNoteModal = (item: InventoryItem) => {
    setEditingNoteItem(item);
    setNoteInputText(item.low_stock_notes || '');
    setNoteStatus(item.low_stock_status || 'MINIMUM');
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteItem) return;
    if (!canEditLowStockStatus) {
      alert('Hanya role Evaluator yang dapat mengisi atau memperbarui keterangan PR Request.');
      return;
    }

    setIsSavingNote(true);
    try {
      await db.updateLowStockStatus(
        editingNoteItem.id,
        noteStatus,
        user?.name || 'Evaluator',
        noteInputText.trim()
      );
      setEditingNoteItem(null);
    } catch (err) {
      console.error('Failed to save low stock note:', err);
      alert('Gagal menyimpan keterangan PR Request.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const addQuickTemplate = (text: string) => {
    setNoteInputText((prev) => (prev ? `${prev}. ${text}` : text));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Welcome & Warehouse Operational Bar */}
      <div className="hero-card bg-gradient-to-r from-[#0A192F] via-[#1E3A8A] to-[#0A192F] text-white rounded-2xl p-6 sm:p-8 shadow-lg relative isolate">
        {/* Subtle grid pattern background contained in isolated absolute wrapper to prevent WebKit clipping */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none -z-10">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-xs">
                SISTEM GUDANG AKTIF
              </span>
            </div>
            <h1 className="hero-title text-2xl sm:text-3xl font-black tracking-tight text-white">
              Warehouse Management Inventory
            </h1>
          </div>

          {/* Quick Trigger Buttons - Crisp solid backgrounds without WebKit blur artifacts */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md border border-emerald-400/40 transition-all cursor-pointer"
            >
              <Scan className="w-4 h-4 animate-pulse text-white" />
              <span className="text-white font-bold">Scan</span>
            </button>

            {(isSupervisor || isAdmin) && (
              <>
                <button
                  onClick={onOpenAddItem}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0A192F] hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl border border-blue-400/30 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span className="text-white font-bold">Tambah</span>
                </button>
                <button
                  onClick={onOpenImportCsv}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0A192F] hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl border border-blue-400/30 shadow-sm transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-bold">Import</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Integrated Quick Search Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 relative">
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuickSearch('');
                  setSearchResults([]);
                }
              }}
              placeholder="Cari kode material (contoh: 031007000000000235), nama barang, atau lokasi BIN..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-600 text-white placeholder-slate-400 text-xs rounded-xl focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
            />
            {quickSearch.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setQuickSearch('');
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                title="Hapus pencarian (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : isSearching ? (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                Mencari...
              </span>
            ) : null}
          </div>

          {/* Search Results Dropdown Overlay - Not clipped because container is not overflow-hidden */}
          {quickSearch.trim().length > 0 && (
            <div className="absolute top-full left-0 mt-2 max-w-xl w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-900 divide-y divide-slate-100">
              <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                <span>
                  {isSearching ? 'Sedang mencari...' : `Hasil Pencarian (${searchResults.length})`}
                </span>
                <span className="text-indigo-600 text-[10px]">
                  Klik item untuk membuka Kartu Barang
                </span>
              </div>

              {searchResults.length > 0 ? (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectItem(item);
                        setQuickSearch('');
                        setSearchResults([]);
                      }}
                      className="p-3 hover:bg-indigo-50/80 cursor-pointer flex items-center justify-between transition-colors text-xs group"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[11px]">
                            {item.material_code}
                          </span>
                          <span className="font-semibold text-slate-900 group-hover:text-indigo-900 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {item.category}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            Lokasi BIN: <strong className="text-indigo-700">{item.location}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.current_stock} <span className="text-xs font-normal text-slate-600">{item.unit}</span>
                        </span>
                        <span className="text-[10px] block text-slate-400">Stok saat ini</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="p-5 text-center text-slate-500">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-800 text-xs">Barang tidak ditemukan</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Tidak ada barang dengan kode material, nama, atau lokasi BIN yang cocok dengan "{quickSearch}".
                  </p>
                </div>
              ) : null}

              <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onGoToItemsTab();
                    setQuickSearch('');
                    setSearchResults([]);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  Buka Modul Manajemen Barang &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Session & Transaction Export Bar */}
      {user && (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
              isEvaluator
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : isSupervisor
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {isEvaluator ? (
                <ClipboardCheck className="w-5 h-5 text-purple-700" />
              ) : isSupervisor ? (
                <ShieldCheck className="w-5 h-5 text-blue-700" />
              ) : (
                <Users className="w-5 h-5 text-emerald-700" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm">{standardName}</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isEvaluator
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : isSupervisor
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Sesi Aktif
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportMyTransactions}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>{isExporting ? 'Membuat...' : 'Unduh Excel'}</span>
              <span className="bg-emerald-700/80 px-1.5 py-0.5 rounded text-[10px]">
                {userTxCount}
              </span>
            </button>

            {(isAdmin || isSupervisor) && recentTransactions.length > 0 && (
              <button
                onClick={() => exportAllTransactionsToExcel(recentTransactions)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Semua</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Kategori/Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Total Item Barang</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              {summary ? summary.totalItems.toLocaleString('id-ID') : '...'}
            </span>
            <span className="text-xs text-slate-700 font-bold">SKU</span>
          </div>
        </div>

        {/* PR Request (Stok Kritis / Habis) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">PR Request</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">
              {summary ? (summary.lowStockCount + summary.outOfStockCount).toLocaleString('id-ID') : '...'}
            </span>
            <span className="text-xs text-slate-700 font-bold">item</span>
          </div>
        </div>

        {/* Mutasi Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Mutasi Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
              <span className="text-xl font-extrabold text-emerald-800">+{summary?.totalInToday || 0}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <ArrowUpRight className="w-4 h-4 text-rose-700" />
              <span className="text-xl font-extrabold text-rose-800">-{summary?.totalOutToday || 0}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Evaluator Feature: Tracking Status Stock Menipis Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                PR Request
              </h3>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                {criticalItems.length}
              </span>
            </div>
          </div>

          {/* Color-Coded Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
              🔴 PR Request
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              🟢 Diproses
            </span>
          </div>
        </div>

        {criticalItems.length === 0 ? (
          <div className="p-8 bg-emerald-50/90 border border-emerald-300 rounded-xl text-xs text-emerald-950 text-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-700 mx-auto mb-2" />
            <span className="font-bold block text-sm text-emerald-950">Seluruh stok barang dalam kondisi aman!</span>
            <span className="text-emerald-900 text-xs font-medium">Tidak ada persediaan barang yang berada di bawah batas minimum (ROP).</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 text-[11px] uppercase font-bold border-b border-slate-300">
                <tr>
                  <th className="py-3 px-3">Material Number & Tipe</th>
                  <th className="py-3 px-3">Nama Barang & Lokasi</th>
                  <th className="py-3 px-3 text-center">Unrestricted Stock</th>
                  <th className="py-3 px-3 text-center">ROP</th>
                  <th className="py-3 px-3">Status Pengadaan (Evaluator)</th>
                  <th className="py-3 px-3 min-w-[200px]">Keterangan Evaluator</th>
                  <th className="py-3 px-3">Terakhir Diperbarui</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {criticalItems.map((item) => {
                  const status = item.low_stock_status || 'MINIMUM';
                  const isProcessed = status === 'PROCESSED' || status === 'PR_PROCESSED' || status === 'ARRIVED';
                  const isUpdating = updatingItemId === item.id;
                  const isFpa = item.fpa_type === 'FPA';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-mono font-bold text-slate-950 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                            {item.material_code}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            isFpa
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isFpa ? 'bg-blue-600' : 'bg-slate-500'}`} />
                            {isFpa ? 'FPA' : 'Non-FPA'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 min-w-[140px]">
                        <div className="font-bold text-slate-950 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-700 font-medium">Rak BIN: {item.location} • {item.category}</div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`font-mono font-extrabold text-sm ${
                          item.current_stock === 0 ? 'text-rose-800' : 'text-amber-800'
                        }`}>
                          {item.current_stock} {formatUnit(item.unit)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono font-bold text-slate-800">
                        {item.min_stock} {formatUnit(item.unit)}
                      </td>
                      <td className="py-3 px-3">
                        {canEditLowStockStatus ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={isProcessed ? 'PROCESSED' : 'MINIMUM'}
                              disabled={isUpdating}
                              onChange={(e) => handleUpdateLowStockStatus(item.id, e.target.value as LowStockActionStatus)}
                              className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border shadow-2xs transition-all cursor-pointer focus:outline-hidden ${
                                isProcessed
                                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                                  : 'bg-rose-100 text-rose-950 border-rose-400'
                              }`}
                            >
                              <option value="MINIMUM">🔴 Merah: PR Request</option>
                              <option value="PROCESSED">🟢 Hijau: Sudah Diproses</option>
                            </select>
                            {isUpdating && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-700" />}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                              isProcessed
                                ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                                : 'bg-rose-100 text-rose-950 border-rose-400'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                isProcessed ? 'bg-emerald-600' : 'bg-rose-600 animate-pulse'
                              }`} />
                              {isProcessed ? 'Sudah Diproses' : 'PR Request'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Keterangan Evaluator Column */}
                      <td className="py-3 px-3 text-slate-800 text-xs">
                        <div className="space-y-1">
                          {item.low_stock_notes ? (
                            <div className="bg-amber-50/70 border border-amber-200 p-2 rounded-lg text-slate-900 font-medium text-xs flex items-start gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                              <span className="leading-snug">{item.low_stock_notes}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] block">- Belum ada keterangan -</span>
                          )}

                          {canEditLowStockStatus && (
                            <button
                              type="button"
                              onClick={() => handleOpenNoteModal(item)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{item.low_stock_notes ? 'Edit Keterangan' : '+ Tulis Keterangan'}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-700 text-[11px] whitespace-nowrap">
                        {item.low_stock_updated_at ? (
                          <div>
                            <span className="font-bold text-slate-800">{item.low_stock_updated_by || 'Evaluator'}</span>
                            <div className="text-[10px] text-slate-600 font-medium">
                              {new Date(item.low_stock_updated_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">- Belum ada update -</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => onSelectItem(item)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors text-[11px] cursor-pointer"
                        >
                          Buka
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evaluator Notes & Status Update Modal */}
      {editingNoteItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-[#0A192F] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white">
                    Keterangan PR Request (Khusus Evaluator)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Catat nomor PR, progres PO, tindak lanjut, atau instruksi pengadaan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingNoteItem(null)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveNote} className="p-6 space-y-4">
              {/* Item Info Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                    {editingNoteItem.material_code}
                  </span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    editingNoteItem.fpa_type === 'FPA'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : 'bg-slate-200 text-slate-800'
                  }`}>
                    {editingNoteItem.fpa_type === 'FPA' ? 'FPA (Kontrak)' : 'Non-FPA'}
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-sm">{editingNoteItem.name}</div>
                <div className="text-slate-600 flex items-center gap-3">
                  <span>Stok Fisik: <strong className="text-rose-700">{editingNoteItem.current_stock} {formatUnit(editingNoteItem.unit)}</strong></span>
                  <span>•</span>
                  <span>Batas ROP: <strong className="text-slate-900">{editingNoteItem.min_stock} {formatUnit(editingNoteItem.unit)}</strong></span>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Status Pengadaan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteStatus('MINIMUM')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      noteStatus === 'MINIMUM'
                        ? 'bg-rose-100 text-rose-950 border-rose-400 ring-2 ring-rose-300'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                    <span>🔴 PR Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteStatus('PROCESSED')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      noteStatus === 'PROCESSED'
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400 ring-2 ring-emerald-300'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span>🟢 Sudah Diproses</span>
                  </button>
                </div>
              </div>

              {/* Note Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Tulis Keterangan / Tindak Lanjut PR:
                </label>
                <textarea
                  value={noteInputText}
                  onChange={(e) => setNoteInputText(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Nomor PR: PR-2026-09-089 sudah dibuat, menunggu approval Dept Head / PO sudah diterbitkan ke vendor..."
                  className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800 placeholder-slate-400"
                />
              </div>

              {/* Quick Template Buttons */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Template Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'PR sedang diajukan',
                    'Menunggu approval Kadep',
                    'PO sudah terbit',
                    'Estimasi kirim minggu ini',
                    'Barang dalam proses impor',
                    'Stok pengganti tersedia di gudang 2'
                  ].map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => addQuickTemplate(tpl)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-300 transition-colors cursor-pointer"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingNoteItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingNote ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Keterangan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Transactions Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider">
              Riwayat Transaksi
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportMyTransactions}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button
              onClick={onGoToItemsTab}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Semua</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl">
            Belum ada transaksi tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 text-[11px] uppercase font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Material Number & Nama Barang</th>
                  <th className="py-2.5 px-3 text-center">Jenis</th>
                  <th className="py-2.5 px-3 text-right">Jumlah</th>
                  <th className="py-2.5 px-3">Reservation/PO number</th>
                  <th className="py-2.5 px-3">Petugas (PIC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentTransactions.map((tx) => {
                  const isIn = tx.transaction_type === 'IN';
                  const timeStr = new Date(tx.transaction_date).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                  const dateStr = new Date(tx.transaction_date).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-800 text-[11px]">
                        <span className="font-bold text-slate-950">{dateStr}</span> {timeStr}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-950 mr-2">{tx.material_code}</span>
                        <span className="text-slate-950 font-semibold truncate inline-block max-w-[140px] sm:max-w-[240px] align-bottom">
                          {tx.item_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isIn ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-rose-100 text-rose-950 border border-rose-300'
                        }`}>
                          {isIn ? <ArrowDownLeft className="w-3 h-3 text-emerald-700" /> : <ArrowUpRight className="w-3 h-3 text-rose-700" />}
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-extrabold text-xs ${
                        isIn ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-mono text-[11px] font-medium">
                        {tx.doc_ref || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 truncate max-w-[100px] sm:max-w-[140px] font-bold">
                        {formatStandardRoleName(tx.pic_name)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
