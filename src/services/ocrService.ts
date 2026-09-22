import { createWorker, Worker } from 'tesseract.js';
import { db } from './db';
import { InventoryItem } from '../types';

class OCRService {
  private worker: Worker | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<Worker | null> | null = null;

  /**
   * Pre-warm worker in background so scanning is instantaneous
   */
  public async getWorker(): Promise<Worker | null> {
    if (this.worker) return this.worker;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const worker = await createWorker('eng');
        this.worker = worker;
        return worker;
      } catch (err) {
        console.warn('Failed to pre-initialize Tesseract worker:', err);
        return null;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Fast image pre-processing with high-contrast binarization & grayscale
   */
  public preprocessImage(
    sourceCanvas: HTMLCanvasElement,
    options: { binarize?: boolean; contrast?: number } = {}
  ): HTMLCanvasElement {
    const { binarize = true, contrast = 1.4 } = options;
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Contrast factor
    const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

    for (let i = 0; i < data.length; i += 4) {
      // Grayscale luminance
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      // Apply contrast
      let adjusted = factor * (gray - 128) + 128;
      adjusted = Math.max(0, Math.min(255, adjusted));

      if (binarize) {
        // High-contrast thresholding for text/numbers
        const binary = adjusted > 130 ? 255 : 0;
        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
      } else {
        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Universal format cleaner: extracts all potential material numbers / numbers
   * regardless of how it's formatted (spaces, dots, slashes, dashes, prefixes).
   */
  public extractPotentialCodes(rawText: string): string[] {
    const candidates = new Set<string>();
    if (!rawText || !rawText.trim()) return [];

    const raw = rawText.trim();

    // 1. Direct raw token
    // 0. Check if raw text is a bin-card URL or route (e.g. https://.../bin-card/item-123 or /bin-card/051111...)
    const binCardMatch = raw.match(/\/bin-card\/([A-Za-z0-9_\-\.]+)/i);
    if (binCardMatch && binCardMatch[1]) {
      candidates.add(binCardMatch[1].trim());
    }

    // 1. Direct raw token
    const directClean = raw.replace(/[\r\n\t]+/g, ' ').trim();
    candidates.add(directClean);

    // If text contains an item ID format (e.g. item-csv-..., item-17...)
    const itemIdMatches = raw.match(/\bitem-[a-z0-9_\-]+\b/gi) || [];
    itemIdMatches.forEach((m) => candidates.add(m.trim()));

    // 2. Strip common prefixes (e.g. "MAT:", "SAP:", "QR-", "NO:", "PO:", "KODE:", "PART:", "ITEM:", "S/N:")
    const strippedPrefix = directClean.replace(/^(mat|sap|qr|no|po|kode|part|item|s\/n|sn)[\s.:#-]+/i, '').trim();
    if (strippedPrefix) candidates.add(strippedPrefix);

    // 3. Extract pure digits with any formatting (e.g. "031.007.000.000.000.235" or "031 007 000 235" -> "031007000000000235")
    const digitsOnly = directClean.replace(/\D/g, '');
    if (digitsOnly.length >= 3) {
      candidates.add(digitsOnly);
      // Auto-pad to 18 digits (handles Excel leading zero stripping)
      if (digitsOnly.length <= 18) {
        candidates.add(digitsOnly.padStart(18, '0'));
      }
      // Also unpadded without leading zeroes
      const unpadded = digitsOnly.replace(/^0+/, '');
      if (unpadded.length >= 3) {
        candidates.add(unpadded);
      }
    }

    // 4. Find all continuous sequences of digits or alphanumeric (length >= 3)
    const regexDigitRuns = raw.match(/\b\d{3,24}\b/g) || [];
    regexDigitRuns.forEach((r) => {
      candidates.add(r);
      if (r.length <= 18) {
        candidates.add(r.padStart(18, '0'));
      }
      const unpadded = r.replace(/^0+/, '');
      if (unpadded.length >= 3) {
        candidates.add(unpadded);
      }
    });

    // Numbers separated by dots, dashes, slashes or spaces like 031-007-000 or 100.200.45
    const regexFormattedNumbers = raw.match(/(\d+[\s.\-_/]+\d+[\s.\-_/\d]*)/g) || [];
    regexFormattedNumbers.forEach((fn) => {
      const cleanFn = fn.replace(/[\s.\-_/]/g, '');
      if (cleanFn.length >= 3) {
        candidates.add(cleanFn);
        if (cleanFn.length <= 18) {
          candidates.add(cleanFn.padStart(18, '0'));
        }
      }
      candidates.add(fn.trim());
    });

    // Alphanumeric tokens (e.g., MAT-91301, ABC-1029)
    const regexAlphaTokens = raw.match(/[A-Za-z0-9_\-\/]{3,30}/g) || [];
    regexAlphaTokens.forEach((tok) => {
      const t = tok.trim();
      candidates.add(t);
      const stripped = t.replace(/^(mat|sap|qr|no|kode)[\-_:]*/i, '');
      if (stripped.length >= 3) candidates.add(stripped);
    });

    // 5. OCR digit substitutions for common character misrecognitions
    // e.g., 'O' -> '0', 'l'/'I' -> '1', 'S' -> '5', 'B' -> '8'
    const normalizedDigits = directClean
      .replace(/[oO]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[sS]/g, '5')
      .replace(/[bB]/g, '8')
      .replace(/\D/g, '');
    if (normalizedDigits.length >= 3) {
      candidates.add(normalizedDigits);
      if (normalizedDigits.length <= 18) {
        candidates.add(normalizedDigits.padStart(18, '0'));
      }
    }

    return Array.from(candidates).filter((c) => c && c.length >= 2);
  }

  /**
   * Fast recognition of an image, video frame, or canvas
   */
  public async recognizeText(
    imageSource: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | Blob | File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const worker = await this.getWorker();
    if (!worker) {
      throw new Error('Worker OCR tidak dapat diinisialisasi');
    }

    const ret = await worker.recognize(imageSource);
    return ret.data.text || '';
  }

  /**
   * High-accuracy matcher: checks candidates against the inventory database
   */
  public async matchWithDatabase(
    rawText: string
  ): Promise<{ matchedItem: InventoryItem | null; detectedCode: string | null }> {
    const candidates = this.extractPotentialCodes(rawText);

    // 1. Direct match by item ID or material_code
    for (const code of candidates) {
      // Check ID first
      const itemById = await db.getItemById(code);
      if (itemById) {
        return { matchedItem: itemById, detectedCode: itemById.material_code };
      }

      // Check Material Code
      const itemByCode = await db.getItemByMaterialCode(code);
      if (itemByCode) {
        return { matchedItem: itemByCode, detectedCode: itemByCode.material_code };
      }
    }

    // 2. Exact match on raw digits stripping (comparing digits in database vs scanned digits)
    const allItemsRes = await db.getItems({ pageSize: 1000 });
    const allItems = allItemsRes.items;

    for (const cand of candidates) {
      const candDigits = cand.replace(/\D/g, '');
      if (candDigits.length >= 4) {
        const found = allItems.find((it) => {
          const itemDigits = it.material_code.replace(/\D/g, '');
          const unpaddedItem = itemDigits.replace(/^0+/, '');
          const unpaddedCand = candDigits.replace(/^0+/, '');
          return (
            itemDigits === candDigits ||
            (unpaddedItem.length >= 4 && unpaddedItem === unpaddedCand) ||
            (candDigits.length >= 5 && itemDigits.endsWith(candDigits)) ||
            (itemDigits.length >= 5 && candDigits.endsWith(itemDigits))
          );
        });
        if (found) {
          return { matchedItem: found, detectedCode: found.material_code };
        }
      }
    }

    // 3. Substring match or code match in item name / code
    for (const cand of candidates) {
      const upper = cand.toUpperCase();
      const found = allItems.find(
        (it) =>
          it.id.toUpperCase() === upper ||
          it.material_code.toUpperCase() === upper ||
          it.material_code.toUpperCase().includes(upper) ||
          upper.includes(it.material_code.toUpperCase()) ||
          (upper.length >= 5 && it.name.toUpperCase().includes(upper))
      );
      if (found) {
        return { matchedItem: found, detectedCode: found.material_code };
      }
    }

    // Return the best representative candidate for manual display
    const bestCandidate =
      candidates.find((c) => /^\d{4,}$/.test(c)) ||
      candidates.find((c) => c.length >= 4) ||
      candidates[0] ||
      null;

    return { matchedItem: null, detectedCode: bestCandidate };
  }
}

export const ocrService = new OCRService();
