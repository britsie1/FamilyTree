import React, { useState } from 'react';
import {
  parseDateParts,
  buildDateString,
  MONTH_OPTIONS,
  getDaysInMonth,
} from '../../services/dateUtils';

export interface DatePartsInputProps {
  value?: string | null;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  yearPlaceholder?: string;
}

export const DatePartsInput: React.FC<DatePartsInputProps> = ({
  value,
  onChange,
  disabled = false,
  label,
  icon,
  className = '',
  yearPlaceholder = 'Year (YYYY)',
}) => {
  const [prevValue, setPrevValue] = useState(value);
  const [year, setYear] = useState(() => parseDateParts(value).year);
  const [month, setMonth] = useState(() => parseDateParts(value).month);
  const [day, setDay] = useState(() => parseDateParts(value).day);

  if (value !== prevValue) {
    setPrevValue(value);
    const parsed = parseDateParts(value);
    setYear(parsed.year);
    setMonth(parsed.month);
    setDay(parsed.day);
  }

  const commitDate = (newYear: string, newMonth: string, newDay: string) => {
    if (!newYear) {
      onChange(undefined);
      return;
    }
    const num = parseInt(newYear, 10);
    if (Number.isNaN(num) || num === 0) {
      onChange(undefined);
      return;
    }
    const built = buildDateString({ year: newYear, month: newMonth, day: newDay });
    onChange(built);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(raw);
    if (!raw) {
      commitDate('', month, day);
    } else if (raw.length === 4) {
      commitDate(raw, month, day);
    }
  };

  const handleYearBlur = () => {
    if (!year) {
      commitDate('', month, day);
      return;
    }
    const num = parseInt(year, 10);
    if (Number.isNaN(num) || num === 0) {
      setYear('');
      commitDate('', month, day);
      return;
    }
    if (year.length < 4) {
      const padded = year.padStart(4, '0');
      setYear(padded);
      commitDate(padded, month, day);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    setMonth(newMonth);
    if (year && year.length === 4) {
      commitDate(year, newMonth, day);
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDay(raw);
    if (year && year.length === 4) {
      commitDate(year, month, raw);
    }
  };

  const maxDays = getDaysInMonth(year, month);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </label>
      )}

      <div className="grid grid-cols-12 gap-1.5">
        {/* Year Input */}
        <div className="col-span-5">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={yearPlaceholder}
            value={year}
            onChange={handleYearChange}
            onBlur={handleYearBlur}
            disabled={disabled}
            maxLength={4}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 font-mono"
            title="4-digit Year (e.g. 1945)"
          />
        </div>

        {/* Month Dropdown */}
        <div className="col-span-4">
          <select
            value={month}
            onChange={handleMonthChange}
            disabled={disabled}
            className="w-full px-1.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 cursor-pointer truncate"
            title="Month (Optional)"
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Day Input */}
        <div className="col-span-3">
          <input
            type="number"
            min={1}
            max={maxDays}
            placeholder="Day"
            value={day}
            onChange={handleDayChange}
            disabled={disabled}
            className="w-full px-1.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 font-mono text-center"
            title={`Day 1-${maxDays} (Optional)`}
          />
        </div>
      </div>
    </div>
  );
};
