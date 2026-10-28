'use client';

import { FilterSelect } from '@/components/filter-select';
import { ShortDateField } from '@/components/short-date-field';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, RotateCcw, Search, X, XCircle } from 'lucide-react';
import { formatDateVN, WholeRowViewport } from '@/components/ui';

export type BulkDocumentResult = {
  succeeded: number[];
  failed: { id: number; message: string; code?: string }[];
};

export type BulkDocumentRow = {
  id: number;
  code: string;
  date: string;
  warehouse: string;
  partner?: string;
  totalValue?: number;
};

export type BulkDocumentRejection = {
  id: number;
  reason: string;
};

export function DocumentBulkDialog({ title, rows, partnerLabel, approveLabel, rejectLabel, processing, result, onApprove, onReject, onView, onClose }: {
  title: string;
  rows: BulkDocumentRow[];
  partnerLabel?: string;
  approveLabel: string;
  rejectLabel: string;
  processing: boolean;
  result: BulkDocumentResult | null;
  onApprove: (ids: number[]) => void;
  onReject: (rejections: BulkDocumentRejection[]) => Promise<void> | void;
  onView: (id: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateResetKey, setDateResetKey] = useState(0);
  const [warehouse, setWarehouse] = useState('');
  const [partner, setPartner] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const warehouseOptions = useMemo(() => [...new Set(rows.map(row => row.warehouse).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [rows]);
  const partnerOptions = useMemo(() => [...new Set(rows.map(row => row.partner || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [rows]);
  const showTotalValue = useMemo(() => rows.some(row => row.totalValue !== undefined), [rows]);
  const partnerAllLabel = partnerLabel ? `Tất cả ${partnerLabel.toLocaleLowerCase('vi-VN')}` : '';
  const matchingRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi-VN');
    return rows.filter(row => {
      const documentDate = row.date.slice(0, 10);
      return (!query || [row.code, row.warehouse, row.partner || ''].some(value => value.toLocaleLowerCase('vi-VN').includes(query)))
        && (!fromDate || documentDate >= fromDate)
        && (!toDate || documentDate <= toDate)
        && (!warehouse || row.warehouse === warehouse)
        && (!partner || row.partner === partner);
    });
  }, [rows, search, fromDate, toDate, warehouse, partner]);
  const selectedRows = rows.filter(row => selectedIds.includes(row.id));
  const allMatchingSelected = matchingRows.length > 0 && matchingRows.every(row => selectedIds.includes(row.id));
  const codeById = new Map(rows.map(row => [row.id, row.code]));

  const toggle = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleMatching = () => {
    const ids = new Set(matchingRows.map(row => row.id));
    setSelectedIds(current => allMatchingSelected ? current.filter(id => !ids.has(id)) : [...new Set([...current, ...ids])]);
  };
  const openRejectDialog = () => {
    setRejectReasons(current => Object.fromEntries(selectedRows.map(row => [row.id, current[row.id] || ''])));
    setRejectDialogOpen(true);
  };
  const closeRejectDialog = () => {
    if (!processing && !rejectSubmitting) setRejectDialogOpen(false);
  };
  const submitRejections = async () => {
    const rejections = selectedRows.map(row => ({ id: row.id, reason: (rejectReasons[row.id] || '').trim() }));
    if (!rejections.length || rejections.some(entry => !entry.reason)) return;
    setRejectSubmitting(true);
    try {
      await onReject(rejections);
      setRejectDialogOpen(false);
    } finally {
      setRejectSubmitting(false);
    }
  };
  const rejectReasonsValid = selectedRows.length > 0 && selectedRows.every(row => Boolean(rejectReasons[row.id]?.trim()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs" onMouseDown={event => { if (event.target === event.currentTarget && !processing) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-document-title" className="ui-dialog flex max-h-[min(88dvh,780px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div>
            <h2 id="bulk-document-title" className="text-base font-bold">{title}</h2>
          </div>
          <button type="button" aria-label="Đóng danh sách chờ duyệt" disabled={processing} onClick={onClose} className="rounded-md p-1 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"><X className="size-5" /></button>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-5 py-3">
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-12">
            <label className="min-w-0 md:col-span-6">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Tìm kiếm</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Mã phiếu, kho hoặc đối tác..." aria-label="Tìm trong phiếu chờ xử lý" className="form-control pl-9" />
              </span>
            </label>
            <label className="min-w-0 md:col-span-3">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Từ ngày</span>
              <ShortDateField label="Từ ngày" value={fromDate} onChange={setFromDate} resetKey={dateResetKey} max={toDate || undefined} />
            </label>
            <label className="min-w-0 md:col-span-3">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Đến ngày</span>
              <ShortDateField label="Đến ngày" value={toDate} onChange={setToDate} resetKey={dateResetKey} min={fromDate || undefined} />
            </label>
            <label className={partnerLabel ? 'min-w-0 md:col-span-6' : 'min-w-0 md:col-span-12'}>
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Kho hàng</span>
              <FilterSelect label="Kho hàng" value={warehouse} title={warehouse || 'Tất cả kho hàng'} onChange={event => setWarehouse(event)} className="form-control"><option value="">Tất cả kho hàng</option>{warehouseOptions.map(value => <option key={value} value={value}>{value}</option>)}</FilterSelect>
            </label>
            {partnerLabel && <label className="min-w-0 md:col-span-6">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">{partnerLabel}</span>
              <FilterSelect label="Đối tác" value={partner} title={partner || partnerAllLabel} onChange={event => setPartner(event)} className="form-control"><option value="">{partnerAllLabel}</option>{partnerOptions.map(value => <option key={value} value={value}>{value}</option>)}</FilterSelect>
            </label>}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <button type="button" disabled={processing} onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setDateResetKey(value => value + 1); setWarehouse(''); setPartner(''); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 disabled:opacity-50"><RotateCcw className="size-3.5" />Đặt lại bộ lọc</button>
            <span className="text-xs font-medium text-slate-600">Hiển thị {matchingRows.length} / {rows.length} · Đã chọn {selectedRows.length} phiếu</span>
          </div>
        </div>

        <WholeRowViewport className="min-h-0 flex-1 px-4 py-3">
          <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="w-12 px-3 py-3 text-center"><input type="checkbox" aria-label="Chọn tất cả phiếu đang hiển thị" checked={allMatchingSelected} disabled={!matchingRows.length || processing} onChange={toggleMatching} className="size-4 accent-blue-600" /></th>
                <th className="px-3 py-3">Mã phiếu</th>
                <th className="px-3 py-3">Ngày chứng từ</th>
                <th className="px-3 py-3">Kho hàng</th>
                {partnerLabel && <th className="px-3 py-3">{partnerLabel}</th>}
                {showTotalValue && <th className="whitespace-nowrap px-3 py-3 text-right">Tổng giá trị</th>}
                <th className="w-20 px-3 py-3 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matchingRows.map(row => <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 text-center"><input type="checkbox" aria-label={`Chọn phiếu ${row.code}`} checked={selectedIds.includes(row.id)} disabled={processing} onChange={() => toggle(row.id)} className="size-4 accent-blue-600" /></td>
                <td className="px-3 py-3 font-semibold text-blue-700">{row.code}</td>
                <td className="date-cell px-3 py-3">{formatDateVN(row.date)}</td>
                <td className="px-3 py-3 text-slate-700">{row.warehouse}</td>
                {partnerLabel && <td className="px-3 py-3 text-slate-700">{row.partner || '—'}</td>}
                {showTotalValue && <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-800">{(row.totalValue || 0).toLocaleString('vi-VN')} ₫</td>}
                <td className="px-3 py-3 text-center"><button type="button" disabled={processing} onClick={() => onView(row.id)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"><Eye className="size-3.5" />Xem</button></td>
              </tr>)}
              {!matchingRows.length && <tr><td colSpan={(partnerLabel ? 6 : 5) + (showTotalValue ? 1 : 0)} className="px-3 py-10 text-center text-slate-500">{rows.length ? 'Không tìm thấy phiếu phù hợp.' : 'Hiện không có chứng từ chờ xử lý.'}</td></tr>}
            </tbody>
          </table>
        </WholeRowViewport>

        {result && <div role="status" className={`shrink-0 border-t border-slate-100 px-5 py-2 text-xs ${result.failed.length ? 'text-amber-800' : 'text-emerald-700'}`}>
          <p className="font-semibold">Thành công {result.succeeded.length}, thất bại {result.failed.length}.</p>
          {result.failed.length > 0 && <ul className="mt-1 max-h-20 list-disc overflow-y-auto pl-5">{result.failed.map(error => <li key={error.id}>{codeById.get(error.id) || error.id}: {error.message}</li>)}</ul>}
        </div>}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" disabled={processing} onClick={onClose} className="ui-button-secondary">Đóng</button>
          <button type="button" disabled={!selectedRows.length || processing} onClick={openRejectDialog} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white min-h-9 px-3 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"><XCircle className="size-4" />{rejectLabel} ({selectedRows.length})</button>
          <button type="button" disabled={!selectedRows.length || processing} onClick={() => onApprove(selectedRows.map(row => row.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 min-h-9 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="size-4" />{processing ? 'Đang xử lý...' : `${approveLabel} (${selectedRows.length})`}</button>
        </div>
      </div>

      {rejectDialogOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) closeRejectDialog(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-reject-title" className={`ui-dialog flex max-h-[min(88dvh,760px)] w-full ${selectedRows.length === 1 ? 'max-w-md' : 'max-w-2xl'} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
            <div className="flex shrink-0 items-start gap-4 border-b border-slate-100 px-5 py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <h3 id="bulk-reject-title" className="text-base font-bold text-slate-900">{rejectLabel} {selectedRows.length} phiếu?</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">Nhập lý do cho từng phiếu.</p>
              </div>
              <button type="button" aria-label="Đóng nhập lý do" disabled={processing || rejectSubmitting} onClick={closeRejectDialog} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"><X className="size-5" /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {selectedRows.map((row, index) => {
                const reason = rejectReasons[row.id] || '';
                return <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">{index + 1}</span><span className="document-code">{row.code}</span></div>
                    <span className="truncate text-xs text-slate-500">{row.warehouse}</span>
                  </div>
                  <label htmlFor={`reject-reason-${row.id}`} className="form-label">Lý do {rejectLabel.toLocaleLowerCase('vi-VN')}</label>
                  <textarea id={`reject-reason-${row.id}`} value={reason} onChange={event => setRejectReasons(current => ({ ...current, [row.id]: event.target.value }))} placeholder={`Nhập lý do cho phiếu ${row.code}...`} maxLength={120} rows={2} className="form-control min-h-16 resize-y rounded-[6px] p-1.5" />
                  <p className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/120 ký tự</p>
                </div>;
              })}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button type="button" disabled={processing || rejectSubmitting} onClick={closeRejectDialog} className="ui-button-secondary">Hủy</button>
              <button type="button" disabled={!rejectReasonsValid || processing || rejectSubmitting} onClick={() => void submitRejections()} className="ui-button-danger"><XCircle className="size-4" />{rejectSubmitting ? 'Đang xử lý...' : `${rejectLabel} ${selectedRows.length} phiếu`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
