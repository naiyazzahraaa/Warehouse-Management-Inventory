import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore, COLLECTIONS } from '../services/firebase';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ExternalLink,
  Download,
  ClipboardCheck,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Transaction } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { formatStandardRoleName } from '../utils/roleFormat';
import { formatDateTime24h } from '../utils/dateFormat';
import { EditTransactionModal } from './EditTransactionModal';

interface TransactionHistoryViewProps {
  onSelectItemByCode: (code: string) => void;
  refreshTrigger?: number;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  onSelectItemByCode,
  refreshTrigger,
}) => {
  const { isSupervisor, isReviewer, canEditTransactions, canDeleteTransactions } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT' | 'STO'>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Edit & Delete states
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTxForDelete, setSelectedTxForDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    let isMounted = true;

    // Real-time Firestore onSnapshot listener for transactions
    const q = query(
      collection(firestore, COLLECTIONS.TRANSACTIONS),
      orderBy('transaction_date', 'desc'),
      limit(500)
    );

    const unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const txs: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          const t = docSnap.data() as Transaction;
          if (t) {
            txs.push({
              ...t,
              id: docSnap.id || t.id,
            });
          }
        });
        if (isMounted) {
          setTransactions(txs);
          setIsLoading(false);
        }
      },
      (error) => {
        console.warn('[TransactionHistoryView] Firestore onSnapshot error, falling back to local:', error);
        db.getRecentTransactions(300).then((localTxs) => {
          if (isMounted) {
            setTransactions(localTxs);
            setIsLoading(false);
          }
        });
      }
    );

    const unsubscribeDb = db.subscribe(async () => {
      const localTxs = await db.getRecentTransactions(300);
      if (isMounted) {
        setTransactions(localTxs);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFirestore();
      unsubscribeDb();
    };
  }, [refreshTrigger]);

  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'ALL' && t.transaction_type !== typeFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();

      return (
        t.material_code.toLowerCase().includes(q) ||
        t.item_name.toLowerCase().includes(q) ||
        t.pic_name.toLowerCase().includes(q) ||
        (t.doc_ref && t.doc_ref.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return true;
  });

  const handleExportCsv = () => {
    if (filtered.length === 0) return;

    const headers = [
      'ID,Waktu_Transaksi,Material_Number,Nama_Barang,Jenis,Kuantitas,Saldo_Akhir,Reservation_PO_Number,Petugas,Catatan',
    ];

    const rows = filtered.map((t) =>
      [
        t.id,
        `"${formatDateTime24h(t.transaction_date)}"`,
        t.material_code,
        `"${t.item_name.replace(/"/g, '""')}"`,
        t.transaction_type,
        t.quantity,
        t.balance_after,
        `"${(t.doc_ref || '').replace(/"/g, '""')}"`,
        `"${t.pic_name.replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ].join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `riwayat_mutasi_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleOpenEdit = (tx: Transaction) => {
    setSelectedTxForEdit(tx);
    setIsEditModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTxForDelete || !isSupervisor) return;

    setIsDeleting(true);
    try {
      await db.deleteTransaction(selectedTxForDelete.id);
      setSelectedTxForDelete(null);
    } catch (err: any) {
      console.error('Failed to delete transaction:', err);
      alert(err.message || 'Gagal menghapus transaksi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-[#1E3A8A]" />
              Riwayat Mutasi Keluar - Masuk Barang
            </h2>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Ekspor CSV</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Material Number, nama, Reservation/PO number, atau petugas..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded-md transition-colors ${
                typeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Mutasi
            </button>

            <button
              onClick={() => setTypeFilter('IN')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                typeFilter === 'IN'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              Masuk (IN)
            </button>

            <button
              onClick={() => setTypeFilter('OUT')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                typeFilter === 'OUT'
                  ? 'bg-white text-rose-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              Keluar (OUT)
            </button>

            <button
              onClick={() => setTypeFilter('STO')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                typeFilter === 'STO'
                  ? 'bg-white text-blue-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-[#1E3A8A]" />
              Stock Opname (STO)
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-900 text-[11px] uppercase font-bold tracking-wider border-b border-slate-300">
              <tr>
                <th className="py-3 px-4">Waktu Transaksi</th>
                <th className="py-3 px-3">Material Number</th>
                <th className="py-3 px-4 min-w-[180px]">Nama Barang</th>
                <th className="py-3 px-3 text-center">Jenis</th>
                <th className="py-3 px-3 text-right">Kuantitas</th>
                <th className="py-3 px-3 text-right">Saldo Sesudah</th>
                <th className="py-3 px-3">Reservation/PO number</th>
                <th className="py-3 px-3">Petugas (PIC)</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-700 font-semibold">
                    Memuat riwayat transaksi...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-700 font-semibold">
                    Tidak ada catatan mutasi yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const isIn = tx.transaction_type === 'IN';
                  const isSto =
                    tx.transaction_type === 'STO' ||
                    tx.notes?.includes('[Stock Opname / STO]');

                  const dateFormatted = formatDateTime24h(tx.transaction_date);

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-900 font-mono font-bold text-[11px]">
                        {dateFormatted}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          onClick={() => onSelectItemByCode(tx.material_code)}
                          className="font-mono font-bold text-[#1E3A8A] hover:underline flex items-center gap-1 cursor-pointer"
                          title="Buka Kartu Barang Digital"
                        >
                          <span>{tx.material_code}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </button>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-950">
                        {tx.item_name}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isSto ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-950 border border-blue-300"
                            title="Verifikasi Stock Opname"
                          >
                            <ClipboardCheck className="w-3 h-3 text-blue-800" />
                            STO
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isIn
                                ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                : 'bg-rose-100 text-rose-950 border border-rose-300'
                            }`}
                          >
                            {isIn ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-rose-700" />
                            )}
                            {tx.transaction_type}
                          </span>
                        )}
                      </td>

                      <td
                        className={`py-3 px-3 text-right font-mono font-extrabold text-xs whitespace-nowrap ${
                          isSto
                            ? 'text-blue-900'
                            : isIn
                              ? 'text-emerald-800'
                              : 'text-rose-800'
                        }`}
                      >
                        {isSto
                          ? `${tx.quantity} (Fisik)`
                          : isIn
                            ? `+${tx.quantity}`
                            : `-${tx.quantity}`}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                        {tx.balance_after}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-800 font-semibold whitespace-nowrap">
                        {tx.doc_ref || '-'}
                      </td>

                      <td className="py-3 px-3 text-slate-900 font-bold whitespace-nowrap">
                        {formatStandardRoleName(tx.pic_name)}
                      </td>

                      <td
                        className="py-3 px-4 text-slate-600 max-w-xs truncate"
                        title={tx.notes}
                      >
                        {tx.notes || '-'}
                      </td>

                      {/* Action column: Edit (All roles except Reviewer), Delete (Supervisor only) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {canEditTransactions ? (
                            <button
                              onClick={() => handleOpenEdit(tx)}
                              className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                              title="Edit riwayat transaksi"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">Read-only</span>
                          )}

                          {canDeleteTransactions && (
                            <button
                              onClick={() => setSelectedTxForDelete(tx)}
                              className="p-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
                              title="Hapus riwayat transaksi (Khusus Supervisor)"
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
      </div>

      {/* Edit Transaction Modal */}
      {isEditModalOpen && selectedTxForEdit && (
        <EditTransactionModal
          isOpen={isEditModalOpen}
          transaction={selectedTxForEdit}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTxForEdit(null);
          }}
          onSuccess={() => {
            // Updated automatically via real-time onSnapshot
          }}
        />
      )}

      {/* Delete Confirmation Modal (Supervisor Only) */}
      {selectedTxForDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-[#DC2626] px-6 py-4 flex items-center gap-3 text-white">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Hapus Catatan Transaksi</h3>
                <p className="text-xs text-red-100">Aksi ini eksklusif untuk Supervisor</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Apakah Anda yakin ingin menghapus catatan transaksi ini? Saldo stok barang <span className="font-bold text-slate-900">{selectedTxForDelete.item_name}</span> ({selectedTxForDelete.material_code}) akan disesuaikan kembali secara otomatis.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Jenis Mutasi:</span>
                  <span className="font-bold text-slate-800">{selectedTxForDelete.transaction_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kuantitas:</span>
                  <span className="font-bold text-slate-800">{selectedTxForDelete.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reservation/PO number:</span>
                  <span className="font-bold text-slate-800">{selectedTxForDelete.doc_ref || '-'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedTxForDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#DC2626] hover:bg-red-700 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Menghapus...' : 'Konfirmasi Hapus'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
