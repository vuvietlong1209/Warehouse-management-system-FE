'use client';

import { FilterSelect } from '@/components/filter-select';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AlertTriangle, CalendarClock, PackagePlus, RefreshCw, Search, X } from 'lucide-react';
import { Warehouse } from '@/types/warehouse';
import { Button, EmptyState, StatusBadge, formatDateVN, WholeRowViewport } from '@/components/ui';
import { ForecastCoverageNotice, ForecastCoverage, formatForecastValue } from '@/components/forecast-coverage-notice';

export type SelectedReplenishmentItem = { itemId: number };

type ReplenishmentRow = {
  item_id: number;
  item_code: string;
  item_name: string;
  current_stock: number;
  safety_stock: number | null;
  current_week_received: number;
  forecast_next_week: number | null;
  recommended_order_quantity: number | null;
  needs_replenishment: boolean | null;
  warehouse_count: number;
  replenishment_location_count: number;
};

type ReplenishmentResponse = {
  data?: ReplenishmentRow[];
  data_coverage?: ForecastCoverage;
  period?: {
    forecast_week_start: string;
    forecast_week_end: string;
  } | null;
  assumptions?: {
    lead_time_days: number;
    service_level: number;
  };
  message?: string;
};

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function ReplenishmentDialog({
  warehouses,
  initialWarehouseId,
  actionLabel = 'Lập đơn nhập',
  onUseSelection,
  onClose,
}: {
  warehouses: Warehouse[];
  initialWarehouseId?: number;
  actionLabel?: string;
  onUseSelection: (selection: SelectedReplenishmentItem[], warehouseId?: number) => void;
  onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ? String(initialWarehouseId) : '');
  const [search, setSearch] = useState('');
  const [onlyRequired, setOnlyRequired] = useState(true);
  const [rows, setRows] = useState<ReplenishmentRow[]>([]);
  const [period, setPeriod] = useState<ReplenishmentResponse['period']>(null);
  const [assumptions, setAssumptions] = useState({ lead_time_days: 7, service_level: 0.95 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [coverage, setCoverage] = useState<ForecastCoverage | null>(null);
  const request = useRef<AbortController | null>(null);
  const activeWarehouses = useMemo(() => warehouses.filter(warehouse => warehouse.status), [warehouses]);

  const loadRecommendations = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      });
      const response = await fetch(`/api/forecast${params.size ? `?${params}` : ''}`, { cache: 'no-store', signal: controller.signal });
      const body = await response.json() as ReplenishmentResponse;
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(body.message || 'Không tải được lượng hàng cần nhập');
      setRows(body.data || []);
      setCoverage(body.data_coverage || null);
      const available = new Set((body.data || []).filter(row => row.forecast_next_week != null && row.recommended_order_quantity != null).map(row => row.item_id));
      setSelected(previous => new Set([...previous].filter(id => available.has(id))));
      setPeriod(body.period || null);
      setAssumptions(body.assumptions || { lead_time_days: 7, service_level: 0.95 });
    } catch (cause) {
      if (controller.signal.aborted) return;
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'Không tải được lượng hàng cần nhập');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [warehouseId, warehouses]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecommendations(), 250);
    return () => { window.clearTimeout(timer); request.current?.abort(); };
  }, [loadRecommendations]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const visibleRows = useMemo(
    () => rows.filter(row => (!onlyRequired || row.needs_replenishment || row.forecast_next_week == null)
      && `${row.item_code} ${row.item_name}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))),
    [onlyRequired, rows, search],
  );
  const totalRecommended = useMemo(
    () => visibleRows.some(row => row.recommended_order_quantity == null) ? null
      : visibleRows.reduce((total, row) => total + Number(row.recommended_order_quantity), 0),
    [visibleRows],
  );
  const totalSafetyStock = useMemo(
    () => visibleRows.some(row => row.safety_stock == null) ? null
      : visibleRows.reduce((total, row) => total + Number(row.safety_stock), 0),
    [visibleRows],
  );
  const selectedWarehouse = warehouseId
    ? activeWarehouses.find(warehouse => warehouse.id === Number(warehouseId))?.name || 'Kho đang chọn'
    : 'Tất cả kho hàng';

  const toggleSelection = (itemId: number) => {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-labelledby="replenishment-title" className="ui-dialog proposal-dialog flex max-h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 id="replenishment-title" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <PackagePlus className="size-5 text-emerald-600" />
            Xem lượng cần nhập
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng màn hình lượng cần nhập" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-12 gap-2 border-b border-slate-100 px-4 py-3">
          <div className="col-span-12 md:col-span-6">
            <label htmlFor="replenishment-search" className="form-label">Tìm vật tư</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input id="replenishment-search" className="form-control pl-9" placeholder="Mã hoặc tên vật tư..." value={search} onChange={event => setSearch(event.target.value)} />
            </div>
          </div>
          <div className="col-span-12 md:col-span-6">
            <label htmlFor="replenishment-warehouse" className="form-label">Kho hàng</label>
            <FilterSelect label="Kho hàng cần nhập" id="replenishment-warehouse" className="form-control" value={warehouseId} onChange={event => { setWarehouseId(event); setSelected(new Set()); }}>
              <option value="">Tất cả kho hàng</option>
              {activeWarehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </FilterSelect>
          </div>
          <div className="col-span-12 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input type="checkbox" className="size-4 rounded border-slate-300" checked={onlyRequired} onChange={event => setOnlyRequired(event.target.checked)} />
              Chỉ hiện vật tư cần nhập thêm
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge tone="neutral">{selectedWarehouse}</StatusBadge>
              <StatusBadge tone="info">Mức phục vụ {number.format(assumptions.service_level * 100)}%</StatusBadge>
              <StatusBadge tone="neutral"><CalendarClock className="size-3.5" /> Lead time {assumptions.lead_time_days} ngày</StatusBadge>
            </div>
          </div>
        </div>

        <div className="proposal-list-body flex min-h-0 flex-1 flex-col px-4 py-3">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-slate-600" aria-live="polite">
            <span className="date-value">{period ? `Tuần dự báo ${formatDateVN(period.forecast_week_start)} – ${formatDateVN(period.forecast_week_end)}` : 'Chưa xác định tuần dự báo'}</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Hiển thị <strong className="text-slate-900">{visibleRows.length}</strong> vật tư</span>
              <span>Tổng tồn an toàn <strong className="text-blue-700">{formatForecastValue(totalSafetyStock, number)} đơn vị</strong></span>
              <span>Tổng đề xuất <strong className="text-amber-700">{formatForecastValue(totalRecommended, number)} đơn vị</strong></span>
            </div>
          </div>

          {!loading && !error ? <div className="mb-2 shrink-0"><ForecastCoverageNotice coverage={coverage} /></div> : null}

          {error ? (
            <div role="alert" className="mb-3 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle className="size-5 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button variant="secondary" size="sm" onClick={() => void loadRecommendations()}><RefreshCw className="size-4" />Thử lại</Button>
            </div>
          ) : null}

          <div className="table-container flex min-h-0 flex-col">
            <WholeRowViewport className="min-h-0 flex-1" label="Danh sách lượng cần nhập">
              <table className="document-table proposal-table replenishment-table w-full min-w-[1040px] table-fixed border-collapse text-left">
                <colgroup><col className="w-[5%]" /><col className="w-[12%]" /><col className="w-[23%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[13%]" /><col className="w-[13%]" /></colgroup>
                <thead>
                  <tr className="table-header">
                    <th className="px-2 py-2.5 text-center">Chọn</th>
                    <th className="px-3 py-2.5">Mã vật tư</th>
                    <th className="px-3 py-2.5">Tên vật tư</th>
                    <th className="px-3 py-2.5 text-center">Tồn hiện tại</th>
                    <th className="px-3 py-2.5 text-center">Tồn an toàn</th>
                    <th className="px-3 py-2.5 text-center">Đã nhập tuần này</th>
                    <th className="px-3 py-2.5 text-center">Dự báo tuần sau</th>
                    <th className="px-3 py-2.5 text-center">Cần nhập thêm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={8} className="h-48 text-center text-sm font-medium text-slate-500">Đang tính lượng cần nhập...</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr><td colSpan={8}><EmptyState title="Không có vật tư cần nhập" description="Không tìm thấy đề xuất nhập phù hợp với bộ lọc hiện tại." /></td></tr>
                  ) : visibleRows.map(row => (
                    <tr key={row.item_id} className="table-row">
                      <td className="px-2 py-2.5 text-center"><input type="checkbox" aria-label={`Chọn ${row.item_code}`} title={row.forecast_next_week == null ? 'Chưa đủ dữ liệu dự báo' : undefined} disabled={row.forecast_next_week == null || row.recommended_order_quantity == null} className="size-4 rounded border-slate-300 disabled:cursor-not-allowed" checked={selected.has(row.item_id)} onChange={() => { if (row.forecast_next_week != null && row.recommended_order_quantity != null) toggleSelection(row.item_id); }} /></td>
                      <td className="px-3 py-2.5"><span className="document-code">{row.item_code}</span></td>
                      <td className="break-words px-3 py-2.5 font-medium text-slate-900">{row.item_name}</td>
                      <td className="px-3 py-2.5 text-center font-medium tabular-nums">{number.format(row.current_stock)}</td>
                      <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-blue-700">{formatForecastValue(row.safety_stock, number)}</td>
                      <td className="px-3 py-2.5 text-center font-medium tabular-nums">{number.format(row.current_week_received)}</td>
                      <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-blue-700" title={row.forecast_next_week == null ? 'Chưa đủ dữ liệu dự báo' : undefined}>{formatForecastValue(row.forecast_next_week, number)}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-amber-700">{formatForecastValue(row.recommended_order_quantity, number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WholeRowViewport>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-xs font-medium text-slate-600">Đã chọn <strong className="text-slate-900">{selected.size}</strong> sản phẩm</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Đóng</Button>
            <Button disabled={loading || !selected.size} onClick={() => {
              if (loading) return;
              const available = [...selected].filter(id => rows.some(row => row.item_id === id && row.forecast_next_week != null && row.recommended_order_quantity != null));
              if (available.length) onUseSelection(available.map(itemId => ({ itemId })), warehouseId ? Number(warehouseId) : undefined);
            }}><PackagePlus className="size-4" />{actionLabel} ({selected.size})</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
