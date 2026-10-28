'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { DocumentModal } from '@/components/document-modal';
import { FilterSelect } from '@/components/filter-select';
import { Button, CatalogPagination, WholeRowViewport, formatDateVN } from '@/components/ui';

type IdleStockRow = { item_id: number; item_code: string; item_name: string; unit: string;
  warehouse_id: number; warehouse_name: string; stock_quantity: number; stock_value: number;
  last_movement_date: string; idle_days: number };
type IdleStockResponse = { data: IdleStockRow[]; as_of_date: string;
  pagination: { page: number; page_size: number; total: number; total_pages: number } };
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function DashboardIdleStock() {
  const { warehouses, dataRevision } = useWarehouse();
  const [warehouseId, setWarehouseId] = useState(''), [minimumDays, setMinimumDays] = useState('60');
  const [search, setSearch] = useState(''), [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [reload, setReload] = useState(0);
  const [result, setResult] = useState<IdleStockResponse | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const query = new URLSearchParams({ min_idle_days: minimumDays, page: String(showAll ? page : 1),
    page_size: String(showAll ? pageSize : 5), ...(warehouseId ? { warehouse_id: warehouseId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}) }).toString();

  useEffect(() => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/dashboard/idle-stock?${query}`, { cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || body.error || 'Không tải được vật tư tồn lâu');
        if (!controller.signal.aborted) setResult(body);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, dataRevision, reload]);

  const change = (apply: () => void) => { request.current?.abort(); setLoading(true); setPage(1); apply(); };
  const filters = (suffix: string) => <div className="grid gap-2 sm:grid-cols-[1fr_12rem_1.4fr]">
    <FilterSelect id={`idle-stock-warehouse-${suffix}`} label="Lọc vật tư tồn lâu theo kho" value={warehouseId} onChange={value => change(() => setWarehouseId(value))} className="form-control">
      <option value="">Tất cả kho</option>{warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
    </FilterSelect>
    <FilterSelect id={`idle-stock-days-${suffix}`} label="Số ngày không giao dịch" value={minimumDays} onChange={value => change(() => setMinimumDays(value))} className="form-control">
      {[30, 60, 90, 180].map(days => <option key={days} value={days}>Từ {days} ngày</option>)}
    </FilterSelect>
    <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
      <input type="search" aria-label="Tìm vật tư tồn lâu" placeholder="Tìm mã hoặc tên vật tư..." maxLength={128} value={search} onChange={event => change(() => setSearch(event.target.value))} className="form-control pl-8"/>
    </div>
  </div>;
  const errorNotice = error && <div role="alert" className="flex shrink-0 items-center justify-between gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-800">{error}<Button size="sm" variant="secondary" onClick={() => setReload(value => value + 1)}>Thử lại</Button></div>;
  const rows = result?.data || [], pagination = result?.pagination;

  return <>
    <section aria-label="Vật tư tồn kho lâu không giao dịch" aria-hidden={showAll || undefined} className="table-container">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white p-4">
        <h2 className="text-base font-bold text-slate-900">Vật tư tồn kho lâu không giao dịch</h2>
        <Button size="sm" variant="secondary" onClick={() => change(() => setShowAll(true))}>Xem tất cả</Button>
      </header>
      <div className="shrink-0 border-b border-slate-100 p-3">{filters('preview')}</div>
      {errorNotice}
      <div className="overflow-x-auto" aria-busy={loading}><IdleStockTable rows={rows.slice(0, 5)} offset={0} loading={loading}/></div>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-700">
        <span>{loading ? 'Đang cập nhật...' : `Hiển thị ${Math.min(rows.length, 5)} / ${pagination?.total || 0} dòng · Ưu tiên giá trị tồn cao nhất`}</span>
        {result && <span className="date-value">Tính đến {formatDateVN(result.as_of_date)}</span>}
      </footer>
    </section>
    {showAll && <DocumentModal title="Vật tư tồn kho lâu không giao dịch" wide className="h-[80dvh]" onClose={() => change(() => setShowAll(false))}>
      <div className="shrink-0 border-b border-slate-100 p-3">{filters('all')}</div>
      {errorNotice}
      <div className="flex min-h-0 flex-1 flex-col p-3" aria-busy={loading}>
        <WholeRowViewport className="min-h-0 flex-1 rounded-md border border-slate-200" label="Danh sách đầy đủ vật tư tồn lâu">
          <IdleStockTable rows={rows} offset={((pagination?.page || 1) - 1) * (pagination?.page_size || pageSize)} loading={loading}/>
        </WholeRowViewport>
      </div>
      <div className="shrink-0 border-t border-slate-100 bg-slate-50">
        <CatalogPagination page={pagination?.page || 1} totalPages={pagination?.total_pages || 1} pageSize={pageSize} disabled={loading}
          onPageChange={value => { request.current?.abort(); setLoading(true); setPage(value); }} onPageSizeChange={value => change(() => setPageSize(value))}/>
      </div>
    </DocumentModal>}
  </>;
}

export function IdleStockTable({ rows, offset, loading }: { rows: IdleStockRow[]; offset: number; loading: boolean }) {
  return <table className={`document-table min-w-[1100px] w-full table-fixed text-left ${loading ? 'pointer-events-none opacity-60' : ''}`}>
    <colgroup>{[4, 12, 22, 15, 5, 9, 12, 9, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }}/>)}</colgroup>
    <thead className="sticky top-0 z-10 bg-slate-50"><tr className="table-header">
      {['STT', 'Mã vật tư', 'Tên vật tư', 'Kho', 'ĐVT', 'Số lượng tồn', 'Giao dịch gần nhất', 'Số ngày không giao dịch', 'Giá trị tồn (₫)'].map((label, index) => <th key={label} className={`px-3 py-2.5 ${index === 0 || index >= 4 ? 'text-center' : ''}`}>{label}</th>)}
    </tr></thead>
    <tbody>{!rows.length && <tr><td colSpan={9} className="paged-table-message px-3 py-10 text-center text-sm text-slate-700" role="status">{loading ? 'Đang tải vật tư tồn lâu...' : 'Không có vật tư phù hợp với bộ lọc.'}</td></tr>}
      {rows.map((row, index) => <tr key={`${row.item_id}:${row.warehouse_id}`} className="table-row">
        <td className="px-3 py-2.5 text-center tabular-nums">{offset + index + 1}</td>
        <td className="break-words px-3 py-2.5"><Link tabIndex={loading ? -1 : undefined} className="font-semibold text-blue-700 hover:underline" href={`/inventory/summary?item_id=${row.item_id}&warehouse_id=${row.warehouse_id}`}>{row.item_code}</Link></td>
        <td className="break-words px-3 py-2.5 font-medium text-slate-800">{row.item_name}</td>
        <td className="break-words px-3 py-2.5 text-slate-700">{row.warehouse_name}</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.unit}</td>
        <td className="px-3 py-2.5 text-center tabular-nums">{number.format(row.stock_quantity)}</td>
        <td className="date-value whitespace-nowrap px-3 py-2.5 text-center">{formatDateVN(row.last_movement_date)}</td>
        <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-amber-700">{row.idle_days}</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-center font-semibold tabular-nums text-slate-900">{number.format(row.stock_value)}</td>
      </tr>)}
    </tbody>
  </table>;
}
