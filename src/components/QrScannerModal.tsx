import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  Camera,
  Keyboard,
  AlertCircle,
  ArrowRight,
  Zap,
  Upload,
  RefreshCw,
  FolderOpen,
  ScanText,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { db } from '../services/db';
import { ocrService } from '../services/ocrService';
import { InventoryItem } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemFound: (item: InventoryItem) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onItemFound,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [sampleItems, setSampleItems] = useState<InventoryItem[]>([]);
  const [filteredManualItems, setFilteredManualItems] = useState<InventoryItem[]>([]);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrCandidates, setOcrCandidates] = useState<string[]>([]);
  const [isWorkerReady, setIsWorkerReady] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerContainerId = 'qr-reader-container';

  // 1. Fetch sample items and pre-warm OCR worker in background immediately
  useEffect(() => {
    if (isOpen) {
      db.getItems({ pageSize: 6 }).then(({ items }) => setSampleItems(items));
      
      // Warm up Tesseract OCR in background
      ocrService.getWorker().then((w) => {
        if (w) setIsWorkerReady(true);
      });
    }
  }, [isOpen]);

  // Live filter for manual typing (tolerant to spaces, dots, dashes)
  useEffect(() => {
    if (!manualCode.trim()) {
      setFilteredManualItems([]);
      return;
    }

    const cleanInput = manualCode.replace(/[\s.\-_/]/g, '').toUpperCase();
    db.getItems({ pageSize: 200 }).then(({ items }) => {
      const matched = items.filter((it) => {
        const cleanMat = it.material_code.replace(/[\s.\-_/]/g, '').toUpperCase();
        return (
          cleanMat.includes(cleanInput) ||
          it.name.toLowerCase().includes(manualCode.toLowerCase())
        );
      });
      setFilteredManualItems(matched.slice(0, 5));
    });
  }, [manualCode]);

  // Handle camera scanner lifecycle
  useEffect(() => {
    if (!isOpen || activeMode !== 'camera') {
      stopCamera();
      return;
    }

    let isMounted = true;
    const startScanner = async () => {
      setCameraError(null);
      setIsScanning(true);

      // Delay to ensure container is ready in DOM
      await new Promise((r) => setTimeout(r, 120));
      if (!isMounted) return;

      try {
        const element = document.getElementById(scannerContainerId);
        if (!element) return;

        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch {
            // Ignore
          }
        }

        const supportedFormats = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
        ];

        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: supportedFormats,
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            handleBarcodeOrQrDetected(decodedText);
          },
          () => {
            // Live scanning frames
          }
        );
      } catch (err: any) {
        console.warn('Camera start error:', err);
        if (isMounted) {
          setCameraError('Kamera tidak dapat diakses. Gunakan opsi Galeri atau Ketik Manual.');
          setIsScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, activeMode]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleBarcodeOrQrDetected = async (rawCode: string) => {
    const { matchedItem, detectedCode } = await ocrService.matchWithDatabase(rawCode);

    await stopCamera();

    if (matchedItem) {
      onItemFound(matchedItem);
      onClose();
    } else {
      const fallback = detectedCode || rawCode.trim().toUpperCase();
      setManualError(`Kode/Nomor '${fallback}' tidak ditemukan dalam database inventaris.`);
      setActiveMode('manual');
      setManualCode(fallback);
    }
  };

  /**
   * Ultra-responsive OCR frame scanner (supports any format: 031007..., 100 200 45, MAT-91301, handwritten digits)
   */
  const handleScanOcrFrame = async () => {
    const video = document.querySelector<HTMLVideoElement>(`#${scannerContainerId} video`);
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Kamera belum siap.');
      return;
    }

    setIsOcrRunning(true);
    setOcrStatus('Membaca angka & teks...');
    setOcrCandidates([]);

    try {
      // 1. Capture frame to canvas
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = video.videoWidth;
      rawCanvas.height = video.videoHeight;
      const rawCtx = rawCanvas.getContext('2d');
      if (!rawCtx) throw new Error('Canvas context failure');

      rawCtx.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);

      // 2. Crop center focus box (75% width x 45% height)
      const cropCanvas = document.createElement('canvas');
      const cropW = Math.floor(rawCanvas.width * 0.75);
      const cropH = Math.floor(rawCanvas.height * 0.45);
      const cropX = Math.floor((rawCanvas.width - cropW) / 2);
      const cropY = Math.floor((rawCanvas.height - cropH) / 2);
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(rawCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      }

      // 3. Preprocess with high-contrast binarization
      const targetCanvas = cropCtx
        ? ocrService.preprocessImage(cropCanvas, { binarize: true, contrast: 1.5 })
        : rawCanvas;

      // 4. Run fast OCR
      const recognizedText = await ocrService.recognizeText(targetCanvas);
      
      // Also extract all candidates
      const extractedCodes = ocrService.extractPotentialCodes(recognizedText);
      setOcrCandidates(extractedCodes.slice(0, 4));

      // 5. Match with database
      const { matchedItem, detectedCode } = await ocrService.matchWithDatabase(recognizedText);

      if (matchedItem) {
        await stopCamera();
        onItemFound(matchedItem);
        onClose();
      } else if (detectedCode || extractedCodes.length > 0) {
        const bestCode = detectedCode || extractedCodes[0];
        setManualCode(bestCode);
        setManualError(`Angka terbaca '${bestCode}', tidak ditemukan di stok gudang.`);
        setActiveMode('manual');
      } else {
        setManualError('Angka tidak terbaca jelas. Pastikan teks/angka berada di tengah kotak.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setManualError('Pencahayaan kurang optimal atau teks buram. Silakan coba lagi.');
    } finally {
      setIsOcrRunning(false);
      setOcrStatus(null);
    }
  };

  /**
   * File upload (supports QR, Barcode, or OCR on uploaded image)
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    setIsProcessingImage(true);
    setOcrStatus('Membaca file...');

    // Preview
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      await new Promise((r) => setTimeout(r, 80));

      // 1. Try QR/Barcode
      let decodedText: string | null = null;
      try {
        const supportedFormats = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
        ];
        const html5QrCode = new Html5Qrcode('qr-temp-file-reader', {
          formatsToSupport: supportedFormats,
          verbose: false,
        });
        decodedText = await html5QrCode.scanFile(file, true);
      } catch {
        decodedText = null;
      }

      if (decodedText) {
        setIsProcessingImage(false);
        setOcrStatus(null);
        await handleBarcodeOrQrDetected(decodedText);
        return;
      }

      // 2. OCR Text / Number recognition
      setOcrStatus('Mendeteksi deretan angka OCR...');
      const recognized = await ocrService.recognizeText(file);
      const { matchedItem, detectedCode } = await ocrService.matchWithDatabase(recognized);

      setIsProcessingImage(false);
      setOcrStatus(null);

      if (matchedItem) {
        onItemFound(matchedItem);
        onClose();
      } else if (detectedCode) {
        setActiveMode('manual');
        setManualCode(detectedCode);
        setManualError(`Angka terdeteksi '${detectedCode}', tidak ada di inventaris.`);
      } else {
        setCameraError('Kode atau deretan angka tidak terdeteksi pada gambar.');
      }
    } catch (err) {
      console.error('File scan error:', err);
      setIsProcessingImage(false);
      setOcrStatus(null);
      setCameraError('Gagal memproses gambar. Pastikan gambar jelas.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setManualError(null);
    const { matchedItem, detectedCode } = await ocrService.matchWithDatabase(manualCode.trim());

    if (matchedItem) {
      onItemFound(matchedItem);
      onClose();
    } else {
      setManualError(`Material Number '${(detectedCode || manualCode).trim().toUpperCase()}' tidak ditemukan.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#0A192F] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>Scan Material</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                  OCR Responsif
                </span>
              </h3>
              <p className="text-[10px] text-slate-300">QR Code, Barcode & Format Angka Apapun</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveMode('camera')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeMode === 'camera'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Kamera & OCR
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveMode('upload');
            }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeMode === 'upload'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Galeri
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveMode('manual');
            }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeMode === 'manual'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Ketik Manual
          </button>
        </div>

        {/* Scanner Content Area */}
        <div className="p-5">
          {activeMode === 'camera' && (
            <div>
              {cameraError ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{cameraError}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-amber-200/60 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        stopCamera();
                        setActiveMode('upload');
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Galeri Foto
                    </button>
                    <button
                      onClick={() => setActiveMode('manual')}
                      className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                    >
                      Ketik Manual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center border-2 border-slate-700 shadow-inner">
                    <div id={scannerContainerId} className="w-full h-full" />

                    {/* Visual viewfinder overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-60 h-44 border-2 border-emerald-400 rounded-2xl relative shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />
                        <div className="w-full h-0.5 bg-emerald-400/90 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_8px_#10B981]" />

                        <div className="absolute -bottom-7 left-0 right-0 text-center">
                          <span className="text-[10px] font-mono text-emerald-300 bg-black/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            Arahkan ke Angka / Barcode / QR
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* OCR Running Overlay */}
                    {isOcrRunning && (
                      <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white z-20 gap-2">
                        <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-300">
                          {ocrStatus || 'Menganalisis deretan angka...'}
                        </span>
                        <span className="text-[10px] text-slate-300">Engine OCR siap & aktif</span>
                      </div>
                    )}
                  </div>

                  {/* Trigger OCR Scan Button right below camera */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleScanOcrFrame}
                      disabled={isOcrRunning}
                      className="flex-1 py-3 bg-[#0A192F] hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold border border-emerald-500/40 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <ScanText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Scan Angka / Tulisan (OCR)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setActiveMode('upload');
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                      className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Galeri"
                    >
                      <FolderOpen className="w-4 h-4 text-slate-600" />
                      <span className="hidden sm:inline">Galeri</span>
                    </button>
                  </div>

                  {ocrCandidates.length > 0 && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="font-semibold text-slate-700 block mb-1">
                        Angka terdeteksi dari gambar:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ocrCandidates.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={async () => {
                              const { matchedItem } = await ocrService.matchWithDatabase(c);
                              if (matchedItem) {
                                onItemFound(matchedItem);
                                onClose();
                              } else {
                                setManualCode(c);
                                setActiveMode('manual');
                              }
                            }}
                            className="px-2 py-1 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-700 rounded text-[11px] font-mono font-bold text-slate-800 cursor-pointer"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeMode === 'upload' && (
            <div className="space-y-4 text-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 cursor-pointer transition-all bg-slate-50 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-2.5 group"
              >
                {uploadedImagePreview ? (
                  <div className="relative">
                    <img
                      src={uploadedImagePreview}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-36 h-36 object-contain rounded-xl border border-slate-200 shadow-sm bg-white"
                    />
                    {isProcessingImage && (
                      <div className="absolute inset-0 bg-slate-900/60 rounded-xl flex flex-col items-center justify-center text-white text-[11px] gap-1">
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                        <span>{ocrStatus || 'Memproses OCR...'}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                    <FolderOpen className="w-7 h-7" />
                  </div>
                )}

                <div className="text-xs">
                  <span className="font-bold text-emerald-700 underline underline-offset-2">Pilih Foto</span> atau seret file ke sini
                </div>
                <p className="text-[10px] text-slate-500">
                  Mendukung QR Code, Barcode, & Teks Angka dalam format apapun
                </p>

                <button
                  type="button"
                  className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Buka File Foto</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div id="qr-temp-file-reader" className="hidden" />

              {cameraError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}

          {activeMode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Material Number / Nama Barang:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: 031007000000000235 / 91301"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 placeholder-slate-400 uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-[#0A192F] hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Cari</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {filteredManualItems.length > 0 && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Saran Hasil Pencarian:
                  </div>
                  {filteredManualItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onItemFound(item);
                        onClose();
                      }}
                      className="p-2 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-slate-900">
                          {item.material_code}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-[200px]">
                          {item.name}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Pilih
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {manualError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}
            </form>
          )}

          {/* Quick Test Chips */}
          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                Uji Cepat Material:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sampleItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onItemFound(it);
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-md text-xs font-mono transition-colors text-left cursor-pointer"
                  title={it.name}
                >
                  <span className="font-bold">{it.material_code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
