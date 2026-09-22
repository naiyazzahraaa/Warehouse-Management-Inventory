import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore, COLLECTIONS } from '../services/firebase';
import { 
  Search, 
  Filter, 
  Plus, 
  FileSpreadsheet, 
  Printer, 
  QrCode, 
  Edit3, 
  Trash2, 
  Eye, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Sparkles, 
  Zap, 
  RefreshCw, 
  MapPin, 
  Layers,
  ClipboardCheck
} from 'lucide-react';
import { InventoryItem } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { StockTakeModal } from './StockTakeModal';
import { formatUnit } from '../utils/units';
import { exportInventoryItemsToExcel } from '../utils/exportTransactions';

interface ItemManagementProps {
  onOpenBinCard: (item: InventoryItem) => void;
  onOpenAddItem: () => void;
  onOpenEditItem: (item: InventoryItem) => void;
  onOpenImportCsv: () => void;
  onOpenBatchPrint: (items: InventoryItem[]) => void;
  onRecordTransaction: (item: InventoryItem, type: 'IN' | 'OUT') => void;
  refreshTrigger?: number;
}

export const ItemManagement: React.FC<ItemManagementProps> = ({
  onOpenBinCard,
  onOpenAddItem,
  onOpenEditItem,
  onOpenImportCsv,
  onOpenBatchPrint,
  onRecordTransaction,
  refreshTrigger,
}) => {
  const { isAdmin, isSupervisor } = useAuth();
  const [stoItem, setStoItem] = useState<InventoryItem | null>(null);
  
  // Query States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [fpaFilter, setFpaFilter] = useState<'all' | 'FPA' | 'NON_FPA'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'normal' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'stock' | 'updated'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [jumpPage, setJumpPage] = useState('');

  // Data & Selection States (powered by real-time Firestore onSnapshot)
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Real-time Firestore onSnapshot listener with cleanup
  useEffect(() => {
    setIsLoading(true);
    let isMounted = true;

    const unsubscribeFirestore = onSnapshot(
      collection(firestore, COLLECTIONS.ITEMS),
      (snapshot) => {
        const fetched: InventoryItem[] = [];
        snapshot.forEach((docSnap) => {
          const it = docSnap.data() as InventoryItem;
          if (it) {
            fetched.push({
              ...it,
              id: docSnap.id || it.id,
              unit: formatUnit(it.unit),
            });
          }
        });
        if (isMounted) {
          setAllItems(fetched);
          setIsLoading(false);
        }
      },
      (error) => {
        console.warn('[ItemManagement] Firestore onSnapshot fallback to local:', error);
        db.getItems({ page: 1, pageSize: 10000 }).then((res) => {
          if (isMounted) {
            setAllItems(res.items);
            setIsLoading(false);
          }
        });
      }
    );

    const unsubscribeDb = db.subscribe(async () => {
      const res = await db.getItems({ page: 1, pageSize: 10000 });
      if (isMounted) {
        setAllItems(res.items);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFirestore();
      unsubscribeDb();
    };
  }, [refreshTrigger]);

  // Derive categories from live items
  const categories = useMemo(() => {
    return Array.from(new Set(allItems.map((i) => i.category).filter(Boolean))).sort();
  }, [allItems]);

  // Derive filtered and sorted items in memory for instantaneous zero-latency filtering
  const filteredItems = useMemo(() => {
    let list = allItems;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          (i.material_code && i.material_code.toLowerCase().includes(q)) ||
          (i.name && i.name.toLowerCase().includes(q)) ||
          (i.category && i.category.toLowerCase().includes(q)) ||
          (i.location && i.location.toLowerCase().includes(q)) ||
          (i.fpa_type && i.fpa_type.toLowerCase().includes(q)) ||
          (i.low_stock_notes && i.low_stock_notes.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter((i) => i.category === selectedCategory);
    }

    if (fpaFilter !== 'all') {
      list = list.filter((i) => {
        const itemFpa = (i.fpa_type || 'NON_FPA').toString().toUpperCase().trim();
        if (fpaFilter === 'FPA') {
          return itemFpa === 'FPA' || itemFpa === 'KONTRAK' || itemFpa.includes('KONTRAK');
        } else {
          return itemFpa === 'NON_FPA' || itemFpa === 'NON-FPA' || itemFpa === 'NON FPA' || itemFpa === 'REGULER' || !i.fpa_type;
        }
      });
    }

    if (stockFilter !== 'all') {
      if (stockFilter === 'out') {
        list = list.filter((i) => (i.current_stock ?? 0) <= 0);
      } else if (stockFilter === 'low') {
        list = list.filter((i) => (i.current_stock ?? 0) <= (i.min_stock ?? 0));
      } else if (stockFilter === 'normal') {
        list = list.filter((i) => (i.current_stock ?? 0) > (i.min_stock ?? 0));
      }
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'code') {
        cmp = (a.material_code || '').localeCompare(b.material_code || '', undefined, { numeric: true });
      } else if (sortBy === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'stock') {
        cmp = (a.current_stock ?? 0) - (b.current_stock ?? 0);
      } else if (sortBy === 'updated') {
        cmp = new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [allItems, search, selectedCategory, fpaFilter, stockFilter, sortBy, sortOrder]);

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Current page items
  const items = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, fpaFilter, stockFilter, pageSize]);

  // Selection handlers for Batch Print
  const handleToggleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    const allSelected = items.every((it) => next.has(it.id));
    if (allSelected) {
      items.forEach((it) => next.delete(it.id));
    } else {
      items.forEach((it) => next.add(it.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleTriggerBatchPrint = async () => {
    if (selectedIds.size === 0) return;
    const selectedList = allItems.filter((it) => selectedIds.has(it.id));
    onOpenBatchPrint(selectedList);
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Hapus data barang '${item.name}' (${item.material_code}) beserta seluruh riwayat transaksinya? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    try {
      await db.deleteItem(item.id);
      // Remove from selection if was selected
      if (selectedIds.has(item.id)) {
        const next = new Set(selectedIds);
        next.delete(item.id);
        setSelectedIds(next);
      }
    } catch (err: any) {
      alert(`Gagal menghapus barang: ${err.message}`);
    }
  };

  const handleExportItems = async () => {
    try {
      setIsLoading(true);
      const res = exportInventoryItemsToExcel(filteredItems);
      alert(`Berhasil mengekspor ${res.count} data barang ke file ${res.filename}`);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Gagal mengekspor data barang: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const isAllCurrentPageSelected = items.length > 0 && items.every((it) => selectedIds.has(it.id));

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16" style={{ borderColor: '#000000' }}>
      
      {/* Control Toolbar Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        
        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Daftar Barang & Inventaris Fisik
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {(totalItems ?? 0).toLocaleString('id-ID')} Total Barang
              </span>
            </h2>
            <p className="text-xs text-slate-600 font-normal">
              Cari nomor material, cetak stiker label QR, dan kelola mutasi stok
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* RBAC: Admin and Supervisor can Tambah Barang and Import CSV */}
            {(isAdmin || isSupervisor) && (
              <>
                <button
                  onClick={onOpenAddItem}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A8A] text-white font-bold hover:bg-blue-900 active:scale-95 text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Barang</span>
                </button>

                <button
                  onClick={onOpenImportCsv}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-all cursor-pointer"
                  title="Import data massal menggunakan file format Excel (.xlsx) atau CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Import Excel / CSV</span>
                </button>
              </>
            )}

            {/* Export Master Barang to Excel */}
            <button
              onClick={handleExportItems}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-all cursor-pointer"
              title="Ekspor seluruh data barang ke format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            {/* Bulk Print Trigger (Enabled when items are selected) */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleTriggerBatchPrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-900 border border-blue-300 hover:bg-blue-100 font-bold text-xs rounded-lg transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Label QR ({selectedIds.size})</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
          
          {/* Search Box */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, nama, atau BIN..."
              className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-indigo-500 rounded-lg text-xs font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 hover:text-slate-900"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-indigo-500 rounded-lg text-xs font-medium"
            >
              <option value="all">Semua Kategori ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* FPA / Non-FPA Filter */}
          <div>
            <select
              value={fpaFilter}
              onChange={(e) => setFpaFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-indigo-500 rounded-lg text-xs font-medium"
            >
              <option value="all">Klasifikasi: Semua (FPA & Non-FPA)</option>
              <option value="FPA">⭐ Hanya FPA (Kontrak)</option>
              <option value="NON_FPA">📦 Hanya Non-FPA (Reguler)</option>
            </select>
          </div>

          {/* Stock Level Filter */}
          <div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-indigo-500 rounded-lg text-xs font-medium"
            >
              <option value="all">Status Stok: Semua</option>
              <option value="normal">Stok Aman (&gt; ROP)</option>
              <option value="low">Stok Kritis (≤ ROP)</option>
              <option value="out">Stok Habis (= 0)</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-indigo-500 rounded-lg text-xs font-medium"
            >
              <option value="code">Urutkan: Kode</option>
              <option value="name">Urutkan: Nama</option>
              <option value="stock">Urutkan: Stok</option>
              <option value="updated">Urutkan: Update</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-700 transition-colors cursor-pointer"
              title={`Urutan: ${sortOrder === 'asc' ? 'Menaik (A-Z)' : 'Menurun (Z-A)'}`}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Floating Selection Banner for Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-900 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>{selectedIds.size} barang</strong> dipilih untuk cetak label
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              className="px-2.5 py-1 text-slate-300 hover:text-white text-xs underline cursor-pointer"
            >
              Batalkan Pilihan
            </button>
            <button
              onClick={handleTriggerBatchPrint}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Items Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {isLoading && (
          <div className="h-1 bg-indigo-600 animate-pulse" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-200/80 text-slate-800 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={handleToggleSelectAllOnPage}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Pilih semua di halaman ini"
                  />
                </th>
                <th className="py-3 px-3 w-32 sm:w-44 whitespace-nowrap">Material Number</th>
                <th className="py-3 px-4 min-w-[150px] sm:min-w-[200px]">Nama Barang & Spesifikasi</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Lokasi BIN</th>
                <th className="py-3 px-3 text-right">Unrestricted Stock</th>
                <th className="py-3 px-4 text-center">Aksi & Kartu Barang</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-600 font-normal">
                    <p className="font-bold text-xs text-slate-900">Tidak ada barang yang cocok</p>
                    <p className="text-[11px] mt-1">Coba sesuaikan kata kunci pencarian atau filter kategori.</p>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const isSelected = selectedIds.has(item.id);
                  const isOut = item.current_stock <= 0;
                  const isLow = item.current_stock > 0 && item.current_stock <= item.min_stock;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(item.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Material Code */}
                      <td className="py-3 px-3 whitespace-nowrap" style={idx === 0 ? { borderColor: '#0f2b1d' } : undefined}>
                        <div className="flex flex-col items-start gap-1">
                          <button
                            onClick={() => onOpenBinCard(item)}
                            className="font-mono font-bold text-xs text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                            title="Buka Kartu Barang Digital (Bin Card)"
                          >
                            <span>{item.material_code}</span>
                          </button>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${
                            item.fpa_type === 'FPA'
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.fpa_type === 'FPA' ? 'bg-blue-600' : 'bg-slate-500'}`} />
                            {item.fpa_type === 'FPA' ? 'FPA' : 'Non-FPA'}
                          </span>
                        </div>
                      </td>

                      {/* Name & Description */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => onOpenBinCard(item)}
                          className="font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                        >
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-600 font-normal line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-normal">
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {item.category}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-normal">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded">
                          <MapPin className="w-3 h-3 text-amber-500" />
                          {item.location}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className={`font-extrabold font-mono text-sm ${
                          isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                        }`}>
                          {item.current_stock}{' '}
                          <span className="text-[10px] font-normal text-slate-600">{formatUnit(item.unit)}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-normal">
                          ROP: {item.min_stock} {formatUnit(item.unit)}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          
                          {/* Bin Card Button */}
                          <button
                            onClick={() => onOpenBinCard(item)}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-medium rounded-md text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Buka Kartu Barang Digital"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Bin Card</span>
                          </button>

                          {/* Quick STO Button */}
                          <button
                            onClick={() => setStoItem(item)}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-medium rounded-md text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Stock Take / STO (Opname Fisik Barang)"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            <span>STO</span>
                          </button>

                          {/* Tombol Edit Barang */}
                          <button
                            onClick={() => onOpenEditItem(item)}
                            className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 font-medium rounded-md text-[11px] flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                            title="Edit Barang (Ubah rincian informasi seperti nama, Bin Location, satuan, dll.)"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>

                          {/* Quick In/Out buttons for field staff and admin */}
                          <button
                            onClick={() => onRecordTransaction(item, 'IN')}
                            className="p-1 text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-md transition-colors cursor-pointer"
                            title="Catat Pemasukan (IN)"
                          >
                            <ArrowDownLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onRecordTransaction(item, 'OUT')}
                            disabled={isOut}
                            className="p-1 text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                            title="Catat Pengeluaran (OUT)"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>

                          {/* Single QR Print/View */}
                          <button
                            onClick={() => onOpenBatchPrint([item])}
                            className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Cetak Label QR Barang Ini"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {/* Hapus Barang (Hanya Admin / Supervisor) */}
                          {(isAdmin || isSupervisor) && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Hapus Barang"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* High Performance Pagination Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-normal">
              Menampilkan{' '}
              <strong>
                {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, totalItems)}
              </strong>{' '}
              dari <strong>{(totalItems ?? 0).toLocaleString('id-ID')}</strong> barang
            </span>

            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-normal">Per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-normal text-slate-600">
              Hal. <strong>{page}</strong> dari <strong>{totalPages}</strong>
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Jump to Page input (Crucial for 6,000+ items navigation!) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const p = parseInt(jumpPage, 10);
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                  setPage(p);
                  setJumpPage('');
                }
              }}
              className="flex items-center gap-1 ml-2"
            >
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder="Ke hal..."
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[11px] font-semibold cursor-pointer"
              >
                Go
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* Stock Take / STO Modal */}
      {stoItem && (
        <StockTakeModal
          isOpen={!!stoItem}
          item={stoItem}
          onClose={() => setStoItem(null)}
          onSuccess={() => {
            setStoItem(null);
          }}
        />
      )}

    </div>
  );
};
