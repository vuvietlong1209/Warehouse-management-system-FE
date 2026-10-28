'use client';

import { ShortDateField } from '@/components/short-date-field';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, ClipboardCheck, Plus, Save, Trash2 } from 'lucide-react';
import { DocumentCreateShell } from '@/components/document-create-shell';
import { SearchableSelect } from '@/components/searchable-select';
import { Button, RequiredMark } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useFeedback } from '@/context/FeedbackContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { useDocumentSubmission } from '@/lib/use-document-submission';
import type { InventoryCheckDetail } from '@/types/warehouse';

type CheckLine = {
  item_id: number;
  bin_id: number;
  actual_quantity: number;
};

const today = () => new Date().toISOString().split('T')[0];
const checkCode = () => `KK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

export default function CreateInventoryCheckPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { confirmAction, notify } = useFeedback();
  const {
    warehouses: catalogWarehouses,
    items: catalogItems,
    bins: catalogBins,
    units,
    addInventoryCheck,
    completeInventoryCheck,
    getItemStock: liveStockReader,
  } = useWarehouse();
  const submission = useDocumentSubmission(liveStockReader);
  const { submitting, getItemStock } = submission;
  const activeUnitIds = useMemo(() => new Set(units.filter(unit => unit.status).map(unit => unit.id)), [units]);
  const warehouses = useMemo(() => catalogWarehouses.filter(warehouse => warehouse.status), [catalogWarehouses]);
  const warehouseIds = useMemo(() => new Set(warehouses.map(warehouse => warehouse.id)), [warehouses]);
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
  const [code, setCode] = useState(checkCode);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [warehouseId, setWarehouseId] = useState(firstWarehouseId);
  const [description, setDescription] = useState('');
  const [checkDetails, setCheckDetails] = useState<CheckLine[]>([
    { item_id: items[0]?.id || 1, bin_id: firstBinId, actual_quantity: 0 },
  ]);

  const totals = useMemo(() => checkDetails.reduce((result, line) => {
    const book = getItemStock(line.item_id, line.bin_id);
    const actual = Number(line.actual_quantity) || 0;
    return { book: result.book + book, actual: result.actual + actual, difference: result.difference + actual - book };
  }, { book: 0, actual: 0, difference: 0 }), [checkDetails, getItemStock]);

  const changeWarehouse = (nextWarehouseId: number) => {
    setWarehouseId(nextWarehouseId);
    const nextBin = bins.find(bin => bin.warehouse_id === nextWarehouseId);
    if (nextBin) setCheckDetails(previous => previous.map(line => ({ ...line, bin_id: nextBin.id })));
  };

  const changeLine = (index: number, field: keyof CheckLine, value: number) => {
    setCheckDetails(previous => previous.map((line, lineIndex) => (
      lineIndex === index ? { ...line, [field]: value } : line
    )));
  };

  const addLine = () => {
    setCheckDetails(previous => [...previous, {
      item_id: items[0]?.id || 1,
      bin_id: bins.find(bin => bin.warehouse_id === warehouseId)?.id || 1,
      actual_quantity: 0,
    }]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || checkDetails.length === 0) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const approveImmediately = submitter?.value === 'approve';
    if (fromDate > toDate) {
      notify({ tone: 'warning', title: 'Khoảng thời gian chưa hợp lệ', message: 'Ngày bắt đầu kiểm kê phải nhỏ hơn hoặc bằng ngày kết thúc.' });
      return;
    }
    if (!submission.begin()) return;
    try {
      if (approveImmediately) {
        const accepted = await confirmAction({
          title: 'Lưu và hoàn tất phiếu kiểm kê?',
          message: `${code}\nHoàn tất ngay và cập nhật chênh lệch vào tồn kho.`,
          confirmLabel: 'Lưu và hoàn tất',
          tone: 'warning',
        });
        if (!accepted) return;
      }

      const details: InventoryCheckDetail[] = checkDetails.map((line, index) => {
        const bookQuantity = getItemStock(line.item_id, line.bin_id);
        const item = items.find(value => value.id === line.item_id);
        const bin = bins.find(value => value.id === line.bin_id);
        return {
          id: Date.now() + index,
          inventory_check_id: 0,
          check_detail_code: `KKCT-${index + 1}`,
          item_id: line.item_id,
          item_code: item?.code,
          item_name: item?.name,
          bin_id: line.bin_id,
          bin_description: bin?.description,
          book_quantity: bookQuantity,
          actual_quantity: Number(line.actual_quantity),
          discrepancy: Number(line.actual_quantity) - bookQuantity,
          discrepancy_handled: false,
        };
      });

      const result = await addInventoryCheck({
        code,
        from_date: fromDate,
        to_date: toDate,
        warehouse_id: warehouseId,
        user_id: user!.id,
        description,
        check_status: 'InProgress',
        status: true,
        details,
      }, { deferSync: approveImmediately });
      if (!result.success) throw new Error(result.message || 'Không thể lưu phiếu kiểm kê');
      if (approveImmediately) {
        if (!result.icId) {
          notify({ tone: 'warning', title: 'Đã lưu nhưng chưa thể hoàn tất', message: `${code} vẫn đang thực hiện vì hệ thống chưa nhận được mã phiếu vừa tạo.` });
          submission.navigate(() => router.push('/documents/inventory-checks'));
          return;
        }
        let confirmation = await completeInventoryCheck(result.icId);
        if (confirmation.code === 'RESERVATION_RELEASE_REQUIRED' && await confirmAction({ title: 'Giải phóng hàng giữ vượt tồn kiểm kê?', message: 'Chốt đúng tồn thực tế và giải phóng phần giữ bị thiếu, ưu tiên phân bổ mới nhất. Đơn bán vẫn giữ lượng còn phải giao.', confirmLabel: 'Xác nhận và hoàn tất', tone: 'warning' })) {
          confirmation = await completeInventoryCheck(result.icId, true);
        }
        if (!confirmation.success) {
          notify({ tone: 'warning', title: 'Đã lưu nhưng chưa thể hoàn tất', message: `${code} vẫn đang ở trạng thái đang thực hiện. ${confirmation.message || 'Vui lòng hoàn tất lại từ danh sách chứng từ.'}` });
          submission.navigate(() => router.push('/documents/inventory-checks'));
          return;
        }
        notify({ tone: 'success', title: 'Đã lưu và hoàn tất kiểm kê', message: `${code} đã cập nhật chênh lệch vào tồn kho.` });
      } else {
        notify({ tone: 'success', title: 'Đã tạo phiếu kiểm kê', message: `${code} đang ở trạng thái đang thực hiện.` });
      }
      submission.navigate(() => router.push('/documents/inventory-checks'));
    } catch (error) {
      notify({ tone: 'error', title: 'Không thể lưu phiếu kiểm kê', message: error instanceof Error ? error.message : 'Vui lòng kiểm tra lại thông tin kiểm kê.' });
    } finally {
      submission.finish();
    }
  };

  return (
    <DocumentCreateShell
      busy={submitting}
      backHref="/documents/inventory-checks"
      title="Lập phiếu kiểm kê kho"
      statusLabel="Phiếu mới · Đang thực hiện"
      summary={(
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ClipboardCheck className="size-5" /></span>
            <p className="text-sm font-bold text-slate-900">Tổng hợp kiểm kê</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Số mặt hàng</dt><dd className="font-semibold text-slate-900">{checkDetails.length}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Tồn sổ sách</dt><dd className="font-semibold tabular-nums text-slate-900">{totals.book.toLocaleString('vi-VN')}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Tồn thực tế</dt><dd className="font-semibold tabular-nums text-blue-700">{totals.actual.toLocaleString('vi-VN')}</dd></div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold text-slate-700">Tổng chênh lệch</dt><dd className={`text-xl font-bold tabular-nums ${totals.difference > 0 ? 'text-emerald-600' : totals.difference < 0 ? 'text-rose-600' : 'text-slate-500'}`}>{totals.difference > 0 ? '+' : ''}{totals.difference.toLocaleString('vi-VN')}</dd></div>
          </dl>
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <Button type="submit" form="create-inventory-check-form" name="submissionMode" value="pending" disabled={submitting} className="w-full"><Save className="size-4" />{submitting ? 'Đang xử lý...' : 'Lưu phiếu kiểm kê'}</Button>
            <Button type="submit" form="create-inventory-check-form" name="submissionMode" value="approve" variant="success" disabled={submitting} className="w-full"><BadgeCheck className="size-4" />Lưu và duyệt ngay</Button>
            <Button variant="secondary" className="w-full" onClick={() => router.push('/documents/inventory-checks')}>Hủy và quay lại</Button>
          </div>
        </div>
      )}
    >
      <form id="create-inventory-check-form" onSubmit={submit}>
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
          <ClipboardCheck className="size-5 text-blue-600" />
          <h2 className="font-bold text-slate-900">Thông tin kiểm kê</h2>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div><label htmlFor="check-code" className="form-label">Mã phiếu kiểm kê<RequiredMark /></label><input id="check-code" value={code} onChange={event => setCode(event.target.value)} className="form-control font-semibold" required /></div>
            <div><label htmlFor="check-from-date" className="form-label">Từ ngày<RequiredMark /></label><ShortDateField id="check-from-date" label="Từ ngày" value={fromDate} onChange={setFromDate}  max={toDate} required /></div>
            <div><label htmlFor="check-to-date" className="form-label">Đến ngày<RequiredMark /></label><ShortDateField id="check-to-date" label="Đến ngày" value={toDate} onChange={setToDate} min={fromDate}  required /></div>
            <div><label htmlFor="check-warehouse" className="form-label">Kho kiểm kê<RequiredMark /></label><SearchableSelect id="check-warehouse" label="Kho kiểm kê" value={warehouseId} onChange={value => changeWarehouse(Number(value))} options={warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name, searchText: warehouse.code }))} required /></div>
            <div className="md:col-span-1 xl:col-span-2"><label htmlFor="check-description" className="form-label">Ghi chú kiểm kê</label><input id="check-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Lý do hoặc ghi chú..." className="form-control" /></div>
          </div>

          <section className="border-t border-slate-200 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-900">Bảng đối chiếu tồn kho</h3>
              <Button variant="secondary" size="sm" onClick={addLine}><Plus className="size-4" />Thêm sản phẩm</Button>
            </div>

            <div className="space-y-2">
              {checkDetails.map((line, index) => {
                const bookQuantity = getItemStock(line.item_id, line.bin_id);
                const difference = Number(line.actual_quantity) - bookQuantity;
                return (
                  <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(160px,1.65fr)_minmax(145px,1.25fr)_95px_95px_95px_32px] xl:items-end">
                    <div className="min-w-0"><label htmlFor={`check-item-${index}`} className="form-label !mb-1 !text-[11px] !leading-4">Sản phẩm<RequiredMark /></label><SearchableSelect id={`check-item-${index}`} label={`Sản phẩm dòng ${index + 1}`} value={line.item_id} onChange={value => changeLine(index, 'item_id', Number(value))} options={items.map(item => ({ value: item.id, label: `${item.code} - ${item.name}` }))} className="!min-h-8 !px-2 !text-xs" required /></div>
                    <div className="min-w-0"><label htmlFor={`check-bin-${index}`} className="form-label !mb-1 !text-[11px] !leading-4">Vị trí (Bin)<RequiredMark /></label><SearchableSelect id={`check-bin-${index}`} label={`Vị trí dòng ${index + 1}`} value={line.bin_id} onChange={value => changeLine(index, 'bin_id', Number(value))} options={bins.filter(bin => bin.warehouse_id === warehouseId).map(bin => ({ value: bin.id, label: `BIN-${bin.location_id}: ${bin.description}` }))} className="!min-h-8 !px-2 !text-xs" searchPlaceholder="Tìm theo mã hoặc mô tả vị trí..." required /></div>
                    <div><span className="form-label !mb-1 !text-[11px] !leading-4">Tồn sổ sách</span><output className="flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold tabular-nums text-slate-800">{bookQuantity.toLocaleString('vi-VN')}</output></div>
                    <div><label htmlFor={`check-actual-${index}`} className="form-label whitespace-nowrap !mb-1 !text-[11px] !leading-4">Tồn thực tế<RequiredMark /></label><input id={`check-actual-${index}`} type="number" min="0" value={line.actual_quantity} onFocus={event => event.currentTarget.select()} onChange={event => changeLine(index, 'actual_quantity', Number(event.target.value))} className="form-control !min-h-8 !px-2 text-center !text-xs font-bold !text-blue-700" required /></div>
                    <div><span className="form-label !mb-1 !text-[11px] !leading-4">Chênh lệch</span><output className={`flex min-h-8 items-center justify-center rounded-lg border px-2 text-xs font-bold tabular-nums ${difference > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : difference < 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-500'}`}>{difference > 0 ? '+' : ''}{difference.toLocaleString('vi-VN')}</output></div>
                    <div className="flex justify-end sm:col-span-2 xl:col-span-1"><button type="button" aria-label={`Xóa dòng kiểm kê số ${index + 1}`} disabled={checkDetails.length === 1} onClick={() => setCheckDetails(previous => previous.filter((_, lineIndex) => lineIndex !== index))} className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="size-4" /></button></div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </form>
    </DocumentCreateShell>
  );
}
