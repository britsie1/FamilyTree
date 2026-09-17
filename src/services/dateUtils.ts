/**
 * Utilities for working with genealogical partial and full dates.
 * Standard format:
 * - Full date: 'YYYY-MM-DD'
 * - Year & Month: 'YYYY-MM'
 * - Year only: 'YYYY'
 */

export interface DateParts {
  year: string;
  month: string;
  day: string;
}

export const MONTH_OPTIONS = [
  { value: '', label: 'Month' },
  { value: '01', label: '01 - Jan' },
  { value: '02', label: '02 - Feb' },
  { value: '03', label: '03 - Mar' },
  { value: '04', label: '04 - Apr' },
  { value: '05', label: '05 - May' },
  { value: '06', label: '06 - Jun' },
  { value: '07', label: '07 - Jul' },
  { value: '08', label: '08 - Aug' },
  { value: '09', label: '09 - Sep' },
  { value: '10', label: '10 - Oct' },
  { value: '11', label: '11 - Nov' },
  { value: '12', label: '12 - Dec' },
] as const;

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

export const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

/**
 * Returns number of days in a given month (1-12) and year (for leap years).
 * Defaults to 31 if month is unknown.
 */
export function getDaysInMonth(year?: number | string | null, month?: number | string | null): number {
  const m = typeof month === 'string' ? parseInt(month, 10) : month;
  if (!m || m < 1 || m > 12) return 31;

  if (m === 2) {
    const y = typeof year === 'string' ? parseInt(year, 10) : year;
    if (y && Number.isFinite(y)) {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      return isLeap ? 29 : 28;
    }
    return 29; // default to 29 if year unknown
  }

  if ([4, 6, 9, 11].includes(m)) {
    return 30;
  }

  return 31;
}

/**
 * Parses an ISO date or partial date string into Year, Month, and Day parts.
 * Handles:
 * - 'YYYY-MM-DD'
 * - 'YYYY-MM'
 * - 'YYYY'
 * - fallback for non-standard formats containing 4-digit year
 */
export function parseDateParts(dateStr?: string | null): DateParts {
  if (!dateStr || typeof dateStr !== 'string') {
    return { year: '', month: '', day: '' };
  }

  const trimmed = dateStr.trim();
  if (trimmed === '0000' || trimmed === '0') {
    return { year: '', month: '', day: '' };
  }

  // Full date: YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    return {
      year: ymdMatch[1],
      month: ymdMatch[2].padStart(2, '0'),
      day: ymdMatch[3].padStart(2, '0'),
    };
  }

  // Year and month: YYYY-MM
  const ymMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (ymMatch) {
    return {
      year: ymMatch[1],
      month: ymMatch[2].padStart(2, '0'),
      day: '',
    };
  }

  // Year only: YYYY
  const yMatch = trimmed.match(/^(\d{4})$/);
  if (yMatch) {
    return {
      year: yMatch[1],
      month: '',
      day: '',
    };
  }

  // Fallback: search for standalone 4-digit year
  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (yearMatch) {
    return {
      year: yearMatch[1],
      month: '',
      day: '',
    };
  }

  return { year: '', month: '', day: '' };
}

/**
 * Builds an ISO partial or full date string from Year, Month, and Day components.
 * Returns undefined if no year is provided or if year is invalid/zero.
 */
export function buildDateString(parts: {
  year?: string | number | null;
  month?: string | number | null;
  day?: string | number | null;
}): string | undefined {
  const rawY = parts.year !== undefined && parts.year !== null ? String(parts.year).trim() : '';
  if (!rawY) return undefined;

  // Clean year digits
  const yearDigits = rawY.replace(/\D/g, '').slice(0, 4);
  if (!yearDigits) return undefined;

  const yearNum = parseInt(yearDigits, 10);
  if (Number.isNaN(yearNum) || yearNum === 0) return undefined;

  const year = yearDigits.length === 4 ? yearDigits : yearDigits.padStart(4, '0');

  const rawM = parts.month !== undefined && parts.month !== null ? String(parts.month).trim() : '';
  const monthNum = parseInt(rawM, 10);
  if (!monthNum || monthNum < 1 || monthNum > 12) {
    return year;
  }
  const month = String(monthNum).padStart(2, '0');

  const rawD = parts.day !== undefined && parts.day !== null ? String(parts.day).trim() : '';
  const dayNum = parseInt(rawD, 10);
  const maxDays = getDaysInMonth(parseInt(year, 10), monthNum);

  if (!dayNum || dayNum < 1) {
    return `${year}-${month}`;
  }

  const clampedDay = Math.min(dayNum, maxDays);
  const day = String(clampedDay).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string into a user-friendly display string.
 * Examples:
 * - '1945-06-14' -> '14 Jun 1945'
 * - '1945-06'    -> 'Jun 1945'
 * - '1945'       -> '1945'
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const { year, month, day } = parseDateParts(dateStr);
  if (!year) return dateStr.trim();

  const mIndex = parseInt(month, 10) - 1;
  const monthName = mIndex >= 0 && mIndex < 12 ? MONTH_NAMES_SHORT[mIndex] : '';

  if (monthName && day) {
    const dNum = parseInt(day, 10);
    return `${dNum} ${monthName} ${year}`;
  }

  if (monthName) {
    return `${monthName} ${year}`;
  }

  return year;
}

/**
 * Calculates a person's age.
 * - If referenceDateOrDeathDate is provided (as a string or Date), calculates age at that date.
 * - If omitted or null, calculates current age relative to today.
 * Returns null if birthDate is invalid or year is missing, or if birth is after reference date.
 */
export function calculateAge(
  birthDate?: string | null,
  referenceDateOrDeathDate?: string | null | Date
): number | null {
  if (!birthDate || typeof birthDate !== 'string') return null;

  const bParts = parseDateParts(birthDate);
  if (!bParts.year) return null;

  const bYear = parseInt(bParts.year, 10);
  if (Number.isNaN(bYear) || bYear <= 0) return null;

  const bMonth = bParts.month ? parseInt(bParts.month, 10) : null;
  const bDay = bParts.day ? parseInt(bParts.day, 10) : null;

  let refYear: number;
  let refMonth: number | null = null;
  let refDay: number | null = null;

  if (referenceDateOrDeathDate instanceof Date) {
    refYear = referenceDateOrDeathDate.getFullYear();
    refMonth = referenceDateOrDeathDate.getMonth() + 1;
    refDay = referenceDateOrDeathDate.getDate();
  } else if (typeof referenceDateOrDeathDate === 'string' && referenceDateOrDeathDate.trim()) {
    const dParts = parseDateParts(referenceDateOrDeathDate);
    if (!dParts.year) return null;
    refYear = parseInt(dParts.year, 10);
    if (Number.isNaN(refYear) || refYear <= 0) return null;
    refMonth = dParts.month ? parseInt(dParts.month, 10) : null;
    refDay = dParts.day ? parseInt(dParts.day, 10) : null;
  } else {
    const now = new Date();
    refYear = now.getFullYear();
    refMonth = now.getMonth() + 1;
    refDay = now.getDate();
  }

  let age = refYear - bYear;

  // If both have month information, adjust for birthday not yet reached
  if (refMonth !== null && bMonth !== null) {
    if (refMonth < bMonth) {
      age--;
    } else if (refMonth === bMonth && refDay !== null && bDay !== null) {
      if (refDay < bDay) {
        age--;
      }
    }
  }

  if (age < 0) return null;

  return age;
}
