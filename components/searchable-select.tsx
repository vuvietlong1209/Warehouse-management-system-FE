'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/components/ui';

export type SearchableSelectOption = {
  value: string | number;
  label: string;
  searchText?: string;
};

type SearchableSelectProps = {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  searchPlaceholder?: string;
};

const normalize = (text: string) => text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');

export function SearchableSelect({
  id, label, value, onChange, options, required, disabled, className, wrapperClassName,
  searchPlaceholder = 'Tìm theo mã hoặc tên...',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ top: 0, left: 0, width: 320, maxHeight: 320 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find(option => String(option.value) === String(value));
  const listId = `${id}-options`;
  const filtered = useMemo(() => {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    return options.filter(option => {
      const text = normalize(`${option.label} ${option.searchText || ''}`);
      return terms.every(term => text.includes(term));
    });
  }, [options, query]);

  const showMenu = (initialQuery = '') => {
    if (disabled) return;
    setQuery(initialQuery);
    setActiveIndex(initialQuery ? 0 : Math.max(0, options.findIndex(option => String(option.value) === String(value))));
    setOpen(true);
  };

  const choose = (option: SearchableSelectOption) => {
    onChange(String(option.value));
    setInvalid(false);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const placeAbove = below < 220 && above > below;
      const maxHeight = Math.max(80, Math.min(320, placeAbove ? above : below));
      setPosition({
        ...(placeAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight,
      });
    };
    updatePosition();
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: Event) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    const list = menuRef.current?.querySelector<HTMLElement>('[role="listbox"]');
    const option = list?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex];
    if (!list || !option) return;
    const offset = option.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (offset < 0) list.scrollTop += offset;
    else if (offset + option.offsetHeight > list.clientHeight) list.scrollTop += offset + option.offsetHeight - list.clientHeight;
  }, [activeIndex, id, open, query]);

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[activeIndex]) choose(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    } else if (event.key === 'Tab') {
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
  };

  return (
    <div ref={rootRef} className={cn('relative min-w-0', wrapperClassName)}>
      <select
        value={selected ? String(value) : ''}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none"
        onChange={event => onChange(event.target.value)}
        onInvalid={event => {
          event.preventDefault();
          setInvalid(true);
          if (event.currentTarget.form?.querySelector(':invalid') === event.currentTarget) {
            triggerRef.current?.focus();
            showMenu();
          }
        }}
      >
        <option value="">Chọn {label.toLocaleLowerCase('vi')}...</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-required={required}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        title={selected?.label}
        className={cn('form-control flex items-center justify-between gap-2 text-left', invalid && '!border-rose-400', className)}
        onClick={() => open ? setOpen(false) : showMenu()}
        onKeyDown={event => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            showMenu();
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            showMenu(event.key);
          }
        }}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-slate-400')}>{selected?.label || `Chọn ${label.toLocaleLowerCase('vi')}...`}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-slate-500" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] flex flex-col overflow-hidden rounded-md border border-slate-300 bg-white font-sans text-xs text-slate-800 shadow-xl print:hidden"
          style={position}
        >
          <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-2">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                role="combobox"
                aria-label={`Tìm ${label.toLocaleLowerCase('vi')}`}
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={filtered[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
                autoComplete="off"
                value={query}
                onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
                onKeyDown={handleSearchKey}
                placeholder={searchPlaceholder}
                className="form-control !min-h-8 !pl-8 !text-xs"
              />
            </div>
          </div>
          <div id={listId} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto overscroll-contain p-1">
            {filtered.length ? filtered.map((option, index) => (
              <button
                key={option.value}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={String(option.value) === String(value)}
                onPointerDown={event => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn('flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left leading-5', index === activeIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50')}
              >
                <span className="min-w-0 break-words">{option.label}</span>
                {String(option.value) === String(value) && <Check aria-hidden="true" className="size-3.5 shrink-0 text-blue-600" />}
              </button>
            )) : <p role="status" className="px-3 py-5 text-center text-slate-500">Không tìm thấy kết quả</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
