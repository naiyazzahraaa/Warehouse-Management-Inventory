import React, { useState } from 'react';
import { useCloudSync } from '../hooks/useCloudSync';
import { 
  X, 
  Smartphone, 
  Laptop, 
  Cloud, 
  Wifi, 
  Database, 
  CheckCircle2, 
  Copy, 
  QrCode, 
  ArrowRight, 
  Share2, 
  Layers, 
  Sparkles, 
  RefreshCw,
  Server
} from 'lucide-react';

interface MultiDeviceSyncGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultiDeviceSyncGuideModal: React.FC<MultiDeviceSyncGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const syncInfo = useCloudSync();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-dev-...';

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Cloud className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm tracking-tight text-white">
                  Sinkronisasi Cloud Multi-Perangkat
                </h3>
                <span className="text-[10px] uppercase font-extrabold bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
                  AKTIF & TERHUBUNG
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Database Cloud Firestore aktif menghubungkan semua HP, Tablet, dan PC Gudang
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs text-slate-700">
          
          {/* Active Cloud Status Banner */}
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="font-bold text-xs text-emerald-950">
                  Status Database: Cloud Firestore Terhubung Real-Time
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-700 font-semibold bg-white px-2 py-0.5 rounded border border-emerald-200">
                {syncInfo.lastSyncedAt 
                  ? `Sinkron: ${new Date(syncInfo.lastSyncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
                  : 'Siap Sinkron'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-white p-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Platform Cloud</p>
                  <p className="font-bold text-slate-800">Firebase Firestore</p>
                </div>
              </div>

              <div className="bg-white p-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Kecepatan Sync</p>
                  <p className="font-bold text-slate-800">&lt; 1 Detik (Live Event)</p>
                </div>
              </div>

              <div className="bg-white p-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Buku Kas Stok</p>
                  <p className="font-bold text-slate-800">Tersentralisasi</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-emerald-900 leading-relaxed">
              Setiap kali petugas di HP mengurangi stok via QR Scan, layar komputer Admin di kantor otomatis terpotong saat itu juga secara real-time tanpa perlu me-refresh halaman!
            </p>
          </div>

          {/* Quick Share Link Box */}
          <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-indigo-600" />
                Bagikan Tautan ke Petugas Lapangan:
              </span>
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 shadow-xs transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin URL'}</span>
              </button>
            </div>
            <div className="p-2 bg-white rounded-lg border border-indigo-100 font-mono text-[11px] text-slate-700 truncate select-all">
              {currentUrl}
            </div>
            <p className="text-[11px] text-indigo-900/80">
              Buka tautan ini di browser <strong>Google Chrome</strong> atau <strong>Safari</strong> pada HP Android, iPhone, Tablet, atau Handheld Barcode Scanner.
            </p>
          </div>

          {/* Section 1: Cara Akses di HP / Tablet */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Cara Penggunaan di HP / Tablet Lapangan:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold inline-flex items-center justify-center text-[11px] mb-1">
                  1
                </span>
                <p className="font-bold text-slate-800 text-[11px]">Buka di Browser HP</p>
                <p className="text-[10px] text-slate-500">
                  Petugas membuka link aplikasi dan login dengan akun Staff (<code className="bg-slate-200 px-1 rounded">staff</code> / <code className="bg-slate-200 px-1 rounded">staff123</code>).
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold inline-flex items-center justify-center text-[11px] mb-1">
                  2
                </span>
                <p className="font-bold text-slate-800 text-[11px]">Pasang di Layar Utama</p>
                <p className="text-[10px] text-slate-500">
                  Di Chrome/Safari, pilih menu <strong>⋮</strong> &rarr; <em>"Tambahkan ke Layar Utama" (Add to Home screen)</em> agar praktis dibuka seperti aplikasi mandiri.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold inline-flex items-center justify-center text-[11px] mb-1">
                  3
                </span>
                <p className="font-bold text-slate-800 text-[11px]">Pindai Label & Mutasi</p>
                <p className="text-[10px] text-slate-500">
                  Ketuk <strong>Scan QR</strong>, izinkan akses kamera, lalu arahkan ke label rak BIN atau kemasan material. Hasil mutasi langsung tercatat di Cloud.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Arsitektur Sinkronisasi Antar Perangkat */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Skenario Sinkronisasi Multi-Perangkat:
            </h4>

            <div className="space-y-2.5">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900">PC / Laptop Admin di Kantor:</span>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Admin dapat membuka Dashboard di komputer kantor untuk memantau ringkasan total stok fisik, riwayat seluruh mutasi masuk/keluar, menambah item baru, dan mencetak label QR Code secara batch.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900">Banyak HP / Tablet Petugas di Lorong Rak:</span>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Bisa digunakan oleh banyak staf lapangan secara bersamaan di masing-masing lorong rak BIN (<code className="bg-slate-200 px-1 rounded">TN 1...</code>). Setiap transaksi otomatis menyertakan nama penanggung jawab (PIC) dan nomor referensi surat jalan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Prompt / Call to action */}
          <div className="p-4 bg-gradient-to-r from-emerald-950 to-slate-900 text-white rounded-2xl flex items-center justify-between gap-4">
            <div>
              <span className="font-bold text-xs text-emerald-300 block flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Sinkronisasi Cloud Berjalan Normal
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Semua perubahan data barang dan transaksi otomatis tersimpan permanen di cloud dan diperbarui di setiap perangkat yang sedang aktif.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shrink-0 transition-colors shadow-xs"
            >
              Tutup & Lanjutkan
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
