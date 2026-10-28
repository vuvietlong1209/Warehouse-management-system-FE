'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Inbox, LoaderCircle, Search } from 'lucide-react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function RequiredMark() {
  return <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>;
}

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700 hover:border-brand-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs',
  success: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 shadow-sm',
  danger: 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 hover:border-rose-700 shadow-sm',
  ghost: 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold leading-5 transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-9 px-3 text-[13px]',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
});

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: 'default' | 'primary' | 'danger';
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, tone = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors',
        tone === 'danger'
          ? 'text-slate-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600'
          : tone === 'primary'
            ? 'text-slate-500 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-700'
            : 'text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900',
        className,
      )}
      {...props}
    />
  );
});

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <h1 className="page-title min-w-0">{title}</h1>
      {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  return <span className={cn('status-badge', `status-badge-${tone}`)}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon || <Inbox className="size-5" />}</div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p> : null}
    </div>
  );
}

export function CatalogToolbar({
  search,
  onSearchChange,
  placeholder,
  shown,
  total,
  noun,
  filters,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  shown: number;
  total: number;
  noun: string;
  filters?: React.ReactNode;
}) {
  return (
    <div className="catalog-toolbar">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="form-control pl-9"
          />
        </div>
        {filters}
      </div>
      <p className="shrink-0 text-xs font-medium text-slate-500" aria-live="polite">
        Hiển thị <span className="font-bold text-slate-900">{shown}</span> / {total} {noun}
      </p>
    </div>
  );
}

export function CatalogTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const scroll = scrollRef.current;
    const page = container?.closest('.catalog-page');
    const table = scroll?.querySelector('table');

    if (!container || !scroll || !table || !page || page.classList.contains('document-list-page')) return;

    let frame = 0;

    const fitWholeRows = () => {
      window.cancelAnimationFrame(frame);
      container.style.removeProperty('height');
      container.style.removeProperty('flex-basis');

      frame = window.requestAnimationFrame(() => {
        const pagination = page.querySelector<HTMLElement>(':scope > .catalog-pagination');
        const header = table.tHead;
        const rows = Array.from(table.tBodies[0]?.rows || []);
        if (!pagination || !header || rows.length === 0) return;

        const pageStyle = window.getComputedStyle(page);
        const gap = Number.parseFloat(pageStyle.rowGap || pageStyle.gap) || 0;
        const availableHeight = pagination.getBoundingClientRect().top
          - gap
          - container.getBoundingClientRect().top;
        const containerRect = container.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        const borderHeight = Math.max(0, containerRect.height - scrollRect.height);
        const hasHorizontalScrollbar = scroll.scrollWidth > scroll.clientWidth + 1;
        const horizontalScrollbarHeight = hasHorizontalScrollbar
          ? Math.max(0, scrollRect.height - scroll.clientHeight)
          : 0;
        const tableContentHeight = table.getBoundingClientRect().height;
        const tableHeight = tableContentHeight + borderHeight + horizontalScrollbarHeight;

        if (tableHeight <= availableHeight + 0.5) {
          container.style.height = `${tableHeight}px`;
          container.style.flexBasis = 'auto';
          return;
        }

        const usableHeight = Math.max(
          0,
          availableHeight - borderHeight - horizontalScrollbarHeight,
        );
        let fittedHeight = header.getBoundingClientRect().height;
        let fittedRows = 0;

        for (const row of rows) {
          const rowHeight = row.getBoundingClientRect().height;
          if (fittedRows > 0 && fittedHeight + rowHeight > usableHeight + 0.5) break;
          fittedHeight += rowHeight;
          fittedRows += 1;
        }

        const snappedHeight = Math.min(
          availableHeight,
          fittedHeight + borderHeight + horizontalScrollbarHeight,
        );
        container.style.height = `${snappedHeight}px`;
        container.style.flexBasis = `${snappedHeight}px`;
      });
    };

    fitWholeRows();
    window.addEventListener('resize', fitWholeRows);
    const tableObserver = new ResizeObserver(fitWholeRows);
    tableObserver.observe(table);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', fitWholeRows);
      tableObserver.disconnect();
      container.style.removeProperty('height');
      container.style.removeProperty('flex-basis');
    };
  }, [children]);

  return (
    <div ref={containerRef} className="table-container">
      <div ref={scrollRef} tabIndex={0} aria-label="Danh sách danh mục" className="data-scroll catalog-table-scroll">
        <table className={cn('catalog-table w-full table-auto border-collapse text-left', className)}>{children}</table>
      </div>
    </div>
  );
}

