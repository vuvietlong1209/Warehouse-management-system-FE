'use client';

import { FilterSelect } from '@/components/filter-select';
import { type FormEvent, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { ShortDateField } from '@/components/short-date-field';

export type DocumentFilterValues = {
  search: string;
  fromDate: string;
  toDate: string;
  warehouseId: string;
  partnerId: string;
  status: string;
};

export const emptyDocumentFilters: DocumentFilterValues = {
  search: '',
  fromDate: '',
  toDate: '',
  warehouseId: '',
  partnerId: '',
  status: '',
};

type Option = { id: number; name: string };
type StatusOption = { value: string; label: string };

export function matchesDocumentSearch(search: string, ...values: Array<string | undefined>) {
  const normalize = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  const query = normalize(search.trim());
  return !query || values.some(value => normalize(value || '').includes(query));
}

export function DocumentFilters({
  idPrefix,
  filters,
  onApply,
  warehouses,
  warehouseLabel,
  partners,
  partnerLabel,
  searchPlaceholder = 'Mã phiếu, kho hoặc đối tác...',
  statusLabel = 'Trạng thái phiếu',
  statuses,
}: {
  idPrefix: string;
  filters: DocumentFilterValues;
  onApply: (filters: DocumentFilterValues) => void;
  warehouses: Option[];
  warehouseLabel: string;
  partners?: Option[];
  partnerLabel?: string;
  searchPlaceholder?: string;
  statusLabel?: string;
  statuses: StatusOption[];
}) {
  const [draft, setDraft] = useState<DocumentFilterValues>(filters);
  const [dateError, setDateError] = useState('');
  const [dateResetKey, setDateResetKey] = useState(0);

  const update = (field: keyof DocumentFilterValues, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    if (field === 'fromDate' || field === 'toDate') setDateError('');
  };

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
      setDateError('Từ ngày không được sau đến ngày.');
      return;
    }
    setDateError('');
    onApply({ ...draft, search: draft.search.trim() });
  };

  const reset = () => {
    const cleared = { ...emptyDocumentFilters };
    setDraft(cleared);
    setDateError('');
    setDateResetKey(value => value + 1);
    onApply(cleared);
  };

  return (
    <form onSubmit={apply} className="rounded-md border border-slate-200 bg-white p-3 shadow-card" aria-label="Bộ lọc chứng từ">
      <div className="grid grid-cols-12 gap-2.5">
        <div className="col-span-12 md:col-span-6">
          <label htmlFor={`${idPrefix}-search`} className="form-label">Tìm kiếm</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input id={`${idPrefix}-search`} type="search" className="form-control pl-9" placeholder={searchPlaceholder} value={draft.search} onChange={event => update('search', event.target.value)} />
          </div>
        </div>
        <div className="col-span-6 md:col-span-3">
          <span className="form-label">Từ ngày</span>
          <ShortDateField label="Từ ngày" value={draft.fromDate} max={draft.toDate || undefined} resetKey={dateResetKey} onChange={value => update('fromDate', value)} />
        </div>
        <div className="col-span-6 md:col-span-3">
          <span className="form-label">Đến ngày</span>
          <ShortDateField label="Đến ngày" value={draft.toDate} min={draft.fromDate || undefined} resetKey={dateResetKey} onChange={value => update('toDate', value)} />
        </div>
        <div className="col-span-12 md:col-span-3">
          <label htmlFor={`${idPrefix}-warehouse`} className="form-label">{warehouseLabel}</label>
          <FilterSelect label="Kho hàng" id={`${idPrefix}-warehouse`} className="form-control" value={draft.warehouseId} onChange={event => update('warehouseId', event)}>
            <option value="">Tất cả kho</option>
            {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </FilterSelect>
        </div>
        {partners ? (
          <div className="col-span-12 md:col-span-3">
            <label htmlFor={`${idPrefix}-partner`} className="form-label">{partnerLabel}</label>
            <FilterSelect label="Đối tác" id={`${idPrefix}-partner`} className="form-control" value={draft.partnerId} onChange={event => update('partnerId', event)}>
              <option value="">Tất cả {partnerLabel?.toLowerCase() || 'đối tác'}</option>
              {partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
            </FilterSelect>
          </div>
        ) : null}
        <div className="col-span-12 md:col-span-3">
          <label htmlFor={`${idPrefix}-status`} className="form-label">{statusLabel}</label>
          <FilterSelect label={statusLabel} id={`${idPrefix}-status`} className="form-control" value={draft.status} onChange={event => update('status', event)}>
            <option value="">Tất cả trạng thái</option>
            {statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
          </FilterSelect>
        </div>
        <div className={partners ? 'col-span-12 flex items-end justify-end gap-2 md:col-span-3' : 'col-span-12 flex items-end justify-end gap-2 md:col-span-6'}>
          <button type="button" onClick={reset} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="size-3.5" /> Đặt lại</button>
          <button type="submit" className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700"><Search className="size-3.5" /> Tìm kiếm</button>
        </div>
        {dateError ? <p className="col-span-12 text-xs text-rose-600" role="alert">{dateError}</p> : null}
      </div>
    </form>
  );
}
