import React, { useState, useEffect } from 'react';
import { X, PackagePlus, Edit3, Sparkles, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';
import { InventoryItem } from '../types';
import { db } from '../services/db';
import { parseBinLocation, formatBinLocation } from '../utils/binLocation';
import { COMMON_UNITS, formatUnit } from '../utils/units';

interface ItemFormModalProps {
  isOpen: boolean;
  itemToEdit: InventoryItem | null;
  onClose: () => void;
  onSuccess: (item: InventoryItem) => void;
}

const COMMON_CATEGORIES = [
  'Mekanik & Sparepart',
  'Elektrikal',
  'Pipa & Fitting',
  'Baut & Fastener',
  'Alat Pelindung Diri (APD)',
  'Pelumas & Kimia',
  'Kemasan & Packaging',
  'Peralatan Tangan & Power Tool',
  'Pneumatik & Hidrolik',
  'Instrumentasi & Sensor',
];

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  itemToEdit,
  onClose,
  onSuccess,
}) => {
  const isEdit = !!itemToEdit;
  const [materialCode, setMaterialCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [fpaType, setFpaType] = useState<'FPA' | 'NON_FPA'>('FPA');
  const [location, setLocation] = useState('1.03.02.04B');
  const [ruang, setRuang] = useState('1');
  const [rak, setRak] = useState('03');
  const [baris, setBaris] = useState('02');
  const [tingkat, setTingkat] = useState('04B');
  const [unit, setUnit] = useState('EA');
  const [currentStock, setCurrentStock] = useState<number | string>(0);
  const [minStock, setMinStock] = useState<number | string>(10);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setMaterialCode(itemToEdit.material_code);
        setName(itemToEdit.name);
        setCategory(itemToEdit.category);
        setFpaType(itemToEdit.fpa_type === 'NON_FPA' ? 'NON_FPA' : 'FPA');
        const parsed = parseBinLocation(itemToEdit.location);
        setRuang(parsed.ruang);
        setRak(parsed.rak);
        setBaris(parsed.baris);
        setTingkat(parsed.tingkat);
        setLocation(itemToEdit.location);
        setUnit(itemToEdit.unit ? formatUnit(itemToEdit.unit) : 'EA');
        setCurrentStock(itemToEdit.current_stock);
        setMinStock(itemToEdit.min_stock);
        setDescription(itemToEdit.description);
      } else {
        // Auto-suggest next available 18-digit code
        generateSuggestedCode();
        setName('');
        setCategory(COMMON_CATEGORIES[0]);
        setCustomCategory('');
        setFpaType('FPA');
        setRuang('1');
        setRak('03');
        setBaris('02');
        setTingkat('04B');
        setLocation('1.03.02.04B');
        setUnit('EA');
        setCurrentStock(10);
        setMinStock(5);
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, itemToEdit]);

  const handleRuangChange = (val: string) => {
    setRuang(val);
    setLocation(formatBinLocation({ ruang: val, rak, baris, tingkat }));
  };

  const handleRakChange = (val: string) => {
    setRak(val);
    setLocation(formatBinLocation({ ruang, rak: val, baris, tingkat }));
  };

  const handleBarisChange = (val: string) => {
    setBaris(val);
    setLocation(formatBinLocation({ ruang, rak, baris: val, tingkat }));
  };

  const handleTingkatChange = (val: string) => {
    setTingkat(val);
    setLocation(formatBinLocation({ ruang, rak, baris, tingkat: val }));
  };

  const handleFullLocationChange = (val: string) => {
    setLocation(val);
    const parsed = parseBinLocation(val);
    setRuang(parsed.ruang);
    setRak(parsed.rak);
    setBaris(parsed.baris);
    setTingkat(parsed.tingkat);
  };

  const generateSuggestedCode = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 90000);
    // Exact 18 digits: 031007 + 12 digits sequential
    setMaterialCode(`031007${String(randomSuffix).padStart(12, '0')}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = materialCode.trim().replace(/\D/g, '');
    if (!cleanCode) {
      setError('Material number (nomor material) harus diisi');
      return;
    }
    if (cleanCode.length !== 18) {
      setError(`Material number harus tepat 18 angka digit (saat ini ${cleanCode.length} digit). Sistem otomatis mengeliminasi nomor kurang/lebih dari 18 digit.`);
      return;
    }
    if (!name.trim()) {
      setError('Nama barang harus diisi');
      return;
    }

    const finalCategory = category === 'OTHER' ? customCategory.trim() || 'Umum' : category;

    const cleanUnit = unit.trim() ? formatUnit(unit.trim()) : 'EA';
    const parsedCurrentStock = typeof currentStock === 'number' ? currentStock : parseInt(String(currentStock), 10) || 0;
    const parsedMinStock = typeof minStock === 'number' ? minStock : parseInt(String(minStock), 10) || 0;

    setIsSubmitting(true);
    try {
      if (isEdit && itemToEdit) {
        const updated = await db.updateItem(itemToEdit.id, {
          material_code: cleanCode,
          name: name.trim(),
          category: finalCategory,
          fpa_type: fpaType,
          location: location.trim(),
          unit: cleanUnit,
          current_stock: parsedCurrentStock,
          min_stock: parsedMinStock,
          description: description.trim(),
        });
        onSuccess(updated);
      } else {
        const created = await db.addItem({
          material_code: cleanCode,
          name: name.trim(),
          category: finalCategory,
          fpa_type: fpaType,
          location: location.trim(),
          unit: cleanUnit,
          current_stock: parsedCurrentStock,
          min_stock: parsedMinStock,
          description: description.trim(),
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to save item:', err);
      setError(err.message || 'Gagal menyimpan data barang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-[#0A192F] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
              {isEdit ? <Edit3 className="w-4 h-4" /> : <PackagePlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">
                {isEdit ? 'Edit Data Barang' : 'Tambah Barang Baru'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {isEdit ? 'Perbarui spesifikasi dan informasi barang' : 'Registrasi barang baru ke sistem inventaris gudang'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Material Code with Auto Generator */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800">Material Number:</label>
              {!isEdit && (
                <button
                  type="button"
                  onClick={generateSuggestedCode}
                  className="text-[11px] font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Acak Kode</span>
                </button>
              )}
            </div>
            <input
              type="text"
              value={materialCode}
              onChange={(e) => setMaterialCode(e.target.value.trim())}
              placeholder="Contoh: 031007000000000235"
              maxLength={24}
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
              required
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Barang:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Bearing SKF 6205-2RSH Deep Groove"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Category & FPA Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Barang:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="OTHER">+ Kategori Lainnya</option>
              </select>
              {category === 'OTHER' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Ketik kategori baru..."
                  className="w-full mt-2 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              )}
            </div>

            {/* FPA / Non-FPA Classification */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori Pengadaan (FPA):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFpaType('FPA')}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    fpaType === 'FPA'
                      ? 'bg-blue-800 text-white border-blue-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${fpaType === 'FPA' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                  <span>FPA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFpaType('NON_FPA')}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    fpaType === 'NON_FPA'
                      ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${fpaType === 'NON_FPA' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  <span>Non-FPA</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {fpaType === 'FPA'
                  ? '• Kontrak Payung / Perjanjian Harga Tetap'
                  : '• Pengadaan Bebas / Non-Kontrak'}
              </p>
            </div>
          </div>

          {/* 4-Level Bin Location Structure: Ruang . Rak . Baris . Tingkat */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Struktur Bin Location (4 Tingkatan):</span>
              </label>
              <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-bold">
                {location}
              </span>
            </div>

            {/* 4 Segmented inputs: Ruang . Rak . Baris . Tingkat */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  1. Ruang
                </label>
                <input
                  type="text"
                  value={ruang}
                  onChange={(e) => handleRuangChange(e.target.value)}
                  placeholder="Contoh: 1"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  2. Rak
                </label>
                <input
                  type="text"
                  value={rak}
                  onChange={(e) => handleRakChange(e.target.value)}
                  placeholder="Contoh: 03"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  3. Baris
                </label>
                <input
                  type="text"
                  value={baris}
                  onChange={(e) => handleBarisChange(e.target.value)}
                  placeholder="Contoh: 02"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  4. Tingkat
                </label>
                <input
                  type="text"
                  value={tingkat}
                  onChange={(e) => handleTingkatChange(e.target.value)}
                  placeholder="Contoh: 04B"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Direct Full string input fallback & helper */}
            <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
              <p className="text-slate-500">
                Format: <span className="font-semibold text-slate-700">Ruang . Rak . Baris . Tingkat</span> (Contoh: <code className="bg-slate-200 px-1 rounded text-indigo-700">1.03.02.04B</code>)
              </p>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[10px]">Edit Cepat:</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => handleFullLocationChange(e.target.value)}
                  className="px-2 py-0.5 text-[11px] font-mono bg-white border border-slate-300 rounded w-32"
                />
              </div>
            </div>
          </div>

          {/* Stock & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan Unit:</label>
              <input
                list="common-units-list"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Contoh: EA"
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                required
              />
              <datalist id="common-units-list">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </datalist>

              {/* Quick Suggestion Chips */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['EA', 'unit', 'set', 'box', 'roll', 'meter'].map((suggested) => (
                  <button
                    key={suggested}
                    type="button"
                    onClick={() => setUnit(suggested)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                      unit.trim().toUpperCase() === suggested.toUpperCase()
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {suggested}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Unrestricted Stock:
              </label>
              <input
                type="number"
                min="0"
                value={currentStock === '' ? '' : currentStock}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setCurrentStock('');
                  } else {
                    const sanitized = val.replace(/^0+(?=\d)/, '');
                    const parsed = parseInt(sanitized, 10);
                    setCurrentStock(isNaN(parsed) ? 0 : Math.max(0, parsed));
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  if (currentStock === '' || isNaN(Number(currentStock))) {
                    setCurrentStock(0);
                  }
                }}
                placeholder="0"
                className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">ROP (Reorder Point):</label>
              <input
                type="number"
                min="0"
                value={minStock === '' ? '' : minStock}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setMinStock('');
                  } else {
                    const sanitized = val.replace(/^0+(?=\d)/, '');
                    const parsed = parseInt(sanitized, 10);
                    setMinStock(isNaN(parsed) ? 0 : Math.max(0, parsed));
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  if (minStock === '' || isNaN(Number(minStock))) {
                    setMinStock(0);
                  }
                }}
                placeholder="0"
                className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi / Spesifikasi:</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Spesifikasi teknis material, nomor seri, standar industri, dll."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#1E3A8A] hover:bg-blue-900 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Barang Baru'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