/** A single keyboard-accessible viewport that ends at a complete table row. */
export function WholeRowViewport({ children, className = '', label = 'Danh sách dữ liệu', fillPage = false }: {
  children: React.ReactNode; className?: string; label?: string; fillPage?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const element = ref.current;
    const table = element?.querySelector('table');
    if (!element || !table) return;
    element.style.scrollPaddingTop = `${table.tHead?.getBoundingClientRect().height || 0}px`;
    let frame = 0;
    const fit = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const previousTop = element.scrollTop;
        const atEnd = previousTop > 0 && previousTop + element.clientHeight >= element.scrollHeight - 1;
        // Measure and restore within one frame so no intermediate layout is painted.
        element.style.removeProperty('height');
        element.style.removeProperty('flex');
        table.style.removeProperty('--whole-row-height');
        const css = window.getComputedStyle(element);
        const padding = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
        const border = (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.borderBottomWidth) || 0);
        let outerLimit = element.getBoundingClientRect().height;
        // clientHeight is integer-rounded; subpixel layout is not a scrollbar.
        const bar = Math.max(0, Math.round(element.getBoundingClientRect().height - border) - element.clientHeight);
        if (fillPage) {
          const page = element.closest<HTMLElement>('.managed-documents');
          const pager = page?.querySelector<HTMLElement>(':scope > .catalog-pagination');
          const card = element.parentElement;
          if (page && pager && card) {
            const gap = parseFloat(window.getComputedStyle(page).rowGap) || 0;
            const cardCss = window.getComputedStyle(card);
            let tail = (parseFloat(cardCss.paddingBottom) || 0) + (parseFloat(cardCss.borderBottomWidth) || 0);
            for (let sibling = element.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
              const siblingCss = window.getComputedStyle(sibling);
              tail += sibling.getBoundingClientRect().height + (parseFloat(siblingCss.marginTop) || 0) + (parseFloat(siblingCss.marginBottom) || 0);
            }
            // Include the unused page space above pagination before fitting complete rows.
            outerLimit = Math.max(0, pager.getBoundingClientRect().top - gap - element.getBoundingClientRect().top - tail);
          }
        }
        const available = fillPage ? outerLimit - padding - border - bar : element.clientHeight - padding;
        if (table.getBoundingClientRect().height <= available + 0.5) return;
        const rows = Array.from(table.tBodies[0]?.rows || []);
        const footerRows = Array.from(table.tFoot?.rows || []);
        const rowHeight = Math.max(0, ...[...rows, ...footerRows].map(row => row.getBoundingClientRect().height));
        // Equal row heights keep both viewport edges complete after scroll snapping.
        table.style.setProperty('--whole-row-height', `${rowHeight}px`);
        let height = table.tHead?.getBoundingClientRect().height || 0;
        let fittedRows = 0;
        for (const _row of rows) {
          if (height + rowHeight > available + 0.5) break;
          height += rowHeight;
          fittedRows++;
        }
        if (!fittedRows) return;
        element.style.height = `${height + padding + border + bar}px`;
        element.style.flex = element.parentElement && window.getComputedStyle(element.parentElement).flexDirection === 'row'
          ? '1 1 0' : '0 0 auto';
        // A vertical scrollbar can introduce a horizontal scrollbar after sizing.
        // Re-measure its space instead of letting it cover the final row.
        const shortage = Math.round(height + padding) - element.clientHeight;
        if (shortage > 0) {
          const corrected = height + padding + border + bar + shortage;
          element.style.height = `${corrected <= outerLimit + 0.5 ? corrected : corrected - rowHeight}px`;
        }
        element.style.scrollPaddingTop = `${table.tHead?.getBoundingClientRect().height || 0}px`;
        // A resized viewport can retain the old bottom offset between snap points.
        element.scrollTop = atEnd
          ? Math.max(0, element.scrollHeight - element.clientHeight)
          : Math.round(previousTop / rowHeight) * rowHeight;
      });
    };
    fit();
    window.addEventListener('resize', fit);
    const observer = new ResizeObserver(fit);
    observer.observe(table);
    const container = element.closest?.('.paged-data-page, .proposal-dialog, .document-list-page');
    if (container) observer.observe(container);
    const products = element.closest?.('.initial-products-section');
    if (products && products !== container) observer.observe(products);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
      observer.disconnect();
      table.style.removeProperty('--whole-row-height');
    };
    // Selection changes do not change the geometry. ResizeObserver handles data
    // and wrapping changes without tearing down the viewport on every checkbox.
  }, [className, fillPage]);
  return <div ref={ref} tabIndex={0} aria-label={label} className={cn('data-scroll whole-row-viewport', className)}>{children}</div>;
}

export function CatalogLoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-44 text-center text-slate-500">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải dữ liệu...
        </span>
      </td>
    </tr>
  );
}

export function CatalogPagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <div className="catalog-pagination">
      <div className="flex items-center gap-4">
        <span>Trang <strong className="text-slate-700">{safePage}</strong> / {safeTotalPages}</span>
        <label className="flex items-center gap-2 whitespace-nowrap">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            disabled={disabled}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            aria-label="Số bản ghi trên mỗi trang"
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          >
            {[5, 10, 20, 25, 50].map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <span>bản ghi / trang</span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="size-4" />
          Trang trước
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Trang sau
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function formatDateVN(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
