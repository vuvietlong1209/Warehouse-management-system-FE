'use client';

import { useEffect, useState } from 'react';
import { DocumentModal } from '@/components/document-modal';
import { FilterSelect } from '@/components/filter-select';
import { Button, WholeRowViewport, formatDateVN } from '@/components/ui';
import { formatForecastValue } from '@/components/forecast-coverage-notice';

type Movement = { id: number; kind: 'RECEIPT' | 'ISSUE'; code: string; order_date: string;
  warehouse_name: string; bin_id: number; bin_code: string; bin_description: string; quantity: number };
type History = { scope: string; item: { unit: string }; period: { from_date: string; to_date: string }; data: Movement[];
  latest_receipt: { unit_price: number; order_date: string; code: string } | null;
  summary: { received: number; issued: number } };
const ranges = [['week', '1 tuần'], ['two_weeks', '2 tuần'], ['month', '1 tháng'], ['two_months', '2 tháng']] as const;
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
type ForecastItem = { item_id: number; item_code: string; item_name: string; current_stock: number | null;
  safety_stock: number | null; current_week_received?: number | null; forecast_next_week: number | null; recommended_order_quantity: number | null };

export function ForecastMovementHistory({ item, warehouseId, warehouses, weekStart, forecastPeriod, asOfDate, onClose }: {
  item: ForecastItem; warehouses: { id: number; name: string }[];
  warehouseId: string; weekStart: string; forecastPeriod: { forecast_week_start: string; forecast_week_end: string } | null;
  asOfDate?: string; onClose: () => void;
}) {
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouseId);
  const [range, setRange] = useState('month'), [result, setResult] = useState<History | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const scope = `${item.item_id}:${selectedWarehouse}:${weekStart}`;
  const [forecast, setForecast] = useState<{ scope: string; item: ForecastItem | null; error?: string } | null>(null);
  const usePageMetrics = selectedWarehouse === warehouseId;
  const metricsLoading = !usePageMetrics && forecast?.scope !== scope;
  const metrics = usePageMetrics ? item : forecast?.scope === scope ? forecast.item : null;
  const forecastError = !usePageMetrics && forecast?.scope === scope ? forecast.error : '';

  useEffect(() => {
    if (usePageMetrics) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ ...(selectedWarehouse ? { warehouse_id: selectedWarehouse } : {}), ...(weekStart ? { week_start: weekStart } : {}) });
    void (async () => {
      try {
        const response = await fetch(`/api/forecast?${query}`, { cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Không tải được chỉ tiêu vật tư');
        if (!controller.signal.aborted) setForecast({ scope, item: body.data.find((row: ForecastItem) => row.item_id === item.item_id) ?? null });
      } catch (cause) {
        if (!controller.signal.aborted) setForecast({ scope, item: null, error: cause instanceof Error ? cause.message : 'Không tải được chỉ tiêu vật tư' });
      }
    })();
    return () => controller.abort();
  }, [item.item_id, selectedWarehouse, weekStart, scope, usePageMetrics]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams({ range, ...(selectedWarehouse ? { warehouse_id: selectedWarehouse } : {}), ...(asOfDate ? { to_date: asOfDate } : {}) });
    void (async () => {
      try {
        const response = await fetch(`/api/forecast/items/${item.item_id}/movements?${query}`, { cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Không tải được lịch sử nhập/xuất');
        if (!controller.signal.aborted) setResult({ ...body, scope });
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [item.item_id, selectedWarehouse, range, asOfDate, scope]);
  const unit = result?.item.unit || 'đơn vị';
  const latestPrice = loading || error || result?.scope !== scope ? null : result?.latest_receipt?.unit_price ?? null;
  const needed = metrics?.recommended_order_quantity;
  const estimatedAmount = needed == null ? null : needed === 0 ? 0
    : latestPrice == null ? null : Math.round(needed * latestPrice * 100) / 100;
  const cards = [
    { label: 'Tồn hiện tại', value: metrics?.current_stock, tone: 'text-slate-900' },
    { label: 'Tồn an toàn', value: metrics?.safety_stock, tone: 'text-blue-700' },
    { label: 'Lượng đã nhập', value: metrics?.current_week_received ?? 0,
      tone: 'text-emerald-700', hint: 'Trong tuần đang xem' },
    { label: 'Dự báo tuần sau', value: metrics?.forecast_next_week, tone: 'text-blue-700' },
    { label: 'Cần nhập thêm', value: needed, tone: 'text-amber-700' },
    { label: 'Số tiền nhập dự kiến', value: estimatedAmount, tone: 'text-slate-900', money: true,
      hint: latestPrice == null ? (loading ? 'Đang tải giá nhập…' : 'Chưa có giá nhập') : `Giá nhập: ${number.format(latestPrice)} ₫`,
      title: result?.latest_receipt ? `${result.latest_receipt.code} · ${formatDateVN(result.latest_receipt.order_date)}` : undefined },
  ];
  return <DocumentModal title={`Lịch sử nhập/xuất · ${item.item_code} · ${item.item_name}`} wide onClose={onClose} className="forecast-history-dialog"
    style={{ height: Math.min(760, 400 + Math.min(8, result?.data.length || 1) * 44) }}>
    <div className="shrink-0 space-y-3 border-b px-4 py-3">
      <dl aria-label="Chỉ tiêu vật tư" aria-busy={metricsLoading} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(card => <div key={card.label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5" title={card.title}>
          <dt className="text-xs font-medium text-slate-600">{card.label}</dt>
          <dd className={`mt-1 break-words text-lg font-bold tabular-nums ${card.tone}`}>
            {metricsLoading ? '…' : formatForecastValue(card.value ?? 0, number)}<span className="ml-1 text-xs font-medium text-slate-600">{card.money ? '₫' : unit}</span>
          </dd>
          {card.hint && <p className="mt-1 text-[11px] text-slate-600">{card.hint}</p>}
        </div>)}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Kho hàng trong lịch sử vật tư" value={selectedWarehouse} onChange={setSelectedWarehouse} className="form-control w-full sm:w-80">
          <option value="">Tất cả kho hàng</option>
          {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </FilterSelect>
        <div role="group" aria-label="Khoảng lịch sử gần nhất" className="flex gap-2">{ranges.map(([value, label]) =>
          <Button key={value} size="sm" variant={range === value ? 'primary' : 'secondary'} aria-pressed={range === value} onClick={() => setRange(value)}>{label}</Button>)}</div>
      </div>
      {forecastError && <p role="alert" className="text-sm text-rose-700">{forecastError}</p>}
    </div>
    {error ? <p role="alert" className="p-4 text-sm text-rose-700">{error}</p> : <WholeRowViewport className="min-h-0 flex-1" label="Lịch sử nhập xuất vật tư">
      <table className="document-table w-full min-w-[1050px] text-left text-[13px]">
        <thead><tr className="table-header"><th className="stt-column">STT</th><th>Ngày</th><th>Loại</th><th>Mã lần nhập/xuất</th><th>Kho hàng</th><th>Vị trí</th><th className="text-center">Số lượng</th><th className="text-center">ĐVT</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="py-8 text-center text-slate-600">Đang tải lịch sử…</td></tr>
          : !result?.data.length ? <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-600">Không có lần nhập/xuất đã duyệt trong khoảng này</td></tr>
          : result.data.map((row, index) => <tr key={`${row.kind}-${row.id}-${row.bin_id}-${index}`} className="table-row">
            <td className="stt-column">{index + 1}</td><td className="whitespace-nowrap text-slate-700">{formatDateVN(row.order_date)}</td>
            <td className={row.kind === 'RECEIPT' ? 'text-emerald-700' : 'text-blue-700'}>{row.kind === 'RECEIPT' ? 'Nhập' : 'Xuất'}</td>
            <td className="font-semibold text-blue-700">{row.code}</td><td>{row.warehouse_name}</td><td title={row.bin_description}>{row.bin_code}</td>
            <td className="text-center tabular-nums">{number.format(row.quantity)}</td><td className="text-center">{result.item.unit}</td>
          </tr>)}</tbody>
      </table>
    </WholeRowViewport>}
    <footer className="mt-auto flex shrink-0 items-center justify-between gap-3 border-t bg-slate-50 p-3">
      <div className="space-y-1 text-xs text-slate-700">
        {forecastPeriod && <p>Tuần dự báo: {formatDateVN(forecastPeriod.forecast_week_start)} – {formatDateVN(forecastPeriod.forecast_week_end)}</p>}
        {result && <p>Lịch sử: {formatDateVN(result.period.from_date)} – {formatDateVN(result.period.to_date)}</p>}
      </div>
      <Button variant="secondary" onClick={onClose}>Đóng</Button>
    </footer>
  </DocumentModal>;
}
