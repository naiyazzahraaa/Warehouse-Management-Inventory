/**
 * Standard Date/Time Formatting Utilities (24-Hour Format: DD/MM/YYYY HH:mm)
 */

export function padZero(num: number, length: number = 2): string {
  return String(num).padStart(length, '0');
}

/**
 * Format a Date or ISO string into 24-hour format: DD/MM/YYYY HH:mm
 * Example: 24/02/2026 14:30
 */
export function formatDateTime24h(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = padZero(d.getDate());
  const month = padZero(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = padZero(d.getHours());
  const minutes = padZero(d.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format date only: DD/MM/YYYY
 */
export function formatDateOnly(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = padZero(d.getDate());
  const month = padZero(d.getMonth() + 1);
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Convert Date to HTML datetime-local value (YYYY-MM-DDTHH:mm)
 */
export function toDateTimeLocalValue(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  const h = padZero(d.getHours());
  const min = padZero(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Parse a custom string (either DD/MM/YYYY HH:mm or standard ISO / datetime-local) into ISO string
 */
export function parseToIsoString(input: string): string {
  if (!input || !input.trim()) return new Date().toISOString();
  const clean = input.trim();

  // Pattern: DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss
  const regex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
  const match = clean.match(regex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hours = match[4] ? parseInt(match[4], 10) : 0;
    const minutes = match[5] ? parseInt(match[5], 10) : 0;
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    const date = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Fallback to standard Date parse
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }

  return new Date().toISOString();
}
