'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

// Always-English month/weekday labels — independent of the user's browser locale.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromIso(s: string): Date | null {
  if (!s) return null;
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(s: string): string {
  const d = fromIso(s);
  if (!d) return '';
  return `${MONTHS[d.getMonth()]!.slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

export interface DatePickerProps {
  value: string;                     // YYYY-MM-DD or ''
  onChange: (value: string) => void; // emits YYYY-MM-DD or ''
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Pick date', className = '', ariaLabel }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => fromIso(value), [value]);
  // Calendar month being viewed (independent of selected so users can browse).
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const d = selected ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // When opening, snap the view to the selected date (or today).
  useEffect(() => {
    if (open) {
      const d = selected ?? new Date();
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [open, selected]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Build the 6-week grid for the current view.
  const grid = useMemo(() => {
    const firstOfMonth = new Date(view.year, view.month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=Sun
    const start = new Date(view.year, view.month, 1 - startWeekday);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return cells;
  }, [view]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  function selectDay(d: Date) {
    onChange(toIso(d));
    setOpen(false);
  }

  const todayIso = toIso(new Date());

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel ?? placeholder}
        className="bg-white border border-gray-200 text-gray-900 placeholder-gray-400 dark:bg-slate-900 dark:border-slate-700 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 w-44 text-left flex items-center justify-between gap-2"
      >
        <span className={value ? '' : 'text-gray-400 dark:text-slate-500'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3">
          {/* Month/year header with nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
            >‹</button>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
            >›</button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] text-gray-500 dark:text-slate-500 mb-1">
            {WEEKDAYS.map((w) => (<span key={w}>{w}</span>))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
            {grid.map((d) => {
              const iso = toIso(d);
              const inMonth = d.getMonth() === view.month;
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDay(d)}
                  className={[
                    'h-7 w-7 mx-auto rounded transition-colors tabular-nums',
                    isSelected
                      ? 'bg-cyan-600 text-white font-semibold'
                      : inMonth
                        ? 'text-gray-800 dark:text-slate-200 hover:bg-cyan-100 dark:hover:bg-slate-800'
                        : 'text-gray-300 dark:text-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800',
                    isToday && !isSelected ? 'ring-1 ring-cyan-500/60' : '',
                  ].join(' ')}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => { onChange(todayIso); setOpen(false); }}
              className="text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
