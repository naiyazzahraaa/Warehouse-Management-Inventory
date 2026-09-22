import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, AlertCircle, RefreshCw, FileCheck } from 'lucide-react';
import { CsvItemRow } from '../types';
import { db } from '../services/db';
import { formatUnit } from '../utils/units';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (count: number) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CsvItemRow[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [invalidLengthWarnings, setInvalidLengthWarnings] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setDuplicateWarnings([]);
    setInvalidLengthWarnings([]);
    setParseErrors([]);
    setIsLoading(false);
    setIsProcessing(false);
  };

  const handleDownloadExcelTemplate = () => {
    const templateData = [
      {
        material_code: '031007000000000235',
        name: 'Bearing SKF 6205-2RSH Deep Groove',
        category: 'Mekanik & Sparepart',
        fpa_type: 'FPA',
        description: 'Bearing roda beban berat motor conveyer line 2',
        initial_stock: 25,
        location: 'TN 1.03.02.04B',
        unit: 'EA',
        min_stock: 10,
      },
      {
        material_code: '031007000000000236',
        name: 'Inverter Fuji Frenic 5.5kW',
        category: 'Elektrikal',
        fpa_type: 'FPA',
        description: 'Variable speed drive motor 380V',
        initial_stock: 4,
        location: 'TN 1.01.05.02A',
        unit: 'unit',
        min_stock: 2,
      },
      {
        material_code: '031007000000000237',
        name: 'Fitting Elbow 90 CS 3 inch',
        category: 'Pipa & Fitting',
        fpa_type: 'NON_FPA',
        description: 'Sambungan las pipa schedule 40',
        initial_stock: 50,
        location: 'TN 2.03.01.01A',
        unit: 'EA',
        min_stock: 15,
      },
      {
        material_code: '031007000000000238',
        name: 'Safety Glasses UVEX Stealth',
        category: 'Alat Pelindung Diri (APD)',
        fpa_type: 'FPA',
        description: 'Kacamata goggle anti embun safety',
        initial_stock: 60,
        location: 'TN 3.02.04.01A',
        unit: 'EA',
        min_stock: 20,
      },
      {
        material_code: '031007000000000239',
        name: 'Oli Rantai Mobil DTE 25 (Pail 20L)',
        category: 'Pelumas & Kimia',
        fpa_type: 'NON_FPA',
        description: 'Pelumas sistem sirkulasi gear',
        initial_stock: 12,
        location: 'TN 2.01.01.01B',
        unit: 'pail',
        min_stock: 5,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 24 }, // material_code (18 digit)
      { wch: 38 }, // name
      { wch: 24 }, // category
      { wch: 14 }, // fpa_type (FPA / NON_FPA)
      { wch: 38 }, // description
      { wch: 14 }, // initial_stock
      { wch: 18 }, // location (BIN)
      { wch: 14 }, // unit
      { wch: 12 }, // min_stock
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Barang');
    XLSX.writeFile(wb, 'template_import_barang.xlsx');
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = [
      'material_code,name,category,fpa_type,description,initial_stock,location,unit,min_stock',
      '031007000000000235,Bearing SKF 6205-2RSH Deep Groove,Mekanik & Sparepart,FPA,Bearing roda beban berat motor,25,TN 1.03.02.04B,EA,10',
      '031007000000000236,Inverter Fuji Frenic 5.5kW,Elektrikal,FPA,Variable speed drive motor 380V,4,TN 1.01.05.02A,unit,2',
      '031007000000000237,Fitting Elbow 90 CS 3 inch,Pipa & Fitting,NON_FPA,Sambungan las pipa schedule 40,50,TN 2.03.01.01A,EA,15',
      '031007000000000238,Safety Glasses UVEX Stealth,Alat Pelindung Diri (APD),FPA,Kacamata goggle anti embun,60,TN 3.02.04.01A,EA,20',
      '031007000000000239,Oli Rantai Mobil DTE 25 (Pail 20L),Pelumas & Kimia,NON_FPA,Pelumas sistem sirkulasi gear,12,TN 2.01.01.01B,pail,5',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_inventaris_gudang.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRowVal = (row: any, ...aliases: string[]): string => {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
        return String(row[alias]).trim();
      }
    }
    const rowKeys = Object.keys(row || {});
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[\s_\-\.]/g, '');
      for (const key of rowKeys) {
        const cleanKey = key.toLowerCase().replace(/[\s_\-\.]/g, '');
        if (cleanKey === cleanAlias && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return String(row[key]).trim();
        }
      }
    }
    return '';
  };

  const processRawRecords = async (rawData: any[]) => {
    const errors: string[] = [];
    const rows: CsvItemRow[] = [];
    const seenInFile = new Set<string>();
    const duplicates: string[] = [];
    const autoPaddedNotes: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rawCode = getRowVal(
        row,
        'material_code',
        'kode_material',
        'nomor_material',
        'no_material',
        'no._material',
        'material_no',
        'material_number',
        'kode_barang',
        'code',
        'kode',
        'part_number',
        'part_no',
        'material',
        'sap_code',
        'sap_no'
      );
      const codeDigits = rawCode.replace(/\D/g, '');

      // Auto-pad to 18 digits if purely numeric and <= 18 digits (handles Excel leading 0 truncation)
      let finalCode = rawCode;
      if (codeDigits.length > 0 && codeDigits.length <= 18) {
        finalCode = codeDigits.padStart(18, '0');
        if (codeDigits.length < 18) {
          autoPaddedNotes.push(`Baris ${i + 2}: '${rawCode}' (${codeDigits.length} digit) -> '${finalCode}' (18 digit)`);
        }
      } else if (codeDigits.length > 18) {
        finalCode = codeDigits;
      }

      const name = getRowVal(row, 'name', 'nama_barang', 'nama', 'item_name', 'deskripsi_singkat', 'barang');
      const category = getRowVal(row, 'category', 'kategori', 'kelompok', 'group') || 'Umum';
      const rawFpa = getRowVal(row, 'fpa_type', 'fpa', 'klasifikasi', 'kategori_fpa', 'tipe', 'kontrak').toUpperCase();
      const fpaType: 'FPA' | 'NON_FPA' = (
        rawFpa === 'FPA' ||
        rawFpa === 'KONTRAK' ||
        rawFpa.includes('KONTRAK') ||
        rawFpa === 'YA' ||
        rawFpa === 'YES' ||
        rawFpa === 'TRUE' ||
        rawFpa === '1'
      ) ? 'FPA' : 'NON_FPA';

      const description = getRowVal(row, 'description', 'deskripsi', 'keterangan', 'spek', 'spesifikasi');
      const initial_stock = parseInt(getRowVal(row, 'initial_stock', 'stok_awal', 'stock', 'stok', 'qty', 'saldo', 'saldo_awal') || '0', 10) || 0;
      const location = getRowVal(row, 'location', 'lokasi', 'bin_location', 'bin', 'rak') || 'TN 1.01.01.01A';
      const rawUnit = getRowVal(row, 'unit', 'satuan', 'uom') || 'EA';
      const unit = formatUnit(rawUnit);
      const min_stock = parseInt(getRowVal(row, 'min_stock', 'stok_minimum', 'min_stok', 'safety_stock') || '10', 10) || 10;

      if (!rawCode) {
        errors.push(`Baris ${i + 2}: Kolom nomor material (material_code) kosong.`);
        continue;
      }

      if (!name) {
        errors.push(`Baris ${i + 2} (${finalCode}): Kolom nama barang (name) kosong.`);
        continue;
      }

      // Check duplicate within file
      const dedupKey = finalCode.toUpperCase();
      if (seenInFile.has(dedupKey)) {
        duplicates.push(`${finalCode} (duplikat di dalam file baris ${i + 2})`);
        continue;
      }
      seenInFile.add(dedupKey);

      // Check if already in database
      const existingInDb = await db.getItemByMaterialCode(finalCode);
      if (existingInDb) {
        duplicates.push(`${finalCode} (sudah ada di database: "${existingInDb.name}")`);
        continue;
      }

      rows.push({
        material_code: finalCode,
        name,
        category,
        fpa_type: fpaType,
        description,
        initial_stock,
        location,
        unit,
        min_stock,
      });
    }

    setParsedRows(rows);
    setDuplicateWarnings(duplicates);
    setInvalidLengthWarnings(autoPaddedNotes);
    setParseErrors(errors);
    setIsLoading(false);
  };

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsLoading(true);
    setDuplicateWarnings([]);
    setInvalidLengthWarnings([]);
    setParseErrors([]);

    const fileName = selectedFile.name.toLowerCase();

    // Check if Excel (.xlsx, .xls)
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const buffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setParseErrors(['Berkas Excel tidak memiliki sheet yang dapat dibaca.']);
          setIsLoading(false);
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });
        if (!rawData || rawData.length === 0) {
          setParseErrors(['Sheet Excel kosong atau tidak memiliki data baris.']);
          setIsLoading(false);
          return;
        }
        await processRawRecords(rawData);
      } catch (err: any) {
        setParseErrors([`Gagal membaca berkas Excel: ${err?.message || err}`]);
        setIsLoading(false);
      }
      return;
    }

    // Default to CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        await processRawRecords(results.data as any[]);
      },
      error: (err) => {
        setParseErrors([`Gagal membaca file CSV: ${err.message}`]);
        setIsLoading(false);
      },
    });
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const result = await db.importCsvItems(parsedRows);
      onImportSuccess(result.importedCount);
      resetState();
      onClose();
    } catch (err: any) {
      setParseErrors([err.message || 'Gagal mengimpor data ke database.']);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#0A192F] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight text-white">Import Data Barang Massal (Excel & CSV)</h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  .xlsx / .csv
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Unggah berkas Microsoft Excel (.xlsx) atau CSV untuk memasukkan ribuan barang dan unrestricted stock awal secara otomatis
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Download Template Banner */}
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950">Template Master Barang Siap Pakai:</span>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  Kolom: <code>material_code, name, category, description, initial_stock, location, unit, min_stock</code>
                </p>
                <p className="text-emerald-700 text-[10px] mt-0.5">
                  Format lokasi BIN otomatis mendukung 4 tingkatan (contoh: <code>1.03.02.04B</code>)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadExcelTemplate}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                title="Unduh template berformat Microsoft Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Excel (.xlsx)</span>
              </button>
              <button
                onClick={handleDownloadCsvTemplate}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-xs transition-colors"
                title="Unduh template berformat CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          {!file && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped) {
                  handleFileChange(dropped);
                }
              }}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/30 flex flex-col items-center justify-center gap-3 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-sm">Pilih berkas Excel (.xlsx) atau CSV</span> atau seret file ke sini
                <p className="text-xs text-slate-500 mt-1">Mendukung format Microsoft Excel (.xlsx, .xls) dan CSV dengan header kolom standar</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
                className="hidden"
              />
            </div>
          )}

          {/* Parsing Spinner */}
          {isLoading && (
            <div className="p-8 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-600 font-medium">Memeriksa struktur data dan validasi duplikasi...</p>
            </div>
          )}

          {/* Validation Warnings & Feedback */}
          {file && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                  <span className="font-bold text-slate-800">{file.name}</span>
                  <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={() => resetState()}
                  className="text-xs text-rose-600 hover:underline font-semibold"
                >
                  Ganti File
                </button>
              </div>

              {/* Auto-Padding Notice for leading zeros */}
              {invalidLengthWarnings.length > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-950">
                        Otomatis Dilengkapi Menjadi 18 Digit ({invalidLengthWarnings.length} item disesuaikan):
                      </h4>
                      <p className="text-emerald-800 mt-0.5">
                        Baris dengan angka 0 di depan yang terpotong oleh format Excel telah <strong>secara otomatis distandarisasi menjadi 18 digit SAP</strong>:
                      </p>
                    </div>
                  </div>
                  <div className="max-h-28 overflow-y-auto bg-white/70 p-2 rounded-lg border border-emerald-200/60 font-mono text-[11px] text-emerald-950 divide-y divide-emerald-100">
                    {invalidLengthWarnings.map((inv, idx) => (
                      <div key={idx} className="py-0.5">{inv}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicate Validation Alert */}
              {duplicateWarnings.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-950">
                        Eliminasi Otomatis: Duplikasi Material Number ({duplicateWarnings.length} item terdeteksi):
                      </h4>
                      <p className="text-amber-800 mt-0.5">
                        Item dengan Material Number duplikat di bawah ini telah <strong>dieliminasi otomatis</strong> untuk mencegah tabrakan data:
                      </p>
                    </div>
                  </div>
                  <div className="max-h-28 overflow-y-auto bg-white/70 p-2 rounded-lg border border-amber-200/60 font-mono text-[11px] text-amber-950 divide-y divide-amber-100">
                    {duplicateWarnings.map((dup, idx) => (
                      <div key={idx} className="py-0.5">{dup}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parse Errors */}
              {parseErrors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-bold">Ditemukan kesalahan pada format baris:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-800">
                    {parseErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table of Valid Items to be Imported */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Pratinjau Data Siap Impor: <span className="text-emerald-600">{parsedRows.length} item valid (18 digit terverifikasi)</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Menampilkan 5 baris pertama</span>
                </div>
                
                {parsedRows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Tidak ada baris data yang valid untuk diimpor.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200/80 text-slate-800 text-[10px] uppercase font-bold">
                        <tr>
                          <th className="py-2 px-3">Material Number</th>
                          <th className="py-2 px-3">Nama Barang</th>
                          <th className="py-2 px-3">Klasifikasi</th>
                          <th className="py-2 px-3">Kategori</th>
                          <th className="py-2 px-3">Lokasi</th>
                          <th className="py-2 px-3 text-right">Unrestricted Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                        {parsedRows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-indigo-700">{r.material_code}</td>
                            <td className="py-2 px-3 font-sans text-slate-800">{r.name}</td>
                            <td className="py-2 px-3 font-sans">
                              {r.fpa_type === 'FPA' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  ⭐ FPA
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
                                  Non-FPA
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-600">{r.category}</td>
                            <td className="py-2 px-3 font-sans text-slate-600">{r.location}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">{r.initial_stock} {r.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          
          <button
            onClick={handleConfirmImport}
            disabled={parsedRows.length === 0 || isProcessing}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm shadow-emerald-200 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProcessing ? 'Menyimpan ke Database...' : `Impor ${parsedRows.length} Barang Sekarang`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
