'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';

type ShortDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  required?: boolean;
  className?: string;
  resetKey?: number;
};

function formatInputDate(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

// Parse explicitly, never with Date.parse (locale-dependent) or a Date
// constructor that silently rolls 31/02 into March. Two-digit years are 20xx.
export function parseDateInput(value: string): string | null {
  const text = value.trim();
  if (!text) return '';
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text)
    || /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function ShortDateField({ label, value, onChange, min, max, id, name, required, className = '', resetKey = 0 }: ShortDateFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const publishedValue = useRef(value);
  const lastReset = useRef(resetKey);
  const generatedId = useId();
  const controlId = id || `date-${generatedId}`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const displayValue = draft ?? formatInputDate(value);
  const hint = 'Nhập DD/MM/YYYY, DD/MM/YY, DDMMYY hoặc DDMMYYYY. Năm hai chữ số được hiểu là 2000–2099. Alt + mũi tên xuống để mở lịch.';

  const validationMessage = (text: string) => {
    const iso = parseDateInput(text);
    if (iso === null) return 'Ngày không hợp lệ. Ví dụ: 15/09/2026 hoặc 150926.';
    if (!iso) return required ? `Vui lòng nhập ${label.toLowerCase()}.` : '';
    if (min && iso < min) return `Ngày phải từ ${formatInputDate(min)} trở đi.`;
    if (max && iso > max) return `Ngày không được sau ${formatInputDate(max)}.`;
    return '';
  };
  const showError = (message: string) => {
    setError(message);
    inputRef.current?.setCustomValidity(message);
  };
  const publish = (iso: string) => {
    publishedValue.current = iso;
    if (iso !== value) onChange(iso);
  };

  // A parent reset, switching documents, or selecting dates elsewhere must
  // replace the draft. Our own publication keeps an invalid draft visible.
  useEffect(() => {
    if (value !== publishedValue.current || resetKey !== lastReset.current) {
      setDraft(null);
      setError('');
      inputRef.current?.setCustomValidity('');
    }
    publishedValue.current = value;
    lastReset.current = resetKey;
  }, [value, resetKey]);

  useEffect(() => {
    // Revalidate a committed end date when its start-date bound changes.
    // Do not report an untouched empty required field before interaction.
    if (draft === null && value) {
      const message = validationMessage(formatInputDate(value));
      setError(message);
      inputRef.current?.setCustomValidity(message);
    }
  // The draft is deliberately excluded: typing must not trigger validation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max, required, label, resetKey]);

  const commit = () => {
    const message = validationMessage(displayValue);
    showError(message);
    if (message) {
      // Do not let non-form filter/report actions silently reuse an old date.
      publish('');
      inputRef.current?.reportValidity();
      return;
    }
    const iso = parseDateInput(displayValue)!;
    setDraft(null);
    publish(iso);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    const iso = parseDateInput(displayValue);
    if (iso !== null && !validationMessage(displayValue)) {
      setDraft(null);
      showError('');
      publish(iso);
      // showPicker reads the DOM synchronously, before React commits the new
      // controlled value. Open on the valid date the user has just typed.
      picker.value = iso;
    }
    try {
      if (typeof picker.showPicker === 'function') picker.showPicker();
      else { picker.focus({ preventScroll: true }); picker.click(); }
    } catch {
      // Text entry remains usable if the browser does not allow showPicker.
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  return (
    <div className="relative min-w-0">
      <input
        ref={inputRef}
        id={controlId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        value={displayValue}
        required={required}
        aria-label={label}
        aria-keyshortcuts="Alt+ArrowDown"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${controlId}-hint`}
        title={error || hint}
        className={`form-control min-w-0 pr-10 font-medium text-slate-800 placeholder:text-slate-600 ${error ? 'border-rose-500' : ''} ${className}`}
        onChange={event => { setDraft(event.target.value); showError(''); }}
        onBlur={event => { if (event.relatedTarget !== pickerRef.current) commit(); }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); }
          if (event.key === 'Escape') { setDraft(null); showError(''); }
          if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); openPicker(); }
        }}
        onInvalid={() => showError(validationMessage(displayValue))}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Chọn ${label.toLowerCase()} từ lịch`}
        onMouseDown={event => event.preventDefault()}
        onClick={openPicker}
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        name={name}
        value={value}
        min={min}
        max={max}
        onChange={event => {
          const iso = event.target.value;
          const message = validationMessage(formatInputDate(iso));
          showError(message);
          if (message && iso) return;
          setDraft(null);
          publish(iso);
          inputRef.current?.focus({ preventScroll: true });
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') event.preventDefault();
          if (event.key === 'Escape') inputRef.current?.focus({ preventScroll: true });
        }}
        className="pointer-events-none absolute right-3 top-1/2 size-px -translate-y-1/2 opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      />
      <span id={`${controlId}-hint`} className="sr-only" aria-live="polite">{error || hint}</span>
    </div>
  );
}
