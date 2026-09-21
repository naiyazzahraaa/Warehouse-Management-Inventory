import React, { useState, useEffect } from 'react';
import { 
  X, 
  ClipboardCheck, 
  User, 
  Lock, 
  Calendar, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  HelpCircle,
  Hash,
  Scale
} from 'lucide-react';
import { InventoryItem } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { formatUnit } from '../utils/units';
import { formatStandardRoleName } from '../utils/roleFormat';

interface StockTakeModalProps {
  isOpen: boolean;
  item: InventoryItem;
  onClose: () => void;
  onSuccess: (updatedItem: InventoryItem) => void;
}

export const StockTakeModal: React.FC<StockTakeModalProps> = ({
  isOpen,
  item,
  onClose,
  onSuccess,
}) => {
  const { user, isSupervisor } = useAuth();
  
  const [physicalStock, setPhysicalStock] = useState<number | ''>(item.current_stock);
  const [docRef, setDocRef] = useState<string>('');
  const [picName, setPicName] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('Pengecekan fisik berkala');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setPhysicalStock(item.current_stock);
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const codeSuffix = item.material_code.slice(-4);
      setDocRef(`BA-STO-${todayStr}-${codeSuffix}`);
      
      const currentUserName = user
        ? formatStandardRoleName(user.name || user.role)
        : 'Supervisor';
      setPicName(currentUserName);
      setDate(new Date().toISOString().slice(0, 16));
      setNotes('Pengecekan fisik berkala');
      setErrorMessage(null);
    }
  }, [isOpen, item, user]);

  if (!isOpen || !item) return null;

  // Access Control: STO hanya dapat diakses dan dilakukan oleh Supervisor
  if (!isSupervisor) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm">Hak Akses Khusus Supervisor</h3>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Akses Modul STO Dibatasi</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Modul <strong>Stock Take / STO (Stock Opname)</strong> hanya dapat diakses dan dieksekusi oleh <strong>Supervisor</strong>. Akun Anda saat ini ({user?.name || 'Staff'}) tidak memiliki izin untuk melakukan audit fisik stok.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSystemStock = item.current_stock;
  const numPhysicalStock = typeof physicalStock === 'number' ? physicalStock : 0;
  const difference = numPhysicalStock - currentSystemStock;
  const isMatch = difference === 0;
  const isSurplus = difference > 0;
  const isShortage = difference < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSupervisor) {
      setErrorMessage('Hanya Supervisor yang memiliki wewenang untuk mengeksekusi Stock Opname (STO).');
      return;
    }

    if (!docRef.trim()) {
      setErrorMessage('Nomor Berita Acara / Referensi STO wajib diisi.');
      return;
    }

    if (!picName.trim()) {
      setErrorMessage('Nama Petugas Pelaksana STO wajib terisi.');
      return;
    }

    if (!date.trim()) {
      setErrorMessage('Tanggal dan Jam Pelaksanaan STO wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await db.recordStockOpname({
        item_id: item.id,
        physical_stock: numPhysicalStock,
        pic_name: picName.trim(),
        operator_username: user?.username || 'supervisor',
        doc_ref: docRef.trim(),
        notes: notes.trim(),
        sto_date: date ? new Date(date).toISOString() : new Date().toISOString(),
      });

      onSuccess(result.item);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit Stock Opname:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses Stock Opname.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetReasons = [
    'Pengecekan fisik berkala',
    'Penyesuaian barang rusak / cacat fisik',
    'Koreksi selisih hitung penerimaan barang',
    'Barang ditemukan saat penataan rak BIN',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header with STO Theme */}
        <div className="bg-[#0A192F] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-white">
              <ClipboardCheck className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                Stock Take / STO (Stock Opname)
              </h3>
              <p className="text-xs text-slate-300">
                Pengecekan fisik, hitung selisih, dan penyesuaian stok sistem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item Summary Pill */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mr-2">
              {item.material_code}
            </span>
            <span className="font-semibold text-slate-900">{item.name}</span>
          </div>
          <div className="text-slate-500">
            Lokasi BIN: <span className="font-medium text-slate-700">{item.location}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Comparison Cards: Sistem vs Fisik vs Selisih */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Box 1: Stok Sistem */}
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-center">
              <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                Unrestricted Stock (Sistem)
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {currentSystemStock}
                <span className="text-xs font-normal text-slate-500 ml-1">{formatUnit(item.unit)}</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sebelum penyesuaian</span>
            </div>

            {/* Box 2: Stok Fisik Riil (Editable starting from 0) */}
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border-2 border-indigo-300 text-center">
              <span className="text-[11px] font-bold text-indigo-900 block uppercase tracking-wider">
                Stok Fisik (Riil Gudang)
              </span>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => setPhysicalStock((p) => Math.max(0, (typeof p === 'number' ? p : 0) - 1))}
                  className="w-7 h-7 rounded-lg bg-white border border-indigo-200 font-bold text-indigo-700 hover:bg-indigo-100 flex items-center justify-center text-sm"
                >
                  -
                </button>
                <input
                  type="number"
                  value={physicalStock === '' ? '' : physicalStock}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setPhysicalStock('');
                    } else {
                      const sanitized = val.replace(/^0+(?=\d)/, '');
                      const parsed = parseInt(sanitized, 10);
                      setPhysicalStock(isNaN(parsed) ? 0 : Math.max(0, parsed));
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    if (physicalStock === '' || isNaN(Number(physicalStock))) {
                      setPhysicalStock(0);
                    }
                  }}
                  className="w-20 text-center font-black text-xl py-0.5 bg-white border border-indigo-400 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-indigo-950"
                  placeholder="0"
                  required
                />
                <button
                  type="button"
                  onClick={() => setPhysicalStock((p) => (typeof p === 'number' ? p : 0) + 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-indigo-200 font-bold text-indigo-700 hover:bg-indigo-100 flex items-center justify-center text-sm"
                >
                  +
                </button>
              </div>
              <span className="text-[10px] text-indigo-700 font-medium block mt-1">
                Satuan: {formatUnit(item.unit)}
              </span>
            </div>

            {/* Box 3: Selisih (Difference / Variance) */}
            <div className={`p-3.5 rounded-xl border text-center ${
              isMatch
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : isSurplus
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <span className="text-[11px] font-bold block uppercase tracking-wider">
                Selisih (Variance)
              </span>
              <div className="text-2xl font-black mt-1">
                {isSurplus ? `+${difference}` : difference}
                <span className="text-xs font-normal ml-1">{formatUnit(item.unit)}</span>
              </div>
              <span className={`text-[10px] font-bold inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full ${
                isMatch
                  ? 'bg-emerald-200 text-emerald-900'
                  : isSurplus
                  ? 'bg-blue-200 text-blue-900'
                  : 'bg-rose-200 text-rose-900'
              }`}>
                {isMatch ? '✓ Akurat / Cocok' : isSurplus ? '↑ Surplus Fisik' : '↓ Selisih Kurang'}
              </span>
            </div>

          </div>

          {/* Explanation Alert */}
          <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
            isMatch
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
              : isSurplus
              ? 'bg-blue-50/70 border-blue-200 text-blue-800'
              : 'bg-rose-50/70 border-rose-200 text-rose-800'
          }`}>
            {isMatch ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {isMatch
                  ? 'Hasil Fisik Sesuai dengan Sistem (Cocok)'
                  : isSurplus
                  ? `Hasil fisik berlebih +${difference} ${formatUnit(item.unit)} dibanding stok sistem`
                  : `Hasil fisik kurang ${Math.abs(difference)} ${formatUnit(item.unit)} dibanding stok sistem`}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                {isMatch
                  ? 'Tidak ada selisih stok. Sistem mencatat hasil audit fisik ke dalam Riwayat Transaksi (History Log).'
                  : 'Sistem secara otomatis menghitung dan mencatat selisih stock ke dalam Berita Acara & Riwayat Transaksi. Catatan: Proses STO tidak langsung mengubah saldo stock aktif di sistem secara otomatis.'}
              </p>
            </div>
          </div>

          {/* Form Inputs: No BA, PIC, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nomor Berita Acara / Referensi STO */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                No. Berita Acara / Ref STO <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                value={docRef}
                onChange={(e) => setDocRef(e.target.value)}
                placeholder="Contoh: BA-STO/2026/09/01"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
            </div>

            {/* Tanggal & Waktu Pelaksanaan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal & Waktu Pengecekan <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Petugas Pelaksana (PIC) - Locked to active session */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Petugas Pelaksana (PIC)
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  <Lock className="w-2.5 h-2.5 text-amber-600" />
                  Terkunci
                </span>
              </label>
              <input
                type="text"
                value={picName}
                readOnly
                disabled
                className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-medium cursor-not-allowed"
                title="Field nama dikunci sesuai akun login aktif untuk menjamin otentisitas hasil STO"
              />
            </div>

            {/* Satuan & Lokasi Konfirmasi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Verifikasi Rak & Kategori
              </label>
              <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-600 truncate">
                Rak: <strong className="text-slate-800">{item.location}</strong> • {item.category}
              </div>
            </div>

          </div>

          {/* Alasan / Catatan STO */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Keterangan / Alasan Penyesuaian:
              </label>
              <span className="text-[10px] text-slate-400">Pilih rekomendasi:</span>
            </div>
            
            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {presetReasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setNotes(reason)}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                    notes === reason
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan detail hasil penghitungan fisik..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Footer / Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Menyimpan STO...'
                  : 'Simpan & Catat Riwayat STO'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
