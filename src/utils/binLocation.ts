/**
 * Utility functions for 4-Level Bin Location:
 * Format: Ruang . Rak . Baris . Tingkat
 * Contoh format nilai: 1.03.02.04B
 */

export interface BinLocationParts {
  ruang: string;
  rak: string;
  baris: string;
  tingkat: string;
}

export function parseBinLocation(loc?: string): BinLocationParts {
  if (!loc) {
    return { ruang: '1', rak: '01', baris: '01', tingkat: '01A' };
  }
  
  const rawParts = loc.split('.').map((p) => p.trim());
  return {
    ruang: rawParts[0] || '1',
    rak: rawParts[1] || '01',
    baris: rawParts[2] || '01',
    tingkat: rawParts[3] || '01A',
  };
}

export function formatBinLocation(parts: Partial<BinLocationParts>): string {
  const ruang = (parts.ruang || '1').trim();
  const rak = (parts.rak || '01').trim();
  const baris = (parts.baris || '01').trim();
  const tingkat = (parts.tingkat || '01A').trim();
  return `${ruang}.${rak}.${baris}.${tingkat}`;
}

export function isValidBinLocation(loc: string): boolean {
  if (!loc) return false;
  const parts = loc.split('.');
  return parts.length === 4 && parts.every((p) => p.trim().length > 0);
}
