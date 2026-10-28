'use client';

import { FilterSelect } from '@/components/filter-select';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  PackageCheck,
  PackagePlus,
  Search,
  ShieldCheck,
  CheckCircle2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Button, EmptyState, PageHeader, WholeRowViewport, formatDateVN } from '@/components/ui';
import { ForecastCoverageNotice, ForecastCoverage, formatForecastValue } from '@/components/forecast-coverage-notice';
import { useFeedback } from '@/context/FeedbackContext';
import { ForecastMovementHistory } from '@/components/forecast-movement-history';

type ForecastRow = {
  item_id: number;
  item_code: string;
  item_name: string;
  current_stock: number | null;
  safety_stock: number | null;
  current_week_issued: number | null;
  current_week_received: number;
  forecast_next_week: number | null;
  forecast_next_week_raw: number | null;
  recommended_order_quantity: number | null;
  needs_replenishment: boolean | null;
  forecast_status?: string;
  warehouse_count: number;
  replenishment_location_count: number;
};

type ForecastKpis = {
  total_current_inventory: number | null;
  total_safety_stock: number | null;
  total_forecast_next_week: number | null;
  materials_requiring_replenishment: number | null;
  total_recommended_order_quantity: number | null;
};

type ForecastPeriod = {
  current_week_start: string;
  current_week_end: string;
  forecast_week_start: string;
  forecast_week_end: string;
};

type ForecastResponse = {
  data: ForecastRow[];
  kpis: ForecastKpis;
  period: ForecastPeriod | null;
  assumptions: { lead_time_days: number; service_level: number };
  data_coverage?: ForecastCoverage;
  quality?: {
    series_count: number;
    validation_mae: number | null;
    test_mae: number | null;
    selection_source: 'validation_walk_forward';
    metric_scope: 'live_validation';
    evaluation_horizon_weeks: number;
    forecast_horizon: 'current_week_estimate_then_next_week' | 'next_week_after_completed_selected_week';
    calibration_source: 'validation_walk_forward';
  };
  close_through_date?: string;
  available_weeks?: { week_start: string; week_end: string; is_current: boolean }[];
  view?: { mode: 'current_live' | 'historical_week_close'; as_of_date: string; is_saved_snapshot: boolean };
  message?: string;
};

const emptyKpis: ForecastKpis = {
  total_current_inventory: 0,
  total_safety_stock: 0,
  total_forecast_next_week: 0,
  materials_requiring_replenishment: 0,
  total_recommended_order_quantity: 0,
};

