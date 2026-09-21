/**
 * Utilities for unit formatting and conversions across the application.
 * Default recommended unit is 'EA'.
 * Converts legacy 'pcs' / 'pc' / 'ea (each)' to 'EA' while allowing full flexibility for custom units.
 */

export function formatUnit(unit?: string): string {
  if (!unit || !unit.trim()) return 'EA';
  const trimmed = unit.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'pcs' || lower === 'pc' || lower === 'pcs.' || lower === 'pc.') {
    return 'EA';
  }
  if (lower === 'ea (each)' || lower === 'each') {
    return 'EA';
  }
  return trimmed;
}

export const COMMON_UNITS = [
  'EA',
  'unit',
  'set',
  'box',
  'roll',
  'meter',
  'batang',
  'drum',
  'liter',
  'kg',
  'pail',
  'sak',
  'can',
  'dus',
  'lembar',
  'pack',
];

