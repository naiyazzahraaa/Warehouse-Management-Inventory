import React, { useState, useEffect } from 'react';
import { X, Edit2, CheckCircle2, AlertTriangle, FileText, User } from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { db } from '../services/db';
import { formatDateTime24h, parseToIsoString, toDateTimeLocalValue } from '../utils/dateFormat';
import { DateTime24Picker } from './DateTime24Picker';

interface EditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onSuccess,
}) => {
  const [docRef, setDocRef] = useState('');
  const [picName, setPicName] = useState('');
  const [notes, setNotes] = useState('');
  const [dateTimeLocal, setDateTimeLocal] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(0);
  const [type, setType] = useState<TransactionType>('IN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transaction) {
      setDocRef(transaction.doc_ref === '-' ? '' : transaction.doc_ref);
      setPicName(transaction.pic_name);
      setNotes(transaction.notes === '-' ? '' : transaction.notes);
      setDateTimeLocal(toDateTimeLocalValue(transaction.transaction_date));
      setQuantity(transaction.quantity);
      setType(transaction.transaction_type);
      setErrorMessage(null);
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numQty = typeof quantity === 'number' ? quantity : 0;
    if (numQty <= 0) {
      setErrorMessage('Kuantitas mutasi harus lebih besar dari 0.');
      return;
    }

    if (!docRef.trim()) {
      setErrorMessage('Reservation/PO number wajib diisi.');
      return;
    }

    if (!picName.trim()) {
      setErrorMessage('Nama Petugas (PIC) wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const isoDate = dateTimeLocal ? new Date(dateTimeLocal).toISOString() : transaction.transaction_date;

      await db.updateTransaction(transaction.id, {
        doc_ref: docRef.trim(),
        pic_name: picName.trim(),
        notes: notes.trim() || '-',
        transaction_date: isoDate,
        quantity: numQty,
        transaction_type: type,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update transaction:', err);
      setErrorMessage(err.message || 'Gagal menyimpan perubahan transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header: Biru Dongker (#0A192F / #1E3A8A) */}
        <div className="bg-[#0A192F] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] border border-blue-400/30 flex items-center justify-center text-white">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight">
                Edit Riwayat Transaksi
              </h3>
              <p className="text-xs text-slate-300">
                Material Number: {transaction.material_code}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Item info */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 block">Nama Barang:</span>
            <span className="font-bold text-slate-900 text-sm">{transaction.item_name}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jenis Mutasi
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
              >
                <option value="IN">Masuk (IN)</option>
                <option value="OUT">Keluar (OUT)</option>
                <option value="STO">Stock Opname (STO)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kuantitas
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                required
              />
            </div>
          </div>

          {/* Reservation / PO Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Reservation/PO number
            </label>
            <input
              type="text"
              value={docRef}
              onChange={(e) => setDocRef(e.target.value)}
              placeholder="Contoh: PO-9921 / SJ-102"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
              required
            />
          </div>

          {/* Date & Time (24h) */}
          <DateTime24Picker
            value={dateTimeLocal}
            onChange={(val) => setDateTimeLocal(val)}
            label="Waktu Transaksi (Format 24 Jam)"
            required
          />

          {/* PIC */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Petugas (PIC)
            </label>
            <input
              type="text"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Keterangan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keterangan koreksi mutasi..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-[#0A192F] rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
