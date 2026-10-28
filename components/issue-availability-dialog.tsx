'use client';

import { FilterSelect } from '@/components/filter-select';
import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, Search, X } from 'lucide-react';
import { BaseUnit, Bin, Item, Warehouse } from '@/types/warehouse';
import { matchesDocumentSearch } from '@/components/document-filters';
import { Button, WholeRowViewport } from '@/components/ui';

export type SelectedIssueItem = {
  itemId: number;
  binId: number;
  warehouseId: number;
};

export function IssueAvailabilityDialog({
  items,
  bins,
  warehouses,
  units,
  getItemStock,
  getItemAvailableStock,
  initialWarehouseId,
  actionLabel = 'Lập đơn xuất',
  onUseSelection,
  onClose,
}: {
  items: Item[];
  bins: Bin[];
  warehouses: Warehouse[];
  units: BaseUnit[];
  getItemStock: (itemId: number, binId?: number) => number;
  getItemAvailableStock?: (itemId: number, binId?: number) => number;
  initialWarehouseId?: number;
  actionLabel?: string;
  onUseSelection: (selection: SelectedIssueItem[]) => void;
  onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ? String(initialWarehouseId) : '');
  const [binId, setBinId] = useState('');
  const [search, setSearch] = useState('');
  const [onlyReady, setOnlyReady] = useState(true);
  const [selected, setSelected] = useState<Map<number, SelectedIssueItem>>(new Map());

  const activeWarehouses = useMemo(() => warehouses.filter(warehouse => warehouse.status), [warehouses]);
  const activeWarehouseIds = useMemo(
    () => new Set(activeWarehouses.map(warehouse => warehouse.id)),
    [activeWarehouses],
  );
  const activeUnitIds = useMemo(() => new Set(units.filter(unit => unit.status).map(unit => unit.id)), [units]);
  const activeItems = useMemo(
    () => items.filter(item => item.status && activeUnitIds.has(item.base_unit_id)),
    [activeUnitIds, items],
  );
  const activeBins = useMemo(
    () => bins.filter(bin => bin.status && activeWarehouseIds.has(bin.warehouse_id)),
    [activeWarehouseIds, bins],
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const binOptions = useMemo(() => activeBins.filter(bin => !warehouseId || bin.warehouse_id === Number(warehouseId)), [activeBins, warehouseId]);
  const rows = useMemo(() => {
    const warehousesById = new Map(activeWarehouses.map(warehouse => [warehouse.id, warehouse]));
    return binOptions.flatMap(bin => {
      if (binId && bin.id !== Number(binId)) return [];
      const warehouse = warehousesById.get(bin.warehouse_id);
      return activeItems.flatMap(item => {
        if (!matchesDocumentSearch(search, item.code, item.name)) return [];
        const stock = getItemStock(item.id, bin.id);
        const available = getItemAvailableStock ? getItemAvailableStock(item.id, bin.id) : stock;
        const ready = available > 0 && item.status && bin.status && Boolean(warehouse?.status);
        if (onlyReady && !ready) return [];
        return [{ item, bin, warehouse, stock, available, ready }];
      });
    });
  }, [activeItems, activeWarehouses, binOptions, binId, getItemStock, getItemAvailableStock, search, onlyReady]);

  const selectedWarehouseId = selected.size ? [...selected.values()][0].warehouseId : null;
  const toggleSelection = (itemId: number, selectedBinId: number, selectedRowWarehouseId: number) => {
    setSelected(previous => {
      const next = new Map(previous);
      const current = next.get(itemId);
      if (current?.binId === selectedBinId) {
        next.delete(itemId);
        return next;
      }
      if (next.size && [...next.values()][0].warehouseId !== selectedRowWarehouseId) return previous;
      next.set(itemId, { itemId, binId: selectedBinId, warehouseId: selectedRowWarehouseId });
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-labelledby="issue-availability-title" className="ui-dialog proposal-dialog flex max-h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="issue-availability-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><PackageCheck className="size-5 text-blue-600" /> Xem xuất kho khả thi</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng màn hình xuất kho khả thi" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="size-5" /></button>
        </div>

        <div className="grid shrink-0 grid-cols-12 gap-2 border-b border-slate-100 px-4 py-3">
          <div className="col-span-12 md:col-span-5">
            <label htmlFor="available-search" className="form-label">Tìm vật tư</label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input id="available-search" className="form-control pl-9" placeholder="Mã hoặc tên sản phẩm..." value={search} onChange={event => setSearch(event.target.value)} /></div>
          </div>
          <div className="col-span-6 md:col-span-3">
            <label htmlFor="available-warehouse" className="form-label">Kho hàng</label>
            <FilterSelect label="Kho hàng xuất khả thi" id="available-warehouse" className="form-control" value={warehouseId} onChange={event => { setWarehouseId(event); setBinId(''); setSelected(new Map()); }}><option value="">Tất cả kho</option>{activeWarehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</FilterSelect>
          </div>
          <div className="col-span-6 md:col-span-4">
            <label htmlFor="available-bin" className="form-label">Vị trí lưu kho</label>
            <FilterSelect label="Vị trí xuất khả thi" id="available-bin" className="form-control" value={binId} onChange={event => setBinId(event)}><option value="">Tất cả vị trí</option>{binOptions.map(bin => <option key={bin.id} value={bin.id}>BIN-{bin.location_id} · {bin.description}{warehouseId ? '' : ` · ${activeWarehouses.find(warehouse => warehouse.id === bin.warehouse_id)?.name || bin.warehouse_name || ''}`}</option>)}</FilterSelect>
          </div>
          <label className="col-span-12 inline-flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" className="size-4 rounded border-slate-300" checked={onlyReady} onChange={event => setOnlyReady(event.target.checked)} /> Chỉ hiện hàng sẵn sàng xuất</label>
        </div>

        <div className="proposal-list-body flex min-h-0 flex-1 flex-col px-4 py-3">
          <p className="mb-3 shrink-0 text-xs text-slate-600" aria-live="polite">Tìm thấy <strong className="text-slate-900">{rows.length}</strong> kết quả theo vật tư và vị trí lưu kho.</p>
          <div className="table-container flex min-h-0 flex-col">
            <WholeRowViewport className="min-h-0 flex-1" label="Danh sách xuất kho khả thi">
              <table className="document-table proposal-table issue-availability-table w-full min-w-[940px] table-fixed border-collapse text-left">
                <colgroup><col className="w-[5%]" /><col className="w-[11%]" /><col className="w-[18%]" /><col className="w-[17%]" /><col className="w-[15%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[9%]" /><col className="w-[9%]" /></colgroup>
                <thead><tr className="table-header"><th className="px-2 py-2.5 text-center">Chọn</th><th className="px-3 py-2.5">Mã sản phẩm</th><th className="px-3 py-2.5">Tên sản phẩm</th><th className="px-3 py-2.5">Vị trí tồn kho</th><th className="px-3 py-2.5">Kho hàng tồn</th><th className="px-3 py-2.5 text-center">Tồn thực tế</th><th className="px-3 py-2.5 text-center">Số lượng giữ chỗ</th><th className="px-3 py-2.5 text-center">Số lượng sẵn sàng xuất</th><th className="px-3 py-2.5 text-center">Kết quả</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">Không có vật tư phù hợp. Hãy đổi bộ lọc hoặc bỏ chọn “Chỉ hiện hàng sẵn sàng xuất”.</td></tr> : rows.map(({ item, bin, warehouse, stock, available, ready }) => {
                    const checked = selected.get(item.id)?.binId === bin.id;
                    const disabled = !ready || (selectedWarehouseId !== null && selectedWarehouseId !== bin.warehouse_id);
                    return (
                    <tr key={`${item.id}-${bin.id}`} className="table-row">
                      <td className="px-2 py-2.5 text-center"><input type="checkbox" aria-label={`Chọn ${item.code} tại BIN-${bin.location_id}`} className="size-4 rounded border-slate-300" checked={checked} disabled={disabled} onChange={() => toggleSelection(item.id, bin.id, bin.warehouse_id)} /></td>
                      <td className="px-3 py-2.5"><span className="document-code">{item.code}</span></td>
                      <td className="break-words px-3 py-2.5 font-medium text-slate-900">{item.name}</td>
                      <td className="break-words px-3 py-2.5"><span className="font-semibold text-slate-700">BIN-{bin.location_id}</span><span className="block text-xs text-slate-500">{bin.description}</span></td>
                      <td className="break-words px-3 py-2.5">{warehouse?.name || bin.warehouse_name || '—'}</td>
                      <td className="proposal-quantity whitespace-nowrap px-3 py-2.5 text-center font-semibold tabular-nums">{stock.toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{(stock - available).toLocaleString('vi-VN')}</td>
                      <td className="proposal-quantity whitespace-nowrap px-3 py-2.5 text-center font-semibold tabular-nums text-blue-700">{available.toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2.5 text-center"><span className={ready ? 'status-badge status-badge-success' : 'status-badge status-badge-neutral'}>{ready ? 'Sẵn sàng xuất' : 'Chưa khả thi'}</span></td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </WholeRowViewport>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-xs font-medium text-slate-600">Đã chọn <strong className="text-slate-900">{selected.size}</strong> sản phẩm{selected.size ? ' trong cùng một kho' : ''}</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Đóng</Button>
            <Button disabled={!selected.size} onClick={() => onUseSelection([...selected.values()])}><PackageCheck className="size-4" />{actionLabel} ({selected.size})</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
