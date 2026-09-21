import React, { useState, useEffect } from 'react';
import { X, Printer, CheckSquare, Layers, Settings2, Sliders, Info } from 'lucide-react';
import { InventoryItem } from '../types';
import { generateQrDataUrl } from '../utils/qr';

interface BatchQrPrintModalProps {
  isOpen: boolean;
  items: InventoryItem[];
  onClose: () => void;
}

type PrintFormat = 'a4-grid-24' | 'thermal-50x30' | 'compact-40';

export const BatchQrPrintModal: React.FC<BatchQrPrintModalProps> = ({
  isOpen,
  items,
  onClose,
}) => {
  const [format, setFormat] = useState<PrintFormat>('a4-grid-24');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [showCategory, setShowCategory] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      generateAllQrs();
    }
  }, [isOpen, items]);

  const generateAllQrs = async () => {
    setIsGenerating(true);
    const map: Record<string, string> = {};
    for (const item of items) {
      try {
        const url = await generateQrDataUrl(item.material_code, { width: 180, margin: 0 });
        map[item.id] = url;
      } catch (err) {
        console.error('Failed QR generation for item:', item.material_code, err);
      }
    }
    setQrMap(map);
    setIsGenerating(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Modal Header (hidden on print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">Batch Print QR Code Label</h3>
              <p className="text-[11px] text-slate-400">
                {items.length} label barang terpilih siap dicetak ke kertas stiker atau thermal printer
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

        {/* Configuration Toolbar (hidden on print) */}
        <div className="no-print bg-slate-50 border-b border-slate-200 p-4 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Format Kertas:</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as PrintFormat)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="a4-grid-24">Stiker A4 Grid (3 Kolom x 8 Baris - 24 Label/Lembar)</option>
                <option value="compact-40">Stiker A4 Kompak (4 Kolom x 10 Baris - 40 Label/Lembar)</option>
                <option value="thermal-50x30">Printer Thermal Stiker (Label Tunggal 50 x 30 mm)</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => setShowLocation(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Cetak Lokasi Rak</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={showCategory}
                  onChange={(e) => setShowCategory(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Cetak Kategori</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-lg shadow-sm shadow-indigo-200 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isGenerating ? 'Memuat QR...' : 'Cetak Sekarang (Print)'}</span>
            </button>
          </div>

        </div>

        {/* Printable Stickers Sheet Preview Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0">
          
          <div className="no-print mb-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              Tampilan pratinjau lembar stiker. Saat jendela cetak browser terbuka, tombol dan menu di sekitar akan otomatis disembunyikan.
            </span>
          </div>

          {/* Render container based on selected format */}
          {format === 'a4-grid-24' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2 print:m-0">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="print-break-inside-avoid bg-white border border-slate-300 rounded-lg p-2.5 flex items-center gap-2.5 shadow-2xs print:shadow-none print:border-slate-400"
                >
                  <div className="shrink-0 w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-white">
                    {qrMap[it.id] ? (
                      <img src={qrMap[it.id]} alt={it.material_code} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 animate-pulse rounded" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="font-mono font-extrabold text-xs sm:text-sm text-slate-900 tracking-wider">
                      {it.material_code}
                    </div>
                    <div className="font-semibold text-[11px] text-slate-800 line-clamp-2 mt-0.5" title={it.name}>
                      {it.name}
                    </div>
                    {showLocation && (
                      <div className="text-[10px] text-slate-600 mt-1 font-medium truncate">
                        Loc: {it.location}
                      </div>
                    )}
                    {showCategory && (
                      <div className="text-[9px] text-slate-500 truncate">
                        {it.category}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {format === 'compact-40' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:grid-cols-4 print:gap-1.5 print:m-0">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="print-break-inside-avoid bg-white border border-slate-300 rounded-md p-1.5 flex items-center gap-1.5 shadow-2xs print:shadow-none print:border-slate-400 text-left"
                >
                  <div className="shrink-0 w-12 h-12 flex items-center justify-center">
                    {qrMap[it.id] && (
                      <img src={qrMap[it.id]} alt={it.material_code} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-[11px] text-slate-900 truncate">
                      {it.material_code}
                    </div>
                    <div className="font-medium text-[10px] text-slate-800 truncate" title={it.name}>
                      {it.name}
                    </div>
                    {showLocation && (
                      <div className="text-[9px] text-slate-500 truncate">
                        {it.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {format === 'thermal-50x30' && (
            <div className="flex flex-col items-center gap-4 print:gap-0">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="print-break-inside-avoid w-72 bg-white border-2 border-slate-800 rounded-lg p-3 flex items-center gap-3 print:border-black print:rounded-none print:w-full print:h-[30mm] print:m-0"
                >
                  <div className="shrink-0 w-20 h-20 flex items-center justify-center">
                    {qrMap[it.id] && (
                      <img src={qrMap[it.id]} alt={it.material_code} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-black text-sm text-slate-900 tracking-wide">
                      {it.material_code}
                    </div>
                    <div className="font-bold text-xs text-slate-900 line-clamp-2 mt-0.5">
                      {it.name}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-700 mt-1">
                      {it.location} • {it.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Modal Footer (hidden on print) */}
        <div className="no-print bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Total label: <strong className="text-slate-900">{items.length} stiker</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Label</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
