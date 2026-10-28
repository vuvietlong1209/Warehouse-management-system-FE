'use client';

import { ShortDateField } from '@/components/short-date-field';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BadgeCheck, FileText, PackagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { DocumentCreateShell } from '@/components/document-create-shell';
import { SearchableSelect } from '@/components/searchable-select';
import { ReplenishmentDialog, type SelectedReplenishmentItem } from '@/components/replenishment-dialog';
import { Button, RequiredMark } from '@/components/ui';
import { useFeedback } from '@/context/FeedbackContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { useDocumentSubmission } from '@/lib/use-document-submission';
import { DocumentInitialDialog, type InitialDocument } from '@/components/document-initial-dialog';
import { documentApi, documentPath } from '@/lib/document-api';

type ReceiptLine = {
  item_id: number;
  quantity_ordered: number;
  unit_price: number;
  bin_id: number;
};

const today = () => new Date().toISOString().split('T')[0];
const receiptCode = () => `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

export default function CreateGoodsReceiptPage() {
  const router = useRouter();
  const { notify } = useFeedback();
  const {
    warehouses: catalogWarehouses,
    partners: catalogPartners,
    items: catalogItems,
    bins: catalogBins,
    units,
    refreshAll,
    costingMethod,
    getItemStock: liveStockReader,
  } = useWarehouse();
  const submission = useDocumentSubmission(liveStockReader);
  const { submitting, getItemStock } = submission;
  const activeUnitIds = useMemo(() => new Set(units.filter(unit => unit.status).map(unit => unit.id)), [units]);
  const warehouses = useMemo(() => catalogWarehouses.filter(warehouse => warehouse.status), [catalogWarehouses]);
  const warehouseIds = useMemo(() => new Set(warehouses.map(warehouse => warehouse.id)), [warehouses]);
  const partners = useMemo(() => catalogPartners.filter(partner => partner.status), [catalogPartners]);
  const items = useMemo(
    () => catalogItems.filter(item => item.status && activeUnitIds.has(item.base_unit_id)),
    [activeUnitIds, catalogItems],
  );
  const bins = useMemo(
    () => catalogBins.filter(bin => bin.status && warehouseIds.has(bin.warehouse_id)),
    [catalogBins, warehouseIds],
  );

  const firstWarehouseId = warehouses[0]?.id || 1;
  const firstBinId = bins.find(bin => bin.warehouse_id === firstWarehouseId)?.id || bins[0]?.id || 1;
  const [code, setCode] = useState(receiptCode);
  const [orderDate, setOrderDate] = useState(today);
  const [initialValue, setInitialValue] = useState<InitialDocument | null>(null);
  const requestKey=useRef(crypto.randomUUID());
  const [warehouseId, setWarehouseId] = useState(firstWarehouseId);
  const [partnerId, setPartnerId] = useState(partners[0]?.id || 1);
  const [description, setDescription] = useState('');
  const [replenishmentOpen, setReplenishmentOpen] = useState(false);
  const hydratedFromSelection = useRef(false);
  const [lineItems, setLineItems] = useState<ReceiptLine[]>([
    { item_id: items[0]?.id || 1, quantity_ordered: 1, unit_price: 0, bin_id: firstBinId },
  ]);

  const invoiceTotal = useMemo(() => lineItems.reduce(
    (total, line) => total + (Number(line.quantity_ordered) || 0) * (Number(line.unit_price) || 0),
    0,
  ), [lineItems]);
  const totalQuantity = useMemo(() => lineItems.reduce(
    (total, line) => total + (Number(line.quantity_ordered) || 0),
    0,
  ), [lineItems]);
  const binCapacityStates = useMemo(() => {
    const incomingByBin = new Map<number, number>();
    lineItems.forEach(line => incomingByBin.set(
      line.bin_id,
      (incomingByBin.get(line.bin_id) || 0) + (Number(line.quantity_ordered) || 0),
    ));
    return new Map(bins.map(bin => {
      const currentStock = items.reduce((total, item) => total + getItemStock(item.id, bin.id), 0);
      const incoming = incomingByBin.get(bin.id) || 0;
      const maxCapacity = Number(bin.max_capacity) || 5000;
      return [bin.id, {
        currentStock,
        incoming,
        maxCapacity,
        projectedStock: currentStock + incoming,
        overflow: Math.max(0, currentStock + incoming - maxCapacity),
      }];
    }));
  }, [bins, getItemStock, items, lineItems]);
  const capacityWarningCount = useMemo(() => (
    [...binCapacityStates.values()].filter(state => state.overflow > 0).length
  ), [binCapacityStates]);

  useEffect(() => {
    if (hydratedFromSelection.current || !items.length || !warehouses.length || !bins.length) return;
    hydratedFromSelection.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedIds = [...new Set((params.get('items') || '').split(',').map(Number).filter(Number.isInteger))]
      .filter(itemId => items.some(item => item.id === itemId));
    if (!requestedIds.length) return;
    const requestedWarehouseId = Number(params.get('warehouse_id'));
    const targetWarehouseId = warehouses.some(warehouse => warehouse.id === requestedWarehouseId)
      ? requestedWarehouseId
      : warehouses[0].id;
    const targetBin = bins.find(bin => bin.warehouse_id === targetWarehouseId);
    if (!targetBin) return;
    setWarehouseId(targetWarehouseId);
    setLineItems(requestedIds.map(itemId => ({
      item_id: itemId,
      quantity_ordered: 1,
      unit_price: 0,
      bin_id: targetBin.id,
    })));
  }, [bins, items, warehouses]);

  const applyReplenishmentSelection = (selection: SelectedReplenishmentItem[], selectedWarehouseId?: number) => {
    const targetWarehouseId = selectedWarehouseId && warehouses.some(warehouse => warehouse.id === selectedWarehouseId)
      ? selectedWarehouseId
      : warehouseId;
    const targetBin = bins.find(bin => bin.warehouse_id === targetWarehouseId);
    if (!targetBin) return;
    const selectedIds = [...new Set(selection.map(row => row.itemId))]
      .filter(itemId => items.some(item => item.id === itemId));
    if (!selectedIds.length) return;
    const nextLines = selectedIds.map(itemId => ({
      item_id: itemId,
      quantity_ordered: 1,
      unit_price: 0,
      bin_id: targetBin.id,
    }));
    const changingWarehouse = targetWarehouseId !== warehouseId;
    setWarehouseId(targetWarehouseId);
    setLineItems(previous => {
      const hasIncomingSelection = new URLSearchParams(window.location.search).has('items');
      const isPristineDefault = !hasIncomingSelection
        && previous.length === 1
        && previous[0].quantity_ordered === 1
        && previous[0].unit_price === 0;
      const base = changingWarehouse || isPristineDefault ? [] : previous;
      const existingKeys = new Set(base.map(line => `${line.item_id}:${line.bin_id}`));
      return [...base, ...nextLines.filter(line => !existingKeys.has(`${line.item_id}:${line.bin_id}`))];
    });
    setReplenishmentOpen(false);
  };

  const changeWarehouse = (nextWarehouseId: number) => {
    setWarehouseId(nextWarehouseId);
    const nextBin = bins.find(bin => bin.warehouse_id === nextWarehouseId);
    if (nextBin) setLineItems(previous => previous.map(line => ({ ...line, bin_id: nextBin.id })));
  };

  const changeLine = (index: number, field: keyof ReceiptLine, value: number) => {
    setLineItems(previous => previous.map((line, lineIndex) => (
      lineIndex === index ? { ...line, [field]: value } : line
    )));
  };

  const addLine = () => {
    setLineItems(previous => [...previous, {
      item_id: items[0]?.id || 1,
      quantity_ordered: 1,
      unit_price: 0,
      bin_id: bins.find(bin => bin.warehouse_id === warehouseId)?.id || 1,
    }]);
  };

  const makeDocument = (): InitialDocument => ({
    code, order_date: orderDate, warehouse_id: warehouseId, partner_id: partnerId,
    description, request_key: requestKey.current,
    items: lineItems.map(line => ({ ...line, quantity_ordered: Number(line.quantity_ordered), unit_price: Number(line.unit_price) })),
  });
  const persist = async (body: InitialDocument & Record<string, unknown>, approve?: boolean) => {
    if (!submission.begin()) return;
    try {
      await documentApi(documentPath('receipt') + (approve === undefined ? '' : '/initial'), 'POST',
        approve === undefined ? { ...body, items: body.items.map(line => ({ ...line, first_quantity: 0 })) }
          : { ...body, approve_initial: approve, costing_method: costingMethod });
      await refreshAll();
      notify({ tone: 'success', title: approve === undefined ? 'Đã lưu đơn nhập' : approve ? 'Đã lưu và duyệt lần đầu' : 'Đã lưu lần đầu chờ xác nhận' });
      submission.navigate(() => router.push('/documents/goods-receipts'));
    } finally { submission.finish(); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || initialValue || !lineItems.length) return;
    const body = makeDocument();
    if (((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'initial') {
      setInitialValue(body); return;
    }
    try { await persist(body); }
    catch (e) { notify({ tone: 'error', title: 'Không thể lưu đơn nhập', message: (e as Error).message }); }
  };

  return (
    <><div ref={node => { if (node) node.inert = !!initialValue; }} aria-hidden={initialValue ? true : undefined}><DocumentCreateShell
      busy={submitting}
      backHref="/documents/goods-receipts"
      title="Lập đơn nhập"
      statusLabel="Đang thực hiện"
      summary={(
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><PackagePlus className="size-5" /></span>
            <p className="text-sm font-bold text-slate-900">Tổng hợp đơn</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Số mặt hàng</dt><dd className="font-semibold text-slate-900">{lineItems.length}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Tổng số lượng</dt><dd className="font-semibold tabular-nums text-slate-900">{totalQuantity.toLocaleString('vi-VN')}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Vị trí vượt sức chứa</dt><dd className={capacityWarningCount ? 'font-bold text-rose-600' : 'font-semibold text-emerald-600'}>{capacityWarningCount}</dd></div>
            <div className="border-t border-slate-100 pt-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng giá trị đơn</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-blue-700">{invoiceTotal.toLocaleString('vi-VN')} ₫</dd></div>
          </dl>
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <Button type="submit" form="create-goods-receipt-form" name="submissionMode" value="pending" disabled={submitting} className="w-full"><Save className="size-4" />{submitting ? 'Đang xử lý...' : 'Lưu đơn'}</Button>
            <Button type="submit" form="create-goods-receipt-form" name="submissionMode" value="initial" variant="success" disabled={submitting} className="w-full"><BadgeCheck className="size-4" />Lưu và thanh toán</Button>
            <Button variant="secondary" className="w-full" onClick={() => setReplenishmentOpen(true)}><PackagePlus className="size-4" />Xem lượng cần nhập</Button>
            <Button variant="secondary" className="w-full" onClick={() => router.push('/documents/goods-receipts')}>Hủy và quay lại</Button>
          </div>
        </div>
      )}
    >
      <form id="create-goods-receipt-form" onSubmit={submit}>
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
          <FileText className="size-5 text-blue-600" />
          <h2 className="font-bold text-slate-900">Thông tin đơn nhập</h2>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div><label htmlFor="receipt-code" className="form-label">Mã đơn nhập<RequiredMark /></label><input id="receipt-code" value={code} onChange={event => setCode(event.target.value)} className="form-control font-semibold" required /></div>
            <div><label htmlFor="receipt-date" className="form-label">Ngày lập đơn<RequiredMark /></label><ShortDateField id="receipt-date" label="Ngày lập đơn" value={orderDate} onChange={setOrderDate}   required /></div>
            <div><label htmlFor="receipt-warehouse" className="form-label">Kho nhập hàng<RequiredMark /></label><SearchableSelect id="receipt-warehouse" label="Kho nhập hàng" value={warehouseId} onChange={value => changeWarehouse(Number(value))} options={warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name, searchText: warehouse.code }))} required /></div>
            <div className="xl:col-span-2"><label htmlFor="receipt-partner" className="form-label">Nhà cung cấp<RequiredMark /></label><SearchableSelect id="receipt-partner" label="Nhà cung cấp" value={partnerId} onChange={value => setPartnerId(Number(value))} options={partners.map(partner => ({ value: partner.id, label: `${partner.code} - ${partner.name}` }))} required /></div>
            <div><label htmlFor="receipt-description" className="form-label">Ghi chú đơn nhập</label><input id="receipt-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Ghi chú thêm..." className="form-control" /></div>
          </div>

          <section className="border-t border-slate-200 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-900">Danh sách sản phẩm nhập kho</h3>
              <Button variant="secondary" size="sm" onClick={addLine}><Plus className="size-4" />Thêm dòng</Button>
            </div>

            <div className="space-y-2">
              {lineItems.map((line, index) => {
                const capacity = binCapacityStates.get(line.bin_id);
                const isOverCapacity = Boolean(capacity?.overflow);
                return (
                <div key={index} className={`grid grid-cols-1 gap-2 rounded-xl border p-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(160px,1.65fr)_minmax(145px,1.25fr)_80px_115px_125px_32px] xl:items-start ${isOverCapacity ? 'border-rose-300 bg-rose-50/70 ring-2 ring-rose-100' : 'border-slate-200 bg-slate-50/70'}`}>
                  <div className="min-w-0"><label htmlFor={`receipt-item-${index}`} className="form-label !mb-1 !text-[11px] !leading-4">Sản phẩm<RequiredMark /></label><SearchableSelect id={`receipt-item-${index}`} label={`Sản phẩm dòng ${index + 1}`} value={line.item_id} onChange={value => changeLine(index, 'item_id', Number(value))} options={items.map(item => ({ value: item.id, label: `${item.code} - ${item.name}` }))} className="!min-h-8 !px-2 !text-xs" required /></div>
                  <div className="min-w-0"><label htmlFor={`receipt-bin-${index}`} className="form-label !mb-1 !text-[11px] !leading-4">Vị trí (Bin)<RequiredMark /></label><SearchableSelect id={`receipt-bin-${index}`} label={`Vị trí dòng ${index + 1}`} value={line.bin_id} onChange={value => changeLine(index, 'bin_id', Number(value))} options={bins.filter(bin => bin.warehouse_id === warehouseId).map(bin => ({ value: bin.id, label: `BIN-${bin.location_id}: ${bin.description} · Sức chứa ${Number(bin.max_capacity).toLocaleString('vi-VN')}` }))} className={`!min-h-8 !px-2 !text-xs ${isOverCapacity ? '!border-rose-400 !text-rose-700' : ''}`} searchPlaceholder="Tìm theo mã hoặc mô tả vị trí..." required /></div>
                  <div><label htmlFor={`receipt-quantity-${index}`} className="form-label whitespace-nowrap !mb-1 !text-[11px] !leading-4">Lượng yêu cầu<RequiredMark /></label><input id={`receipt-quantity-${index}`} type="number" min="1" value={line.quantity_ordered} onFocus={event => event.currentTarget.select()} onChange={event => changeLine(index, 'quantity_ordered', Number(event.target.value))} className={`form-control !min-h-8 !px-2 text-center !text-xs font-bold ${isOverCapacity ? '!border-rose-400 !text-rose-700' : ''}`} required />{capacity ? <span className={`mt-0.5 block whitespace-nowrap text-center text-[10px] font-medium leading-3 ${isOverCapacity ? 'text-rose-600' : 'text-slate-500'}`}>Sức chứa khả thi còn lại: {Math.max(0, capacity.maxCapacity - capacity.projectedStock).toLocaleString('vi-VN')}</span> : null}</div>
                  <div><label htmlFor={`receipt-price-${index}`} className="form-label whitespace-nowrap !mb-1 !text-[11px] !leading-4">Đơn giá (VND)<RequiredMark /></label><input id={`receipt-price-${index}`} type="number" min="0" value={line.unit_price} onFocus={event => event.currentTarget.select()} onChange={event => changeLine(index, 'unit_price', Number(event.target.value))} className="form-control !min-h-8 !px-2 !text-xs" required /></div>
                  <div><span className="form-label !mb-1 !text-[11px] !leading-4">Thành tiền</span><output className="flex min-h-8 items-center justify-end rounded-lg border border-blue-100 bg-blue-50 px-2 text-xs font-bold tabular-nums text-blue-700">{(line.quantity_ordered * line.unit_price).toLocaleString('vi-VN')} ₫</output></div>
                  <div className="flex justify-end sm:col-span-2 xl:col-span-1 xl:mt-5 xl:justify-center"><button type="button" aria-label={`Xóa dòng nhập số ${index + 1}`} disabled={lineItems.length === 1} onClick={() => setLineItems(previous => previous.filter((_, lineIndex) => lineIndex !== index))} className="inline-flex size-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="size-4" /></button></div>
                  {isOverCapacity && capacity ? <div className="flex items-center gap-2 border-t border-rose-200 pt-2 text-xs font-bold text-rose-600 sm:col-span-2 xl:col-span-6"><AlertTriangle className="size-4 shrink-0" />Vị trí đang có {capacity.currentStock.toLocaleString('vi-VN')}, đơn nhập thêm tổng {capacity.incoming.toLocaleString('vi-VN')}; vượt sức chứa {capacity.maxCapacity.toLocaleString('vi-VN')} là {capacity.overflow.toLocaleString('vi-VN')} đơn vị.</div> : null}
                </div>
                );
              })}
            </div>
          </section>
        </div>
      </form>

      {replenishmentOpen ? <ReplenishmentDialog warehouses={warehouses} initialWarehouseId={warehouseId} actionLabel="Thêm vào đơn" onUseSelection={applyReplenishmentSelection} onClose={() => setReplenishmentOpen(false)} /> : null}
    </DocumentCreateShell></div>
    {initialValue && <DocumentInitialDialog kind="receipt" value={initialValue} names={{
      warehouse: warehouses.find(w => w.id === initialValue.warehouse_id)?.name || '',
      partner: partners.find(p => p.id === initialValue.partner_id)?.name || '',
      items: initialValue.items.map(line => ({ code: items.find(i => i.id === line.item_id)?.code || '', name: items.find(i => i.id === line.item_id)?.name || '', unit: units.find(u => u.id === items.find(i => i.id === line.item_id)?.base_unit_id)?.description || '', bin: bins.filter(b => b.id === line.bin_id).map(b => `${b.location_id} · ${b.description}`).join('') })),
    }} busy={submitting} onClose={() => setInitialValue(null)} onSave={persist} />}</>
  );
}
