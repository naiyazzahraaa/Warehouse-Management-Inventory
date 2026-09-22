import React, { useState, useEffect } from 'react';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore, COLLECTIONS } from '../services/firebase';
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  ArrowDownLeft, 
  ArrowUpRight, 
  QrCode, 
  MapPin, 
  Layers, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Share2, 
  Boxes,
  ClipboardCheck,
  Check,
  Lock,
  Edit3,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { InventoryItem, Transaction } from '../types';
import { db } from '../services/db';
import { generateQrDataUrl, downloadDataUrl } from '../utils/qr';
import { useAuth } from '../context/AuthContext';
import { parseBinLocation } from '../utils/binLocation';
import { StockTakeModal } from './StockTakeModal';
import { formatUnit } from '../utils/units';
import { formatStandardRoleName } from '../utils/roleFormat';
import { formatDateTime24h } from '../utils/dateFormat';

interface DigitalBinCardProps {
  item: InventoryItem;
  onBack: () => void;
  onRecordTransaction: (type: 'IN' | 'OUT') => void;
  onEditItem?: (item: InventoryItem) => void;
}

export const DigitalBinCard: React.FC<DigitalBinCardProps> = ({
  item: initialItem,
  onBack,
  onRecordTransaction,
  onEditItem,
}) => {
  const { isAdmin, isSupervisor } = useAuth();
  const [item, setItem] = useState<InventoryItem>(initialItem);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isStoModalOpen, setIsStoModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setItem(initialItem);
    setIsLoading(true);
    let isMounted = true;

    // Generate QR
    generateQrDataUrl(initialItem.material_code, { width: 300, margin: 1 })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch(console.error);

    // 1. Real-time Firestore onSnapshot for this specific Item
    const unsubItem = onSnapshot(
      doc(firestore, COLLECTIONS.ITEMS, initialItem.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const fresh = docSnap.data() as InventoryItem;
          if (isMounted) {
            setItem({
              ...fresh,
              id: docSnap.id || fresh.id,
              unit: formatUnit(fresh.unit),
            });
            setIsLoading(false);
          }
        }
      },
      (err) => {
        console.warn('[DigitalBinCard] Item onSnapshot fallback to local:', err);
        db.getItemById(initialItem.id).then((fresh) => {
          if (fresh && isMounted) setItem(fresh);
        });
      }
    );

    // 2. Real-time Firestore onSnapshot for Transactions belonging to this item
    const qTx = query(
      collection(firestore, COLLECTIONS.TRANSACTIONS),
      where('item_id', '==', initialItem.id)
    );

    const unsubTx = onSnapshot(
      qTx,
      (snapshot) => {
        const txList: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          const t = docSnap.data() as Transaction;
          if (t) {
            txList.push({ ...t, id: docSnap.id || t.id });
          }
        });
        // Sort descending by date
        txList.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
        if (isMounted) {
          setTransactions(txList);
          setIsLoading(false);
        }
      },
      (err) => {
        console.warn('[DigitalBinCard] Transactions onSnapshot fallback to local:', err);
        db.getItemTransactions(initialItem.id).then((txList) => {
          if (isMounted) {
            setTransactions(txList);
            setIsLoading(false);
          }
        });
      }
    );

    // 3. Subscribe to local DB updates
    const unsubDb = db.subscribe(async () => {
      const fresh = await db.getItemById(initialItem.id);
      const txList = await db.getItemTransactions(initialItem.id);
      if (isMounted) {
        if (fresh) setItem(fresh);
        setTransactions(txList);
      }
    });

    return () => {
      isMounted = false;
      unsubItem();
      unsubTx();
      unsubDb();
    };
  }, [initialItem]);

  const handleDownloadQr = () => {
    if (qrDataUrl) {
      downloadDataUrl(qrDataUrl, `QR-${item.material_code}.png`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(item.material_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Calculate totals
  const totalIn = transactions
    .filter((t) => t.transaction_type === 'IN')
    .reduce((sum, t) => sum + t.quantity, 0);

  const totalOut = transactions
    .filter((t) => t.transaction_type === 'OUT')
    .reduce((sum, t) => sum + t.quantity, 0);

  const isLowStock = item.current_stock <= item.min_stock;
  const isOutOfStock = item.current_stock <= 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Navigation & Action Bar (Hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar</span>
        </button>

        <div className="flex items-center gap-2">
          {onEditItem && (
            <button
              onClick={() => onEditItem(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors shadow-2xs"
              title="Ubah rincian informasi barang (Nama, Bin Location, Spesifikasi, dll.)"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
              <span>Edit Barang</span>
            </button>
          )}

          <button
            onClick={handleDownloadQr}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            title="Unduh file gambar QR Code"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh QR</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors"
            title="Cetak Kartu Barang / Stiker"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Kartu Barang</span>
          </button>
        </div>
      </div>

      {/* Printable Bin Card Container */}
      <div className="print-container bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Physical Bin Card Header Banner */}
        <div className="bg-[#0A192F] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                KARTU BARANG DIGITAL (BIN CARD)
              </span>
              <span className="text-xs text-slate-300">Gudang Utama Logistik</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{item.name}</h1>
            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">{item.description}</p>
            
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div 
                onClick={handleCopyCode}
                className="cursor-pointer group flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 font-bold tracking-wider transition-colors"
                title="Klik untuk salin Material Number"
              >
                <span className="font-mono">{item.material_code}</span>
                <span className="text-[10px] text-slate-300 group-hover:text-slate-100">
                  {copiedCode ? '✓ Tersalin' : '📋'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 ${
                item.fpa_type === 'FPA'
                  ? 'bg-blue-900/60 text-blue-200 border-blue-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${item.fpa_type === 'FPA' ? 'bg-blue-400' : 'bg-slate-400'}`} />
                {item.fpa_type === 'FPA' ? 'Barang FPA (Kontrak)' : 'Non-FPA (Reguler)'}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-200">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                {item.category}
              </span>
              <div className="flex items-center gap-1 text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold font-mono">{item.location}</span>
              </div>
            </div>

            {/* BIN Location Detailed Breakdown: Ruang . Rak . Baris . Tingkat */}
            {(() => {
              const bp = parseBinLocation(item.location);
              return (
                <div className="pt-2 text-[11px] text-slate-300 flex flex-wrap items-center gap-1.5 font-mono">
                  <span className="text-slate-300 font-sans font-semibold text-[10px] uppercase tracking-wider">Format 4 Tingkat:</span>
                  <span className="bg-slate-800/90 px-2 py-0.5 rounded text-slate-200 border border-slate-700 inline-flex items-center gap-1">
                    <span className="text-slate-300 text-[10px] uppercase font-sans">Ruang:</span>
                    <strong className="text-amber-300 font-mono">{bp.ruang}</strong>
                  </span>
                  <span className="text-slate-400 font-bold">.</span>
                  <span className="bg-slate-800/90 px-2 py-0.5 rounded text-slate-200 border border-slate-700 inline-flex items-center gap-1">
                    <span className="text-slate-300 text-[10px] uppercase font-sans">Rak:</span>
                    <strong className="text-amber-300 font-mono">{bp.rak}</strong>
                  </span>
                  <span className="text-slate-400 font-bold">.</span>
                  <span className="bg-slate-800/90 px-2 py-0.5 rounded text-slate-200 border border-slate-700 inline-flex items-center gap-1">
                    <span className="text-slate-300 text-[10px] uppercase font-sans">Baris:</span>
                    <strong className="text-amber-300 font-mono">{bp.baris}</strong>
                  </span>
                  <span className="text-slate-400 font-bold">.</span>
                  <span className="bg-slate-800/90 px-2 py-0.5 rounded text-slate-200 border border-slate-700 inline-flex items-center gap-1">
                    <span className="text-slate-300 text-[10px] uppercase font-sans">Tingkat:</span>
                    <strong className="text-amber-300 font-mono">{bp.tingkat}</strong>
                  </span>
                </div>
              );
            })()}
          </div>

          {/* QR Code Frame */}
          <div className="shrink-0 flex flex-col items-center bg-white p-3 rounded-xl border border-slate-300 shadow-md">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code ${item.material_code}`}
                className="w-28 h-28 object-contain"
              />
            ) : (
              <div className="w-28 h-28 bg-slate-100 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            )}
            <span className="text-[10px] font-mono font-bold text-slate-900 mt-1 tracking-wider">
              {item.material_code}
            </span>
            <span className="text-[9px] text-slate-600 font-semibold uppercase">Scan to Open</span>
          </div>
        </div>

        {/* Stock Status & Metric Summary Grid */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Current Stock Card */}
            <div className={`p-4 rounded-xl border ${
              isOutOfStock
                ? 'bg-rose-50 border-red-300 text-red-900'
                : isLowStock
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Unrestricted Stock</span>
                {isOutOfStock ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#DC2626] text-white">HABIS</span>
                ) : isLowStock ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#EAB308] text-slate-900">KRITIS</span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-600 text-white">AMAN</span>
                )}
              </div>
              <div className="text-3xl font-extrabold tracking-tight">
                {item.current_stock}
                <span className="text-xs font-normal text-slate-600 ml-1.5">{formatUnit(item.unit)}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium mt-1">
                ROP (Reorder Point): {item.min_stock} {formatUnit(item.unit)}
              </p>
            </div>

            {/* Total Inbound */}
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Total Masuk</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                +{totalIn}
                <span className="text-xs font-normal text-slate-600 ml-1">{formatUnit(item.unit)}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Akumulasi penerimaan</p>
            </div>

            {/* Total Outbound */}
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Total Keluar</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                -{totalOut}
                <span className="text-xs font-normal text-slate-600 ml-1">{formatUnit(item.unit)}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Akumulasi pengeluaran</p>
            </div>

            {/* Total Records */}
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Frekuensi Mutasi
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {transactions.length}
                <span className="text-xs font-normal text-slate-600 ml-1">kali</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Aktivitas kartu barang</p>
            </div>

          </div>

          {/* STO (Stock Opname) Audit Status Banner */}
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shrink-0 shadow-xs">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Tools Stock Take / STO (Stock Opname)
                  </span>
                  {item.last_sto_date ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      item.last_sto_diff === 0
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : (item.last_sto_diff || 0) > 0
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-red-100 text-red-800 border-red-300'
                    }`}>
                      {item.last_sto_diff === 0
                        ? '✓ Fisik Sesuai (Akurat)'
                        : (item.last_sto_diff || 0) > 0
                        ? `Surplus +${item.last_sto_diff} ${item.unit}`
                        : `Selisih Kurang ${item.last_sto_diff} ${item.unit}`}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      Belum pernah STO
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {item.last_sto_date ? (
                    <>
                      Pengecekan fisik terakhir pada{' '}
                      <strong className="text-slate-900">
                        {formatDateTime24h(item.last_sto_date)}
                      </strong>{' '}
                      oleh <strong className="text-slate-900">{item.last_sto_by || '-'}</strong>
                      {item.last_sto_doc && (
                        <span className="font-mono text-[10px] ml-1.5 text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                          {item.last_sto_doc}
                        </span>
                      )}
                    </>
                  ) : (
                    'Fitur verifikasi stok fisik berkala untuk mendeteksi dan menyesuaikan selisih barang gudang.'
                  )}
                </p>
              </div>
            </div>
            
            {isSupervisor ? (
              <button
                onClick={() => setIsStoModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-900 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                title="Buka form Stock Take / Opname fisik (Khusus Supervisor)"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Input Stock Take (STO)</span>
              </button>
            ) : (
              <div
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-500 border border-slate-200 text-xs font-medium rounded-lg cursor-not-allowed"
                title="Modul STO hanya dapat diakses dan dilakukan oleh Supervisor"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>STO (Khusus Supervisor)</span>
              </div>
            )}
          </div>

          {/* PR Request & Evaluator Notes Banner (Visible when low stock or when notes exist) */}
          {(isLowStock || item.low_stock_notes) && (
            <div className={`mt-4 p-4 rounded-xl border ${
              item.low_stock_status === 'PROCESSED' || item.low_stock_status === 'PR_PROCESSED' || item.low_stock_status === 'ARRIVED'
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-rose-50/80 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-lg ${
                    item.low_stock_status === 'PROCESSED' || item.low_stock_status === 'PR_PROCESSED' || item.low_stock_status === 'ARRIVED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Status PR Request (Evaluator)
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        item.low_stock_status === 'PROCESSED' || item.low_stock_status === 'PR_PROCESSED' || item.low_stock_status === 'ARRIVED'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                          : 'bg-rose-100 text-rose-900 border-rose-400'
                      }`}>
                        {item.low_stock_status === 'PROCESSED' || item.low_stock_status === 'PR_PROCESSED' || item.low_stock_status === 'ARRIVED'
                          ? '🟢 Sudah Diproses'
                          : '🔴 PR Request (Menipis ≤ ROP)'}
                      </span>
                    </div>

                    {item.low_stock_notes ? (
                      <div className="mt-2 bg-white/80 border border-slate-300 p-2.5 rounded-lg text-slate-900 text-xs font-medium flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-950 block text-[11px] mb-0.5">Catatan / Tindak Lanjut Evaluator:</strong>
                          <p className="leading-relaxed text-slate-800">{item.low_stock_notes}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 mt-1">
                        Belum ada catatan khusus dari Evaluator untuk pengadaan barang ini.
                      </p>
                    )}

                    {item.low_stock_updated_at && (
                      <p className="text-[10px] text-slate-600 mt-1.5 font-medium">
                        Terakhir diperbarui oleh <strong className="text-slate-900">{item.low_stock_updated_by || 'Evaluator'}</strong> pada {formatDateTime24h(item.low_stock_updated_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Transaction Action Buttons (Field Operation Prompt: Catat Masuk / Keluar) */}
          <div className="no-print mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-700">
              Aksi Mutasi & Verifikasi Lapangan:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {isSupervisor && (
                <button
                  onClick={() => setIsStoModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 active:scale-95 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  title="Buka form Stock Take / Opname fisik (Supervisor)"
                >
                  <ClipboardCheck className="w-4 h-4 text-blue-800" />
                  <span>Stock Take (STO)</span>
                </button>
              )}
              <button
                onClick={() => onRecordTransaction('IN')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Catat Barang Masuk (IN)</span>
              </button>
              <button
                onClick={() => onRecordTransaction('OUT')}
                disabled={isOutOfStock}
                className="flex items-center gap-2 px-4 py-2 bg-[#DC2626] hover:bg-red-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>- Catat Barang Keluar (OUT)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Table: Riwayat Keluar-Masuk (Kartu Barang Fisik Style) */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1E3A8A]" />
                Riwayat Keluar - Masuk (Mutasi Kartu Barang)
              </h3>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-slate-50 border border-dashed border-slate-300">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">Belum ada riwayat transaksi</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Klik tombol "+ Catat Barang Masuk" di atas untuk menambahkan transaksi pertama.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-200/80 text-slate-800 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">No</th>
                    <th className="py-3 px-3">Waktu Transaksi</th>
                    <th className="py-3 px-3">Reservation/PO number</th>
                    <th className="py-3 px-3 text-center">Jenis</th>
                    <th className="py-3 px-3 text-right">Masuk (IN)</th>
                    <th className="py-3 px-3 text-right">Keluar (OUT)</th>
                    <th className="py-3 px-3 text-right">Saldo Sisa</th>
                    <th className="py-3 px-3">Petugas (PIC)</th>
                    <th className="py-3 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {transactions.map((tx, idx) => {
                    const isTxIn = tx.transaction_type === 'IN';
                    const formattedDate = formatDateTime24h(tx.transaction_date);

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {transactions.length - idx}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-800 font-semibold">
                          {tx.doc_ref || '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {tx.transaction_type === 'STO' || tx.notes?.includes('[Stock Opname / STO]') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200" title="Verifikasi Audit Stock Opname (STO)">
                              <ClipboardCheck className="w-3 h-3 text-blue-700" />
                              STO
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isTxIn
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {isTxIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              {tx.transaction_type}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 font-mono">
                          {tx.transaction_type === 'STO' ? (
                            <span className="text-blue-800 font-bold" title="Hasil hitung fisik riil">{tx.quantity} (Fisik)</span>
                          ) : isTxIn ? (
                            `+${tx.quantity}`
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-red-600 font-mono">
                          {tx.transaction_type === 'STO' ? '-' : !isTxIn ? `-${tx.quantity}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-slate-900 font-mono">
                          {tx.balance_after} <span className="text-[10px] font-normal text-slate-600">{item.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-semibold">
                          {formatStandardRoleName(tx.pic_name)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={tx.notes}>
                          {tx.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Printable footer disclaimer for warehouse audits */}
          <div className="mt-8 pt-4 border-t border-slate-200 hidden print:flex justify-between items-end text-[10px] text-slate-500">
            <div>
              <p>Dicetak secara digital oleh sistem WMS Bin Card</p>
              <p>Tanggal Cetak: {formatDateTime24h(new Date())}</p>
            </div>
            <div className="flex gap-12 text-center">
              <div>
                <p className="mb-8">Petugas Gudang (Checker)</p>
                <p className="border-t border-slate-400 pt-1 font-bold">_______________________</p>
              </div>
              <div>
                <p className="mb-8">Supervisor / Kepala Gudang</p>
                <p className="border-t border-slate-400 pt-1 font-bold">_______________________</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Stock Take / STO Modal */}
      <StockTakeModal
        isOpen={isStoModalOpen}
        item={item}
        onClose={() => setIsStoModalOpen(false)}
        onSuccess={(updatedItem) => {
          setItem(updatedItem);
        }}
      />
    </div>
  );
};
