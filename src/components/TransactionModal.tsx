import React, { useState, useEffect } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertTriangle, User, FileText, Hash, Lock } from 'lucide-react';
import { InventoryItem, TransactionType } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { formatUnit } from '../utils/units';
import { formatStandardRoleName } from '../utils/roleFormat';
import { formatDateTime24h } from '../utils/dateFormat';
import { DateTime24Picker } from './DateTime24Picker';

interface TransactionModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  initialType?: TransactionType;
  onClose: () => void;
  onSuccess: (updatedItem: InventoryItem) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  item,
  initialType = 'IN',
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>(initialType);
  const [quantity, setQuantity] = useState<number | ''>(0);
  const [picName, setPicName] = useState<string>('');
  const [docRef, setDocRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setType(initialType);
      setQuantity(0);
      const currentUserName = user
        ? formatStandardRoleName(user.name || user.role)
        : 'Staff Shift Group A';
      setPicName(currentUserName);
      setDocRef('');
      setNotes('');
      // Default to current local time in YYYY-MM-DDTHH:mm for manual input
      const now = new Date();
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDate(localIso);
      setErrorMessage(null);
    }
  }, [isOpen, item, initialType, user]);

  if (!isOpen || !item) return null;

  const numericQuantity = typeof quantity === 'number' ? quantity : 0;
  const currentStock = item.current_stock;
  const balanceAfter = type === 'IN' ? currentStock + numericQuantity : currentStock - numericQuantity;
  const isInsufficientStock = type === 'OUT' && numericQuantity > currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!picName.trim()) {
      setErrorMessage('Field Nama Petugas wajib terisi.');
      return;
    }

    if (!docRef.trim()) {
      setErrorMessage('Field Reservation/PO number wajib diisi.');
      return;
    }

    if (!date.trim()) {
      setErrorMessage('Waktu Transaksi (DD/MM/YYYY HH:mm) wajib diisi.');
      return;
    }

    if (numericQuantity <= 0) {
      setErrorMessage('Kuantitas mutasi harus lebih besar dari 0.');
      return;
    }

    if (isInsufficientStock) {
      setErrorMessage(`Stok tidak mencukupi! Stok saat ini: ${currentStock} ${formatUnit(item.unit)}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await db.recordTransaction({
        item_id: item.id,
        material_code: item.material_code,
        item_name: item.name,
        transaction_type: type,
        quantity: numericQuantity,
        pic_name: picName.trim(),
        operator_username: user?.username || 'user',
        notes: notes.trim() || (type === 'IN' ? 'Pemasukan barang reguler' : 'Pengeluaran barang reguler'),
        doc_ref: docRef.trim(),
        transaction_date: date ? new Date(date).toISOString() : new Date().toISOString(),
      });

      onSuccess(result.item);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit transaction:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header: Biru Dongker (#0A192F / #1E3A8A) with indicator */}
        <div className="bg-[#0A192F] px-6 py-4 flex items-center justify-between text-white border-b border-blue-900/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
              type === 'IN' ? 'bg-emerald-600' : 'bg-[#DC2626]'
            }`}>
              {type === 'IN' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white">
                {type === 'IN' ? 'Catat Mutasi Masuk (IN)' : 'Catat Mutasi Keluar (OUT)'}
              </h3>
              <p className="text-xs text-slate-300">
                Material Number: <span className="font-mono font-bold text-yellow-400">{item.material_code}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item Summary Bar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-bold text-slate-900 text-sm">{item.name}</span>
          </div>
          <div className="text-slate-600 font-medium">
            Lokasi: <span className="font-bold text-slate-900">{item.location}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Transaction Type Segmented Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Jenis Mutasi:
            </label>
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setType('IN')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Masuk (IN)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('OUT')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'OUT'
                    ? 'bg-[#DC2626] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Keluar (OUT)</span>
              </button>
            </div>
          </div>

          {/* Quantity & Stock Calculation Card */}
          <div className="rounded-xl p-4 bg-white border border-slate-200 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                Kuantitas ({formatUnit(item.unit)}):
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuantity(0)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded text-slate-700 hover:bg-slate-200"
                >
                  Reset (0)
                </button>
                {[1, 5, 10, 25, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuantity((q) => (typeof q === 'number' ? q : 0) + val)}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(0, (typeof q === 'number' ? q : 0) - 1))}
                className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center text-lg active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                value={quantity === '' ? '' : quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setQuantity('');
                  } else {
                    const sanitized = val.replace(/^0+(?=\d)/, '');
                    const parsed = parseInt(sanitized, 10);
                    setQuantity(isNaN(parsed) ? 0 : Math.max(0, parsed));
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  if (quantity === '' || isNaN(Number(quantity))) {
                    setQuantity(0);
                  }
                }}
                placeholder="0"
                className="flex-1 text-center font-bold text-xl py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                required
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => (typeof q === 'number' ? q : 0) + 1)}
                className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center text-lg active:scale-95"
              >
                +
              </button>
            </div>

            {/* Live Stock Calculation Strip (SAP Term: Unrestricted Stock) */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-3 text-center text-xs">
              <div>
                <span className="text-slate-600 block text-[11px] font-semibold">Unrestricted Stock</span>
                <span className="font-bold text-slate-900">{currentStock} {formatUnit(item.unit)}</span>
              </div>
              <div>
                <span className="text-slate-600 block text-[11px] font-semibold">Mutasi</span>
                <span className={`font-bold ${type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {type === 'IN' ? `+${numericQuantity}` : `-${numericQuantity}`} {formatUnit(item.unit)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 block text-[11px] font-semibold">Saldo Akhir</span>
                <span className={`font-bold text-sm ${isInsufficientStock ? 'text-rose-600 animate-pulse' : 'text-[#1E3A8A]'}`}>
                  {balanceAfter} {formatUnit(item.unit)}
                </span>
              </div>
            </div>

            {isInsufficientStock && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>Kuantitas melebihi stok yang ada ({currentStock} {formatUnit(item.unit)}). Stok tidak boleh negatif!</span>
              </div>
            )}
          </div>

          {/* PIC & Reservation/PO Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Petugas (PIC)
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  <Lock className="w-2.5 h-2.5 text-amber-600" />
                  Terkunci
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={picName}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 text-xs bg-slate-100 text-slate-900 font-semibold border border-slate-300 rounded-lg cursor-not-allowed select-none"
                  required
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Reservation/PO number <span className="text-red-600 font-bold">*</span>
                </span>
              </label>
              <input
                type="text"
                value={docRef}
                onChange={(e) => setDocRef(e.target.value)}
                placeholder="Contoh: PO-9912 / SJ-102"
                className={`w-full px-3 py-2 text-xs bg-white text-slate-900 font-medium border rounded-lg focus:outline-hidden focus:ring-2 ${
                  !docRef.trim() && errorMessage ? 'border-red-400 ring-red-200 ring-2' : 'border-slate-300 focus:ring-blue-800'
                }`}
                required
              />
            </div>
          </div>

          {/* Date & Time (24-Hour Format: Strict No AM/PM) */}
          <DateTime24Picker
            value={date}
            onChange={(val) => setDate(val)}
            label="Waktu Transaksi (Format 24 Jam)"
            required
          />

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Keterangan:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan keperluan transaksi..."
              className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInsufficientStock}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                type === 'IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : 'bg-[#DC2626] hover:bg-red-700 shadow-red-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : type === 'IN' ? 'Simpan Mutasi Masuk (IN)' : 'Simpan Mutasi Keluar (OUT)'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