const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export default function ForecastPage() {
  const { warehouses, dataRevision } = useWarehouse();
  const { confirmAction, notify, showAlert } = useFeedback();
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [kpis, setKpis] = useState<ForecastKpis>(emptyKpis);
  const [period, setPeriod] = useState<ForecastPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [availableWeeks, setAvailableWeeks] = useState<NonNullable<ForecastResponse['available_weeks']>>([]);
  const [view, setView] = useState<ForecastResponse['view'] | null>(null);
  const [closeThroughDate, setCloseThroughDate] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<ForecastCoverage | null>(null);
  const [closingHistory, setClosingHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<ForecastRow | null>(null);
  const request = useRef<AbortController | null>(null);

  const query = useMemo(() => new URLSearchParams({
    ...(warehouseId ? { warehouse_id: warehouseId } : {}),
    ...(weekStart ? { week_start: weekStart } : {}),
  }).toString(), [warehouseId, weekStart]);
  const liveWeek = availableWeeks.find(week => week.is_current);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    if (!normalizedSearch) return rows;
    return rows.filter(row => `${row.item_code} ${row.item_name}`
      .toLocaleLowerCase('vi')
      .includes(normalizedSearch));
  }, [rows, search]);

  const loadForecast = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/forecast${query ? `?${query}` : ''}`, { cache: 'no-store', signal: controller.signal });
      const body = await response.json() as ForecastResponse;
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(body.message || 'Không tải được dữ liệu dự báo');
      setRows(body.data || []);
      setKpis(body.kpis || emptyKpis);
      setPeriod(body.period || null);
      setAvailableWeeks(body.available_weeks || []);
      setView(body.view || null);
      setCoverage(body.data_coverage || null);
      setCloseThroughDate(body.close_through_date || body.data_coverage?.required_through_date || null);
      setLastUpdated(new Date());
    } catch (cause) {
      if (controller.signal.aborted) return;
      setRows([]);
      setKpis({ total_current_inventory: null, total_safety_stock: null, total_forecast_next_week: null,
        materials_requiring_replenishment: null, total_recommended_order_quantity: null });
      setPeriod(null); setView(null); setCoverage(null);
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu dự báo');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [query, dataRevision]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadForecast(), 250);
    return () => { window.clearTimeout(timer); request.current?.abort(); };
  }, [loadForecast]);

  const closeHistory = async () => {
    if (!closeThroughDate || closingHistory) return;
    const accepted = await confirmAction({
      title: 'Xác nhận dữ liệu lịch sử đã đầy đủ?',
      message: `Chốt đến ${formatDateVN(closeThroughDate)} cho TẤT CẢ vật tư–kho đang theo dõi, không phụ thuộc bộ lọc lịch sử hiện tại.\nChỉ tiếp tục khi đã nhập và xử lý đầy đủ chứng từ. Ngày không phát sinh xuất sẽ được xác nhận là 0. Chứng từ gốc không thay đổi.`,
      confirmLabel: 'Dữ liệu đã đầy đủ — Chốt', tone: 'warning',
    });
    if (!accepted) return;
    setClosingHistory(true);
    try {
      const response = await fetch('/api/demand-history/close-day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: closeThroughDate, confirm_complete: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Không chốt được lịch sử');
      notify({ tone: 'success', title: 'Đã chốt dữ liệu lịch sử' });
      await loadForecast();
    } catch (cause) {
      notify({ tone: 'error', title: 'Không thể chốt lịch sử', message: cause instanceof Error ? cause.message : 'Vui lòng thử lại' });
    } finally { setClosingHistory(false); }
  };

  return (
    <div className="paged-data-page forecast-page">
      <PageHeader
        title="Dự báo nhu cầu và nhập hàng"
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => showAlert({ title: 'Lưu ý về dự báo', tone: 'info',
            message: 'Lượng đã nhập chỉ tính các lần nhập đã duyệt trong tuần và kho đang chọn. Dự báo lượng xuất vẫn dùng lịch sử xuất. Tuần quá khứ dùng tồn cuối tuần; dự báo áp dụng cho tuần liền sau.\nTồn an toàn và đề xuất nhập chỉ tính khi đủ lịch sử liên tục; dấu “—” không phải 0. Kết quả quá khứ được tính lại từ lịch sử đang lưu, không phải bản chụp lần chạy cũ.\nChốt dữ liệu chỉ thực hiện sau khi đã xử lý đầy đủ chứng từ và luôn áp dụng đến Chủ nhật gần nhất của hiện tại, độc lập tuần đang xem.' })}>
            <Info className="size-4" />Lưu ý
          </Button>
          <Button variant="secondary" disabled={loading || closingHistory} onClick={() => void loadForecast()}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Cập nhật dự báo
          </Button>
          <Button disabled={loading || closingHistory || !closeThroughDate} onClick={() => void closeHistory()}>
            <CheckCircle2 className="size-4" />{closingHistory ? 'Đang chốt...' : 'Chốt dữ liệu'}
          </Button>
          </div>
        )}
      />
      <div className="forecast-kpi-grid grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ForecastKpiCard
          label="Tổng tồn kho hiện có"
          value={loading ? '—' : formatForecastValue(kpis.total_current_inventory, quantity)}
          unit="đơn vị"
          tone="blue"
          icon={<PackageCheck className="size-5" />}
        />
        <ForecastKpiCard
          label="Tổng tồn an toàn"
          value={loading ? '—' : formatForecastValue(kpis.total_safety_stock, integer)}
          unit="đơn vị"
          tone="blue"
          icon={<ShieldCheck className="size-5" />}
        />
        <ForecastKpiCard
          label="Dự báo lượng xuất tuần sau"
          value={loading ? '—' : formatForecastValue(kpis.total_forecast_next_week, integer)}
          unit="đơn vị"
          tone="blue"
          icon={<CalendarClock className="size-5" />}
        />
        <ForecastKpiCard
          label="Tổng lượng hàng cần nhập thêm"
          value={loading ? '—' : formatForecastValue(kpis.total_recommended_order_quantity, integer)}
          unit="đơn vị"
          tone="emerald"
          icon={<PackagePlus className="size-5" />}
        />
      </div>

      <div aria-label="Bộ lọc dự báo" className="grid shrink-0 grid-cols-1 items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input id="forecast-search" type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Tìm theo mã hoặc tên vật tư..." aria-label="Tìm vật tư dự báo" className="form-control w-full pl-9" />
        </div>
        <FilterSelect id="forecast-warehouse" label="Lọc dự báo theo kho hàng" value={warehouseId} onChange={value => {
          if (value !== warehouseId) { request.current?.abort(); setWarehouseId(value); setLoading(true); setError(null); }
        }} className="form-control w-full font-medium">
          <option value="">Tất cả kho hàng</option>
          {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </FilterSelect>
        <FilterSelect id="forecast-week" label="Lọc dự báo theo tuần" value={weekStart} onChange={value => {
          if (value !== weekStart) { request.current?.abort(); setWeekStart(value); setLoading(true); setError(null); }
        }} className="form-control w-full font-medium">
          <option value="">Tuần hiện tại{liveWeek ? ` (${formatDateVN(liveWeek.week_start)} – ${formatDateVN(liveWeek.week_end)})` : ''}</option>
          {availableWeeks.filter(week => !week.is_current).map(week => <option key={week.week_start} value={week.week_start}>
            {formatDateVN(week.week_start)} – {formatDateVN(week.week_end)}
          </option>)}
        </FilterSelect>
        <span className="whitespace-nowrap text-right text-xs text-slate-500">Hiển thị <strong>{loading ? '—' : filteredRows.length}</strong> vật tư</span>
      </div>

        {error ? (
          <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="size-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void loadForecast()}>Thử lại</Button>
          </div>
        ) : null}

        {!loading && !error ? <ForecastCoverageNotice coverage={coverage} /> : null}

        <div className="table-container paged-list-panel">
          <WholeRowViewport label="Danh sách dự báo" key={`${warehouseId}-${search}-${loading}`}>
            <table className="document-table forecast-table w-full min-w-[1180px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[4%]" /><col className="w-[13%]" /><col className="w-[21%]" />
                <col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[13%]" />
                <col className="w-[15%]" /><col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="table-header">
                  <th className="stt-column px-2 py-3">STT</th>
                  <th className="px-3 py-3">Mã vật tư</th>
                  <th className="px-3 py-3">Tên vật tư</th>
                  <th className="px-3 py-3 text-center">Số lượng tồn hiện tại</th>
                  <th className="px-3 py-3 text-center">Tồn an toàn</th>
                  <th className="px-3 py-3 text-center">Số lượng đã nhập trong tuần</th>
                  <th className="px-3 py-3 text-center">Số lượng dự báo sẽ xuất trong tuần sau</th>
                  <th className="px-4 py-3 text-center">Số lượng cần nhập thêm</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="paged-table-message text-center text-sm font-medium text-slate-500">Đang chạy mô hình dự báo...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState title="Không có dữ liệu dự báo" description="Không tìm thấy vật tư phù hợp với bộ lọc hiện tại." /></td></tr>
                ) : filteredRows.map((row, index) => (
                  <tr key={row.item_id} className="table-row">
                    <td className="stt-column px-2 py-3">{index + 1}</td>
                    <td className="px-3 py-3"><button type="button" className="text-left font-semibold text-blue-700 hover:underline" aria-label={`Lịch sử ${row.item_code}`} onClick={() => setHistoryItem(row)}>{row.item_code}</button></td>
                    <td className="break-words px-3 py-3 font-semibold text-slate-900">{row.item_name}</td>
                    <td className="px-3 py-3 text-center font-medium tabular-nums text-slate-700">{formatForecastValue(row.current_stock, quantity)}</td>
                    <td className="px-3 py-3 text-center font-semibold tabular-nums text-blue-700">{formatForecastValue(row.safety_stock, integer)}</td>
                    <td className="px-3 py-3 text-center font-medium tabular-nums text-slate-700">{formatForecastValue(row.current_week_received, quantity)}</td>
                    <td className="px-3 py-3 text-center font-semibold tabular-nums text-blue-700" title={row.forecast_next_week == null ? 'Chưa đủ dữ liệu dự báo' : undefined}>{formatForecastValue(row.forecast_next_week, integer)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={row.needs_replenishment ? 'font-bold tabular-nums text-amber-700' : 'font-medium tabular-nums text-slate-400'}>
                        {formatForecastValue(row.recommended_order_quantity, integer)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </WholeRowViewport>
          <div className="forecast-update flex min-h-10 shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-4 text-xs text-slate-500">
            <span className="date-value">{loading ? 'Đang cập nhật...' : period ? `${view?.mode === 'historical_week_close' ? `Số liệu cuối tuần ${formatDateVN(view.as_of_date)} · ` : ''}Tuần dự báo ${formatDateVN(period.forecast_week_start)} – ${formatDateVN(period.forecast_week_end)}` : 'Dự báo hiện tại'}</span>
            <span className="date-value">{lastUpdated ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa cập nhật'}</span>
          </div>
        </div>

      {historyItem && <ForecastMovementHistory item={historyItem} warehouseId={warehouseId} warehouses={warehouses}
        weekStart={period?.current_week_start || weekStart} forecastPeriod={period} asOfDate={view?.as_of_date} onClose={() => setHistoryItem(null)} />}
    </div>
  );
}

function ForecastKpiCard({
  label,
  value,
  unit,
  tone,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  tone: 'blue' | 'amber' | 'emerald';
  icon: React.ReactNode;
}) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-600',
    amber: 'border-amber-100 bg-amber-50 text-amber-600',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 font-sans text-[23px] font-bold leading-7 tracking-tight text-slate-900 tabular-nums">
            <span className="whitespace-nowrap">{value}</span><span className="text-xs font-medium tracking-normal text-slate-400">{unit}</span>
          </p>
        </div>
        <div className={`forecast-kpi-icon flex size-9 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}>{icon}</div>
      </div>
    </div>
  );
}
