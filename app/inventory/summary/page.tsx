'use client';

import { FilterSelect } from '@/components/filter-select';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useWarehouse } from '@/context/WarehouseContext';
import { GoodsIssue, GoodsReceipt, InventoryCheck, Item } from '@/types/warehouse';
import { Eye, Search, X, History, ArrowDown, ArrowUp, FileText } from 'lucide-react';
import { Button, CatalogPagination, EmptyState, formatDateVN, PageHeader, StatusBadge, WholeRowViewport } from '@/components/ui';

const formatVnd = (value: number, fractionDigits = 0) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: fractionDigits }).format(value)} đ`;

type StockItem = Pick<Item, 'id' | 'code' | 'name' | 'base_unit_name'>;
type ValuationRow = { endingQuantity: number; endingValue: number; item: StockItem };
type StockValuations = {
  warehouseId: number | 'ALL';
  loading: boolean;
  byItem: Record<number, ValuationRow>;
  error: string | null;
};

export default function InventorySummaryPage() {
  const { items, bins, units, warehouses, goodsReceipts, goodsIssues, inventoryChecks, getItemStock, getItemAvailableStock, getItemHistory, dataRevision } = useWarehouse();
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedItem, setViewingItem] = useState<StockItem | null>(null);
  const openedStockLink = useRef(false);
  const [selectedDocument, setViewingDocument] = useState<{ type: 'Nhập' | 'Xuất' | 'Kiểm kê'; data: GoodsReceipt | GoodsIssue | InventoryCheck } | null>(null);
  const [stockValuations, setStockValuations] = useState<StockValuations>({ warehouseId: 'ALL', loading: true, byItem: {}, error: null });
  const currentValuations = stockValuations.warehouseId === selectedWarehouseId ? stockValuations : null;
  const heldQuantities = useMemo(() => new Map(items.map(item => {
    let holds: { bin_id: number; quantity: number }[] = [];
    try { holds = typeof item.reserved_bins === 'string' ? JSON.parse(item.reserved_bins) : item.reserved_bins || []; } catch { /* No client-written reservation data. */ }
    return [item.id, holds.filter(hold => selectedWarehouseId === 'ALL' || bins.some(bin => bin.id === hold.bin_id && bin.warehouse_id === selectedWarehouseId)).reduce((sum, hold) => sum + Number(hold.quantity), 0)];
  })), [items, bins, selectedWarehouseId]);
  const viewingItem = selectedItem ? items.find(item => item.id === selectedItem.id)
    || currentValuations?.byItem[selectedItem.id]?.item || null : null;
  const viewingDocument = selectedDocument ? (() => {
    const source = selectedDocument.type === 'Nhập' ? goodsReceipts : selectedDocument.type === 'Xuất' ? goodsIssues : inventoryChecks;
    const data = source.find(document => document.id === selectedDocument.data.id);
    return data ? { type: selectedDocument.type, data } : null;
  })() : null;
  const inventoryWarehouses = useMemo(() => {
    const byId = new Map(warehouses.map(warehouse => [warehouse.id, warehouse]));
    [...goodsReceipts, ...goodsIssues, ...inventoryChecks].forEach(document => {
      if (!byId.has(document.warehouse_id)) byId.set(document.warehouse_id, {
        id: document.warehouse_id, name: document.warehouse_name || `Kho #${document.warehouse_id}`,
        code: '', status: false, created_at: '', updated_at: '',
      });
    });
    return [...byId.values()];
  }, [warehouses, goodsReceipts, goodsIssues, inventoryChecks]);

  // Quantity and value come from the same ledger, including inactive catalogs with history.
  const inventoryRows = useMemo(() => {
    const byId = new Map<number, StockItem>(items.map(item => [item.id, item]));
    Object.values(currentValuations?.byItem || {}).forEach(row => {
      if (!byId.has(row.item.id)) byId.set(row.item.id, row.item);
    });
    return [...byId.values()].map(item => {
      const valuation = currentValuations?.byItem[item.id];
      const stock = valuation?.endingQuantity ?? getItemStock(item.id, undefined,
        selectedWarehouseId === 'ALL' ? undefined : selectedWarehouseId);
      return {
        item,
        stock,
      };
    });
  }, [items, currentValuations, getItemStock, selectedWarehouseId]);

  useEffect(() => {
    if (openedStockLink.current || typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search);
    const itemId = Number(query.get('item_id')), warehouseId = Number(query.get('warehouse_id'));
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(warehouseId) || warehouseId <= 0) {
      openedStockLink.current = true; return;
    }
    const row = inventoryRows.find(row => row.item.id === itemId);
    if (!row) return;
    openedStockLink.current = true;
    setSelectedWarehouseId(warehouseId);
    setViewingItem(row.item);
  }, [inventoryRows]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return inventoryRows.filter(row => {
      const matchesSearch = !q || row.item.code.toLowerCase().includes(q) ||
                            row.item.name.toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [inventoryRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => setPage(1), [search, selectedWarehouseId, pageSize]);
  useEffect(() => setPage(currentPage), [currentPage]);

  const selectedWarehouseName = useMemo(() => (
    selectedWarehouseId === 'ALL'
      ? 'Tất cả kho hàng'
      : inventoryWarehouses.find(warehouse => warehouse.id === selectedWarehouseId)?.name || 'Kho đang chọn'
  ), [selectedWarehouseId, inventoryWarehouses]);

  const viewingItemHistory = useMemo(() => {
    if (!viewingItem) return [];
    return getItemHistory(
      viewingItem.id,
      selectedWarehouseId === 'ALL' ? undefined : selectedWarehouseId,
    );
  }, [viewingItem, getItemHistory, selectedWarehouseId]);

  const viewingItemStock = useMemo(() => {
    if (!viewingItem) return 0;
    return currentValuations?.byItem[viewingItem.id]?.endingQuantity ?? getItemStock(viewingItem.id, undefined,
      selectedWarehouseId === 'ALL' ? undefined : selectedWarehouseId);
  }, [viewingItem, getItemStock, currentValuations, selectedWarehouseId]);

  const viewingAvailableStock = useMemo(() => {
    const item = items.find(item => item.id === viewingItem?.id);
    if (!item?.status || !units.some(unit => unit.id === item.base_unit_id && unit.status)) return 0;
    const activeWarehouses = new Set(warehouses.filter(warehouse => warehouse.status).map(warehouse => warehouse.id));
    return bins.filter(bin => bin.status && activeWarehouses.has(bin.warehouse_id)
      && (selectedWarehouseId === 'ALL' || bin.warehouse_id === selectedWarehouseId))
      .reduce((total, bin) => total + Math.max(0, (getItemAvailableStock || getItemStock)(item.id, bin.id)), 0);
  }, [viewingItem, items, units, bins, warehouses, getItemStock, getItemAvailableStock, selectedWarehouseId]);

  const latestPurchasePrices = useMemo(() => {
    const latestByItem = new Map<number, { date: number; receiptId: number; detailId: number; price: number }>();
    goodsReceipts.forEach(receipt => {
      if (receipt.receipt_status !== 'Confirmed' || (selectedWarehouseId !== 'ALL' && receipt.warehouse_id !== selectedWarehouseId)) return;
      const date = new Date(receipt.order_date).getTime() || 0;
      receipt.items.forEach(detail => {
        const previous = latestByItem.get(detail.item_id);
        if (!previous || date > previous.date || (date === previous.date && (receipt.id > previous.receiptId || (receipt.id === previous.receiptId && detail.id > previous.detailId)))) {
          latestByItem.set(detail.item_id, { date, receiptId: receipt.id, detailId: detail.id, price: Number(detail.unit_price) || 0 });
        }
      });
    });
    return latestByItem;
  }, [goodsReceipts, selectedWarehouseId]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page_size: '100' });
    if (selectedWarehouseId !== 'ALL') params.set('warehouse_id', String(selectedWarehouseId));
    setStockValuations(previous => ({ warehouseId: selectedWarehouseId, loading: true,
      byItem: previous.warehouseId === selectedWarehouseId ? previous.byItem : {}, error: null }));
    const loadValuations = async () => {
      try {
        const byItem: Record<number, ValuationRow> = {};
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          params.set('page', String(page));
          const response = await fetch(`/api/reports/inventory-summary?${params}`, { cache: 'no-store', signal: controller.signal });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message || 'Không tải được giá trị tồn kho');
          (body.data || []).forEach((row: { id: number; code: string; name: string; unit: string; ending_quantity: number; ending_value: number }) => {
            byItem[row.id] = { endingQuantity: Number(row.ending_quantity) || 0, endingValue: Number(row.ending_value) || 0,
              item: { id: row.id, code: row.code, name: row.name, base_unit_name: row.unit } };
          });
          totalPages = Number(body.pagination?.total_pages) || 0;
          page += 1;
        }
        if (!controller.signal.aborted) setStockValuations({ warehouseId: selectedWarehouseId, loading: false, byItem, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setStockValuations({ warehouseId: selectedWarehouseId, loading: false, byItem: {}, error: error instanceof Error ? error.message : 'Không tải được giá trị tồn kho' });
      }
    };
    void loadValuations();
    return () => controller.abort();
  }, [selectedWarehouseId, items, goodsReceipts, goodsIssues, inventoryChecks, dataRevision]);
  const viewingValuation = viewingItem ? currentValuations?.byItem[viewingItem.id] : undefined;
  const latestViewingPrice = viewingItem ? latestPurchasePrices.get(viewingItem.id)?.price : undefined;
  const unitStockValue = viewingValuation?.endingQuantity
    ? viewingValuation.endingValue / viewingValuation.endingQuantity
    : 0;

  const openDocumentDetail = (type: 'Nhập' | 'Xuất' | 'Kiểm kê', code: string) => {
    const data = type === 'Nhập'
      ? goodsReceipts.find(document => document.code === code)
      : type === 'Xuất'
        ? goodsIssues.find(document => document.code === code)
        : inventoryChecks.find(document => document.code === code);
    if (data) setViewingDocument({ type, data });
  };

  return (
    <div className="paged-data-page" data-compact-report>
      <PageHeader title="Tổng hợp tồn kho" />

      {/* Filter Bar */}
      <div className="inventory-summary-filters bg-white p-3.5 rounded-xl border border-slate-200 shadow-card flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <div className="relative w-80 max-w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              aria-label="Tìm sản phẩm tồn kho"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã SKU hoặc tên sản phẩm..."
              className="form-control w-full pl-9"
            />
          </div>

          <FilterSelect label="Lọc theo kho hàng"
            aria-label="Lọc theo kho hàng"
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e === 'ALL' ? 'ALL' : Number(e))}
            className="form-control w-96 max-w-full font-medium"
          >
            <option value="ALL">Tất cả kho hàng</option>
            {inventoryWarehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </FilterSelect>
        </div>

        <p className="text-xs text-slate-500 font-medium">
          Hiển thị: <span className="font-semibold tabular-nums text-slate-900">{filteredRows.length}</span> sản phẩm
        </p>
      </div>
      {currentValuations?.error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{currentValuations.error}</p>}

      {/* Summary Table */}
      <div className="table-container paged-list-panel">
        <WholeRowViewport key={`${currentPage}-${pageSize}-${selectedWarehouseId}-${search}`} label="Danh sách tồn kho">
        <table className="document-table inventory-summary-table w-full min-w-[1450px] table-fixed text-left border-collapse" aria-busy={!currentValuations || currentValuations.loading}>
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[11%]" />
            <col className="w-[20%]" />
            <col className="w-[5%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead>
            <tr className="table-header">
              <th className="stt-column py-2.5 px-2">STT</th>
              <th className="py-2.5 px-4">Mã SKU</th>
              <th className="py-2.5 px-4">Tên sản phẩm</th>
              <th className="py-2.5 px-4 text-center">Đơn vị tính</th>
              <th className="py-2.5 px-4 text-center">Tồn kho</th>
              <th className="py-2.5 px-2 text-center">Giữ hàng</th>
              <th className="py-2.5 px-2 text-center">Sẵn sàng xuất</th>
              <th className="py-2.5 px-4 text-center" title="Giá nhập gần nhất từ phiếu đã duyệt">Giá nhập (gần nhất)</th>
              <th className="py-2.5 px-4 text-center" title="Giá trị tồn kho chia cho số lượng tồn">Giá lẻ (1 đơn vị)</th>
              <th className="py-2.5 px-4 text-center">Giá trị tồn kho</th>
              <th className="py-2.5 px-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                  <td colSpan={11}><EmptyState title="Không tìm thấy dữ liệu" description="Thử thay đổi từ khóa hoặc kho hàng đang chọn." /></td>
              </tr>
            ) : (
              pagedRows.map((row, index) => {
                const valuation = currentValuations?.byItem[row.item.id];
                const valuationPending = !currentValuations || currentValuations.loading;
                const valuationUnavailable = Boolean(currentValuations?.error);
                const unitValue = valuation?.endingQuantity ? valuation.endingValue / valuation.endingQuantity : 0;
                const latestPrice = latestPurchasePrices.get(row.item.id)?.price;
                const held = heldQuantities.get(row.item.id) || 0;
                const available = Math.max(0, row.stock - held);
                return (
                <tr key={row.item.id} className="table-row">
                  <td className="stt-column py-2.5 px-2 tabular-nums">{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className="py-2.5 px-4">
                    <span className="mono-code">{row.item.code}</span>
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{row.item.name}</td>
                  <td className="py-2.5 px-4 text-center text-slate-600">
                    {row.item.base_unit_name || 'Cái'}
                  </td>
                  <td className="py-2.5 px-4 text-center font-sans text-[13px] font-semibold tabular-nums text-slate-900">
                    <span className={row.stock > 0 ? 'text-blue-700' : 'text-slate-400'}>
                      {row.stock.toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums">{held.toLocaleString('vi-VN')}</td>
                  <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-blue-700">{available.toLocaleString('vi-VN')}</td>
                  <td className="whitespace-nowrap py-2.5 px-2 text-center tabular-nums text-slate-700">{latestPrice === undefined ? '—' : formatVnd(latestPrice)}</td>
                  <td className="whitespace-nowrap py-2.5 px-2 text-center tabular-nums text-slate-700">{valuationPending ? '…' : valuationUnavailable ? '—' : formatVnd(unitValue, 2)}</td>
                  <td className="whitespace-nowrap py-2.5 px-2 text-center font-semibold tabular-nums text-blue-700">{valuationPending ? '…' : valuationUnavailable ? '—' : formatVnd(valuation?.endingValue ?? 0)}</td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      onClick={() => setViewingItem(row.item)}
                      className="ui-button-secondary ui-button-sm whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-nowrap">Thẻ kho</span>
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </WholeRowViewport>
      </div>

      <CatalogPagination page={currentPage} totalPages={totalPages} onPageChange={setPage}
        pageSize={pageSize} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />

      {/* History Traceability Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="inventory-history-title" className="ui-dialog bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[1280px] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <History className="w-5 h-5 text-blue-400" />
                <div className="min-w-0">
                  <h2 id="inventory-history-title" className="font-bold text-base">Thẻ kho và lịch sử xuất nhập: {viewingItem.name}</h2>
                  <p className="text-[11px] text-slate-400">Mã SKU: <span className="font-sans font-semibold text-slate-700">{viewingItem.code}</span> | ĐVT: {viewingItem.base_unit_name || 'Cái'} | Kho: {selectedWarehouseName}</p>
                </div>
              </div>
              <button aria-label="Đóng lịch sử tồn kho" onClick={() => { setViewingDocument(null); setViewingItem(null); }} className="p-1 rounded hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div>
                  <p className="text-[11px] font-medium leading-4 text-slate-500">
                    {selectedWarehouseId === 'ALL' ? 'Tổng tồn kho hiện tại' : `Tồn kho tại ${selectedWarehouseName}`}
                  </p>
                  <p className="font-sans text-lg font-bold leading-6 tabular-nums text-blue-700">{viewingItemStock.toLocaleString('vi-VN')} Đơn vị</p>
                  <p className="mt-1 text-xs text-slate-700">Đã giữ: {(heldQuantities.get(viewingItem.id) || 0).toLocaleString('vi-VN')} · Sẵn sàng xuất tại vị trí hoạt động: {viewingAvailableStock.toLocaleString('vi-VN')}</p>
                </div>
                <StatusBadge tone={viewingAvailableStock > 0 ? 'success' : 'warning'}>{viewingAvailableStock > 0 ? 'Sẵn sàng xuất kho' : viewingItemStock > 0 ? 'Có tồn kho · Chưa sẵn sàng xuất' : 'Đã hết tồn'}</StatusBadge>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium leading-4 text-slate-500">Giá nhập (gần nhất)</p>
                  <p className="mt-0.5 text-base font-bold leading-5 tabular-nums text-slate-900">{latestViewingPrice === undefined ? '—' : formatVnd(latestViewingPrice)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium leading-4 text-slate-500">Giá lẻ (1 đơn vị)</p>
                  <p className="mt-0.5 text-base font-bold leading-5 tabular-nums text-slate-900">{!currentValuations || currentValuations.loading ? 'Đang tính...' : currentValuations.error ? '—' : formatVnd(unitStockValue, 2)}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2.5">
                  <p className="text-[11px] font-medium leading-4 text-slate-600">Giá trị tồn kho</p>
                  <p className="mt-0.5 text-base font-bold leading-5 tabular-nums text-blue-700">{!currentValuations || currentValuations.loading ? 'Đang tính...' : currentValuations.error ? '—' : formatVnd(viewingValuation?.endingValue ?? 0)}</p>
                </div>
              </div>
              {currentValuations?.error && <p role="alert" className="text-xs text-rose-700">{currentValuations.error}</p>}

              <section aria-labelledby="inventory-movement-history" className="rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3 border-l-2 border-blue-600 pl-2">
                  <h4 id="inventory-movement-history" className="text-xs font-bold uppercase tracking-wider text-slate-950">Lịch sử biến động theo chứng từ</h4>
                  <span className="text-[11px] font-semibold text-blue-700">{viewingItemHistory.length} giao dịch</span>
                </div>
              <div className="table-container !border-blue-100 !shadow-none">
                <div className="data-scroll">
                <table className="document-table inventory-history-table w-full min-w-[1100px] table-fixed text-left">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[15%]" />
                    <col className="w-[30%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead>
                    <tr className="table-header">
                      <th className="py-2.5 px-3">Ngày lập</th>
                      <th className="py-2.5 px-3">Loại phiếu</th>
                      <th className="py-2.5 px-3">Mã chứng từ</th>
                      <th className="py-2.5 px-3">Đối tác</th>
                      <th className="py-2.5 px-3 text-right">Số lượng</th>
                      <th className="py-2.5 px-3 text-right">Tồn lũy kế</th>
                      <th className="py-2.5 px-3 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingItemHistory.length > 0 ? (
                      viewingItemHistory.map((h, i) => (
                        <tr key={i} className="table-row">
                          <td className="document-date py-2.5 px-3">{formatDateVN(h.date)}</td>
                          <td className="py-2.5 px-3">
                            {h.type === 'Nhập' ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                                <ArrowDown className="w-3 h-3" /> Nhập
                              </span>
                            ) : h.type === 'Xuất' ? (
                              <span className="text-blue-700 font-semibold flex items-center gap-1 text-[11px]">
                                <ArrowUp className="w-3 h-3" /> Xuất
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold flex items-center gap-1 text-[11px]">
                                <History className="w-3 h-3" /> Kiểm kê
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="document-code">{h.voucherCode}</span>
                          </td>
                          <td className="py-2.5 px-3 leading-5 text-slate-700 whitespace-normal break-words">{h.partnerName || '—'}</td>
                          <td className="whitespace-nowrap py-2.5 px-3 text-right font-semibold tabular-nums text-slate-900">{h.quantity.toLocaleString('vi-VN')}</td>
                          <td className="whitespace-nowrap py-2.5 px-3 text-right font-semibold tabular-nums text-blue-700">{h.balance.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 text-center"><button type="button" onClick={() => openDocumentDetail(h.type, h.voucherCode)} className="ui-button-secondary ui-button-sm"><Eye className="size-3.5" />Xem</button></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">
                          Chưa ghi nhận biến động tại {selectedWarehouseName.toLocaleLowerCase('vi-VN')} cho sản phẩm này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
              </section>
            </div>

            <div className="p-3 border-t border-slate-100 flex justify-end bg-slate-50 px-5">
              <Button variant="secondary" onClick={() => { setViewingDocument(null); setViewingItem(null); }}>Đóng</Button>
            </div>
          </div>
        </div>
      )}

      {viewingDocument && (() => {
        const document = viewingDocument.data;
        const isCheck = viewingDocument.type === 'Kiểm kê';
        const date = isCheck ? (document as InventoryCheck).to_date : (document as GoodsReceipt | GoodsIssue).order_date;
        const partner = isCheck ? (document as InventoryCheck).user_name : (document as GoodsReceipt | GoodsIssue).partner_name;
        const status = isCheck
          ? ({ InProgress: 'Đang thực hiện', Completed: 'Đã hoàn tất', Cancelled: 'Đã hủy' }[(document as InventoryCheck).check_status])
          : viewingDocument.type === 'Nhập'
            ? ({ Pending: 'Chờ duyệt', Confirmed: 'Đã xác nhận', Rejected: 'Đã từ chối' }[(document as GoodsReceipt).receipt_status])
            : ({ Pending: 'Chờ duyệt', Confirmed: 'Đã hoàn tất', Rejected: 'Đã từ chối' }[(document as GoodsIssue).issue_status]);
        const detailRows = isCheck
          ? (document as InventoryCheck).details.map(detail => ({ code: detail.item_code, name: detail.item_name, bin: detail.bin_description, quantity: detail.actual_quantity, note: `Sổ sách: ${detail.book_quantity.toLocaleString('vi-VN')} · Chênh lệch: ${detail.discrepancy.toLocaleString('vi-VN')}` }))
          : (document as GoodsReceipt | GoodsIssue).items.map(detail => ({ code: detail.item_code, name: detail.item_name, bin: detail.bin_description, quantity: detail.quantity_ordered, note: `Đơn giá: ${detail.unit_price.toLocaleString('vi-VN')} đ` }));
        return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="stock-document-detail-title" className="ui-dialog flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 bg-slate-900 px-5 py-4 text-white">
              <div className="flex min-w-0 items-center gap-3"><FileText className="size-5 shrink-0 text-blue-400" /><h2 id="stock-document-detail-title" className="font-bold">Chi tiết phiếu {viewingDocument.type.toLocaleLowerCase('vi-VN')} – {document.code}</h2></div>
              <button type="button" aria-label="Đóng chi tiết chứng từ" onClick={() => setViewingDocument(null)} className="rounded-md p-1 text-slate-300 hover:bg-slate-800 hover:text-white"><X className="size-5" /></button>
            </div>
            <dl className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-xs text-slate-500">Ngày chứng từ</dt><dd className="date-value mt-1 font-semibold">{formatDateVN(date)}</dd></div>
              <div><dt className="text-xs text-slate-500">Kho hàng</dt><dd className="mt-1 font-semibold">{document.warehouse_name || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">{isCheck ? 'Người kiểm kê' : 'Đối tác'}</dt><dd className="mt-1 font-semibold">{partner || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Trạng thái</dt><dd className="mt-1"><StatusBadge tone={status.includes('Đã') ? 'success' : 'warning'}>{status}</StatusBadge></dd></div>
            </dl>
            <div className="overflow-auto p-5"><table className="document-table w-full min-w-[680px] table-fixed border-collapse text-left"><colgroup><col className="w-[16%]" /><col className="w-[29%]" /><col className="w-[25%]" /><col className="w-[12%]" /><col className="w-[18%]" /></colgroup><thead className="table-header"><tr><th className="px-3 py-2.5">Mã sản phẩm</th><th className="px-3 py-2.5">Tên sản phẩm</th><th className="px-3 py-2.5">Vị trí</th><th className="px-3 py-2.5 text-right">Số lượng</th><th className="px-3 py-2.5">Thông tin</th></tr></thead><tbody className="divide-y divide-slate-100">{detailRows.map((detail, index) => <tr key={`${detail.code || 'item'}-${index}`} className="table-row"><td className="px-3 py-3"><span className="document-code">{detail.code || '—'}</span></td><td className="px-3 py-3 font-medium text-slate-900">{detail.name || '—'}</td><td className="px-3 py-3 leading-5 text-slate-700">{detail.bin || '—'}</td><td className="document-count px-3 py-3 text-right tabular-nums">{detail.quantity.toLocaleString('vi-VN')}</td><td className="px-3 py-3 leading-5 text-slate-600">{detail.note}</td></tr>)}</tbody></table></div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3"><Button variant="secondary" onClick={() => setViewingDocument(null)}>Đóng</Button></div>
          </div>
        </div>;
      })()}
    </div>
  );
}
