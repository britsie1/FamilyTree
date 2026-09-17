import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateParts,
  buildDateString,
  formatDisplayDate,
  getDaysInMonth,
  calculateAge,
} from '../src/services/dateUtils';

describe('Date Utilities', () => {
  describe('parseDateParts', () => {
    test('parses full ISO date (YYYY-MM-DD)', () => {
      const parts = parseDateParts('1945-06-14');
      assert.deepEqual(parts, { year: '1945', month: '06', day: '14' });
    });

    test('parses single-digit month and day with padding', () => {
      const parts = parseDateParts('1982-1-9');
      assert.deepEqual(parts, { year: '1982', month: '01', day: '09' });
    });

    test('parses year and month (YYYY-MM)', () => {
      const parts = parseDateParts('1968-09');
      assert.deepEqual(parts, { year: '1968', month: '09', day: '' });
    });

    test('parses year-only (YYYY)', () => {
      const parts = parseDateParts('1920');
      assert.deepEqual(parts, { year: '1920', month: '', day: '' });
    });

    test('parses dates with surrounding whitespace', () => {
      const parts = parseDateParts('  1975-12-08  ');
      assert.deepEqual(parts, { year: '1975', month: '12', day: '08' });
    });

    test('handles empty or null inputs', () => {
      assert.deepEqual(parseDateParts(undefined), { year: '', month: '', day: '' });
      assert.deepEqual(parseDateParts(null), { year: '', month: '', day: '' });
      assert.deepEqual(parseDateParts(''), { year: '', month: '', day: '' });
      assert.deepEqual(parseDateParts('   '), { year: '', month: '', day: '' });
    });

    test('treats "0000" and "0" as empty parts', () => {
      assert.deepEqual(parseDateParts('0000'), { year: '', month: '', day: '' });
      assert.deepEqual(parseDateParts('0'), { year: '', month: '', day: '' });
    });

    test('falls back to 4-digit year if embedded in text', () => {
      const parts = parseDateParts('circa 1890');
      assert.deepEqual(parts, { year: '1890', month: '', day: '' });
    });
  });

  describe('buildDateString', () => {
    test('builds year-only when only year is given', () => {
      const result = buildDateString({ year: '1945' });
      assert.equal(result, '1945');
    });

    test('builds year-only with numeric year', () => {
      const result = buildDateString({ year: 1945 });
      assert.equal(result, '1945');
    });

    test('builds year and month when day is omitted', () => {
      const result = buildDateString({ year: '1945', month: '6' });
      assert.equal(result, '1945-06');
    });

    test('builds full date when all parts provided', () => {
      const result = buildDateString({ year: '1945', month: '06', day: '14' });
      assert.equal(result, '1945-06-14');
    });

    test('clamps day to days in month (e.g. Feb 31 -> Feb 28 in non-leap year)', () => {
      const result = buildDateString({ year: '2023', month: '02', day: '31' });
      assert.equal(result, '2023-02-28');
    });

    test('clamps day to 29 in leap year (Feb 2024)', () => {
      const result = buildDateString({ year: '2024', month: '02', day: '31' });
      assert.equal(result, '2024-02-29');
    });

    test('clamps day to 30 for April', () => {
      const result = buildDateString({ year: '2024', month: '04', day: '31' });
      assert.equal(result, '2024-04-30');
    });

    test('returns undefined when year is missing or empty', () => {
      assert.equal(buildDateString({ year: '', month: '05', day: '12' }), undefined);
      assert.equal(buildDateString({ year: null }), undefined);
      assert.equal(buildDateString({ year: undefined }), undefined);
    });

    test('returns undefined when year is 0 or "0000"', () => {
      assert.equal(buildDateString({ year: '0' }), undefined);
      assert.equal(buildDateString({ year: '0000' }), undefined);
      assert.equal(buildDateString({ year: 0 }), undefined);
    });
  });

  describe('formatDisplayDate', () => {
    test('formats full date to "DD Mon YYYY"', () => {
      assert.equal(formatDisplayDate('1945-06-14'), '14 Jun 1945');
      assert.equal(formatDisplayDate('1982-01-09'), '9 Jan 1982');
    });

    test('formats year and month to "Mon YYYY"', () => {
      assert.equal(formatDisplayDate('1968-09'), 'Sep 1968');
    });

    test('formats year-only to "YYYY"', () => {
      assert.equal(formatDisplayDate('1920'), '1920');
    });

    test('handles empty inputs', () => {
      assert.equal(formatDisplayDate(''), '');
      assert.equal(formatDisplayDate(null), '');
      assert.equal(formatDisplayDate(undefined), '');
    });
  });

  describe('calculateAge', () => {
    test('calculates age at death for full dates', () => {
      // Died day before 30th birthday -> 29
      assert.equal(calculateAge('1990-05-15', '2020-05-14'), 29);
      // Died on 30th birthday -> 30
      assert.equal(calculateAge('1990-05-15', '2020-05-15'), 30);
      // Died day after 30th birthday -> 30
      assert.equal(calculateAge('1990-05-15', '2020-05-16'), 30);
    });

    test('calculates age at death for year-only dates', () => {
      assert.equal(calculateAge('1920', '1995'), 75);
    });

    test('calculates age at death for year-month dates', () => {
      assert.equal(calculateAge('1960-03', '2020-02'), 59);
      assert.equal(calculateAge('1960-03', '2020-04'), 60);
    });

    test('calculates current age relative to a Date object', () => {
      const refDate = new Date(2026, 8, 17); // 17 Sept 2026 (month is 0-indexed: 8 = Sep)
      assert.equal(calculateAge('1990-09-16', refDate), 36);
      assert.equal(calculateAge('1990-09-17', refDate), 36);
      assert.equal(calculateAge('1990-09-18', refDate), 35);
      assert.equal(calculateAge('1990', refDate), 36);
    });

    test('returns null for missing, invalid, or future birth dates', () => {
      assert.equal(calculateAge(undefined), null);
      assert.equal(calculateAge(null), null);
      assert.equal(calculateAge(''), null);
      assert.equal(calculateAge('invalid-date'), null);
      // Future birth date
      assert.equal(calculateAge('2050', '2026'), null);
    });
  });

  describe('getDaysInMonth', () => {
    test('returns 31 for January and March', () => {
      assert.equal(getDaysInMonth(2024, 1), 31);
      assert.equal(getDaysInMonth(2024, 3), 31);
    });

    test('returns 30 for April and June', () => {
      assert.equal(getDaysInMonth(2024, 4), 30);
      assert.equal(getDaysInMonth(2024, 6), 30);
    });

    test('returns 29 for February in leap year', () => {
      assert.equal(getDaysInMonth(2024, 2), 29);
      assert.equal(getDaysInMonth(2000, 2), 29);
    });

    test('returns 28 for February in non-leap year', () => {
      assert.equal(getDaysInMonth(2023, 2), 28);
      assert.equal(getDaysInMonth(1900, 2), 28);
    });
  });
});
