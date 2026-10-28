'use client';

import React, { useMemo, useState } from 'react';
import { ShortDateField } from '@/components/short-date-field';
import Link from 'next/link';
import { useWarehouse } from '@/context/WarehouseContext';
import { useAuth } from '@/context/AuthContext';
import { InventoryCheck, InventoryCheckDetail } from '@/types/warehouse';
import { Plus, Printer, Eye, X, ClipboardCheck, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import { useFeedback } from '@/context/FeedbackContext';
import { CatalogPagination, formatDateVN, RequiredMark, WholeRowViewport } from '@/components/ui';
import { DocumentFilters, DocumentFilterValues, emptyDocumentFilters, matchesDocumentSearch } from '@/components/document-filters';
import { BulkDocumentRejection, BulkDocumentResult, DocumentBulkDialog } from '@/components/document-bulk-action';
import { SearchableSelect } from '@/components/searchable-select';

function formatStatusTimestamp(value?: string | null) {
  if (!value) return 'Chưa ghi nhận thời điểm';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} · ${match[4]}:${match[5]}` : value;
}

export default function InventoryChecksPage() {
  const {
    inventoryChecks, warehouses, items, bins, addInventoryCheck, updateInventoryCheck,
    deleteInventoryCheck, completeMultipleInventoryChecks, cancelMultipleInventoryChecks, getItemStock,
  } = useWarehouse();
  const { user } = useAuth();
  const { confirmAction, notify } = useFeedback();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIC, setViewingIC] = useState<InventoryCheck | null>(null);
  const viewingIC = selectedIC ? inventoryChecks.find(document => document.id === selectedIC.id) || null : null;
  const [editingIC, setEditingIC] = useState<InventoryCheck | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkDocumentResult | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [filters, setFilters] = useState<DocumentFilterValues>({ ...emptyDocumentFilters });
  const filteredInventoryChecks = useMemo(() => inventoryChecks.filter(check => {
    const fromDate = check.from_date.slice(0, 10);
    const toDate = check.to_date.slice(0, 10);
    return matchesDocumentSearch(filters.search, check.code, check.warehouse_name, check.user_name, check.description)
      && (!filters.fromDate || toDate >= filters.fromDate)
      && (!filters.toDate || fromDate <= filters.toDate)
      && (!filters.warehouseId || check.warehouse_id === Number(filters.warehouseId))
      && (!filters.status || check.check_status === filters.status);
  }), [inventoryChecks, filters]);
  const totalPages = Math.max(1, Math.ceil(filteredInventoryChecks.length / pageSize));
  const pagedInventoryChecks = filteredInventoryChecks.slice((page - 1) * pageSize, page * pageSize);
  const pendingInventoryChecks = useMemo(() => inventoryChecks.filter(check => check.check_status === 'InProgress'), [inventoryChecks]);

  // Form State
  const [code, setCode] = useState(`KK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [warehouseId, setWarehouseId] = useState<number>(warehouses[0]?.id || 1);
  const [description, setDescription] = useState('');

  // Details lines state
  const [checkDetails, setCheckDetails] = useState<{
    item_id: number;
    bin_id: number;
    actual_quantity: number;
  }[]>([
    { item_id: items[0]?.id || 1, bin_id: bins[0]?.id || 1, actual_quantity: 0 }
  ]);

  const addDetailLine = () => {
    setCheckDetails(prev => [
      ...prev,
      { item_id: items[0]?.id || 1, bin_id: bins.find(b => b.warehouse_id === warehouseId)?.id || 1, actual_quantity: 0 }
    ]);
  };

  const removeDetailLine = (index: number) => {
    setCheckDetails(prev => prev.filter((_, i) => i !== index));
  };

  const handleDetailChange = (index: number, field: string, val: number) => {
    setCheckDetails(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const handleWarehouseChange = (nextWarehouseId: number) => {
    setWarehouseId(nextWarehouseId);
    const firstBin = bins.find(bin => bin.warehouse_id === nextWarehouseId);
    if (firstBin) setCheckDetails(previous => previous.map(line => ({ ...line, bin_id: firstBin.id })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkDetails.length === 0) return;

    const formattedDetails: InventoryCheckDetail[] = checkDetails.map((line, idx) => {
      const bookQty = getItemStock(line.item_id, line.bin_id);
      const discrepancy = line.actual_quantity - bookQty;
      const itemObj = items.find(i => i.id === line.item_id);
      const binObj = bins.find(b => b.id === line.bin_id);

      return {
        id: Date.now() + idx,
        inventory_check_id: 0,
        check_detail_code: `KKCT-${idx + 1}`,
        item_id: line.item_id,
        item_code: itemObj?.code,
        item_name: itemObj?.name,
        bin_id: line.bin_id,
        bin_description: binObj?.description,
        book_quantity: bookQty,
        actual_quantity: Number(line.actual_quantity),
        discrepancy,
        discrepancy_handled: false,
      };
    });

    try {
      const payload = {
        code,
        from_date: fromDate,
        to_date: toDate,
        warehouse_id: warehouseId,
        user_id: user!.id,
        description,
        check_status: 'InProgress' as const,
        status: true,
        details: formattedDetails,
      };
      const result = editingIC
        ? await updateInventoryCheck(editingIC.id, payload)
        : await addInventoryCheck(payload);
      if (!result.success) throw new Error(result.message || 'Không thể lưu phiếu kiểm kê');
      setIsModalOpen(false);
      setEditingIC(null);
      setCode(`KK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`);
      notify({ tone: 'success', title: editingIC ? 'Đã cập nhật phiếu kiểm kê' : 'Đã tạo phiếu kiểm kê', message: `${code} đang ở trạng thái đang thực hiện.` });
    } catch (err: any) {
      notify({ tone: 'error', title: 'Không thể lưu phiếu kiểm kê', message: err.message || 'Vui lòng kiểm tra lại thông tin kiểm kê.' });
    }

  };

  const openEditModal = (ic: InventoryCheck) => {
    setEditingIC(ic);
    setCode(ic.code);
    setFromDate(ic.from_date.slice(0, 10));
    setToDate(ic.to_date.slice(0, 10));
    setWarehouseId(ic.warehouse_id);
    setDescription(ic.description || '');
    setCheckDetails(ic.details.map(detail => ({
      item_id: detail.item_id,
      bin_id: detail.bin_id,
      actual_quantity: Number(detail.actual_quantity),
    })));
    setIsModalOpen(true);
  };

  const handleBulkComplete = async (ids: number[]) => {
    const selected = pendingInventoryChecks.filter(check => ids.includes(check.id)).sort((a, b) => a.to_date.localeCompare(b.to_date) || a.id - b.id);
    if (!selected.length || bulkProcessing) return;
    const accepted = await confirmAction({ title: `Hoàn tất ${selected.length} phiếu kiểm kê?`, message: 'Cập nhật chênh lệch vào tồn kho theo ngày kiểm kê. Phiếu lỗi được bỏ qua và hiển thị lý do.', confirmLabel: 'Hoàn tất phiếu', tone: 'warning' });
    if (!accepted) return;
    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const result = await completeMultipleInventoryChecks(selected.map(check => check.id));
      const reservationConflicts = result.failed.filter(entry => entry.code === 'RESERVATION_RELEASE_REQUIRED');
      if (reservationConflicts.length && await confirmAction({ title: 'Giải phóng phần giữ hàng thiếu sau kiểm kê?', message: `${reservationConflicts.length} phiếu ảnh hưởng hàng đang giữ. Sau xác nhận, hệ thống chốt đúng tồn kiểm kê và giảm phần giữ vượt tồn, ưu tiên phân bổ mới nhất. Đơn bán vẫn giữ lượng còn phải giao.`, confirmLabel: 'Xác nhận và hoàn tất', tone: 'warning' })) {
        const retried = await completeMultipleInventoryChecks(reservationConflicts.map(entry => entry.id), true);
        result.succeeded.push(...retried.succeeded);
        result.failed = [...result.failed.filter(entry => entry.code !== 'RESERVATION_RELEASE_REQUIRED'), ...retried.failed];
      }
      setBulkResult(result);
      notify({ tone: result.failed.length ? (result.succeeded.length ? 'warning' : 'error') : 'success', title: 'Kết quả hoàn tất kiểm kê', message: `Thành công: ${result.succeeded.length} · Không thành công: ${result.failed.length}` });
    } catch (error) {
      notify({ tone: 'error', title: 'Không thể hoàn tất hàng loạt', message: error instanceof Error ? error.message : 'Vui lòng tải lại danh sách để kiểm tra trạng thái phiếu.' });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkCancel = async (rejections: BulkDocumentRejection[]) => {
    const selected = pendingInventoryChecks.filter(check => rejections.some(entry => entry.id === check.id));
    if (!selected.length || bulkProcessing) return;
    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const result = await cancelMultipleInventoryChecks(rejections.filter(entry => selected.some(check => check.id === entry.id)));
      setBulkResult(result);
      notify({ tone: result.failed.length ? (result.succeeded.length ? 'warning' : 'error') : 'success', title: 'Kết quả hủy kiểm kê', message: `Thành công: ${result.succeeded.length} · Không thành công: ${result.failed.length}` });
    } catch (error) {
      notify({ tone: 'error', title: 'Không thể hủy hàng loạt', message: error instanceof Error ? error.message : 'Vui lòng tải lại danh sách để kiểm tra trạng thái phiếu.' });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDelete = async (ic: InventoryCheck) => {
    if (bulkProcessing) return;
    const accepted = await confirmAction({ title: 'Xóa phiếu kiểm kê?', message: `${ic.code}\nPhiếu đang thực hiện sẽ bị xóa. Không thể hoàn tác.`, confirmLabel: 'Xóa phiếu', tone: 'danger' });
    if (!accepted) return;
    const result = await deleteInventoryCheck(ic.id);
    if (!result.success) notify({ tone: 'error', title: 'Không thể xóa phiếu kiểm kê', message: result.message });
    else notify({ tone: 'success', title: 'Đã xóa phiếu kiểm kê', message: ic.code });
  };

  const handlePrint = (ic: InventoryCheck) => {
    setViewingIC(ic);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="catalog-page document-list-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <h1 className="page-title">Kiểm kê kho</h1>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setBulkResult(null); setBulkDialogOpen(true); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50"><CheckCircle2 className="size-4" />Xử lý kiểm kê</button>
          <Link href="/documents/inventory-checks/create" className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"><Plus className="size-3.5" /><span>Tạo phiếu kiểm kê</span></Link>
        </div>
      </div>

      <DocumentFilters
        idPrefix="check-filter"
        filters={filters}
        onApply={next => { setFilters(next); setPage(1); }}
        warehouses={warehouses}
        warehouseLabel="Kho kiểm kê"
        searchPlaceholder="Mã phiếu, kho hoặc người lập..."
        statuses={[{ value: 'InProgress', label: 'Đang thực hiện' }, { value: 'Completed', label: 'Đã hoàn tất' }, { value: 'Cancelled', label: 'Đã hủy' }]}
      />

      {/* IC Table */}
      <div className="table-container">
        <WholeRowViewport className="min-h-0 flex-1">
          <table className="document-table w-full min-w-[1180px] table-fixed text-left border-collapse">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[17%]" />
              <col className="w-[21%]" />
              <col className="w-[13%]" />
              <col className="w-[7%]" />
              <col className="w-[13%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead>
              <tr className="table-header">
                <th className="py-2.5 px-4 whitespace-nowrap">Mã phiếu</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Thời gian kiểm kê</th>
                <th className="py-2.5 px-4">Kho kiểm kê</th>
                <th className="py-2.5 px-4">Người kiểm kê</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Số mặt hàng</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Trạng thái</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventoryChecks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    {inventoryChecks.length === 0 ? 'Chưa có biên bản kiểm kê nào. Hãy bấm “Tạo phiếu kiểm kê” để bắt đầu.' : 'Không tìm thấy phiếu kiểm kê phù hợp với bộ lọc.'}
                  </td>
                </tr>
              ) : (
                pagedInventoryChecks.map(ic => (
                  <tr key={ic.id} className="table-row">
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="document-code">
                        {ic.code}
                      </span>
                    </td>
                    <td className="document-date py-2.5 px-4">
                      {formatDateVN(ic.from_date)} → {formatDateVN(ic.to_date)}
                    </td>
                    <td className="py-2.5 px-4 font-medium leading-5 text-slate-800 whitespace-normal break-words">
                      {ic.warehouse_name}
                    </td>
                    <td className="py-2.5 px-4 font-medium leading-5 text-slate-700 whitespace-normal break-words">
                      {ic.user_name || 'Admin User'}
                    </td>
                    <td className="document-count py-2.5 px-3 text-center">
                      {ic.details.length} món
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`document-status ${ic.check_status === 'Completed' ? 'text-emerald-700' : ic.check_status === 'InProgress' ? 'text-amber-700' : 'text-slate-500'}`}>
                        {ic.check_status === 'Completed' ? 'Đã hoàn tất' : ic.check_status === 'InProgress' ? 'Đang thực hiện' : 'Đã hủy'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingIC(ic)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-md transition-colors shadow-2xs"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem</span>
                        </button>
                        {ic.check_status === 'InProgress' && (
                          <>
                            <button aria-label={`Sửa phiếu ${ic.code}`} onClick={() => openEditModal(ic)} className="p-1.5 text-slate-500 hover:text-blue-700" title="Sửa"><Pencil className="w-3.5 h-3.5" /></button>
                            <button aria-label={`Xóa phiếu ${ic.code}`} onClick={() => handleDelete(ic)} className="p-1.5 text-rose-600 hover:text-rose-800" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        <button
                          onClick={() => handlePrint(ic)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-md transition-colors shadow-2xs"
                          title="In phiếu A4"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>In</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </WholeRowViewport>

        {/* Table footer */}
        <div className="p-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/50 px-4">
          <span>Hiển thị {filteredInventoryChecks.length} / {inventoryChecks.length} phiếu kiểm kê</span>
          <span className="font-semibold text-slate-600">Quản lý kiểm kê</span>
        </div>
      </div>

      <CatalogPagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />

      {bulkDialogOpen && <DocumentBulkDialog title="Xử lý phiếu kiểm kê" rows={pendingInventoryChecks.map(check => ({ id: check.id, code: check.code, date: check.to_date, warehouse: check.warehouse_name || '', partner: check.user_name || '' }))} partnerLabel="Người kiểm kê" approveLabel="Hoàn tất" rejectLabel="Hủy phiếu" processing={bulkProcessing} result={bulkResult} onApprove={handleBulkComplete} onReject={handleBulkCancel} onView={id => { const check = pendingInventoryChecks.find(value => value.id === id); if (check) { setBulkDialogOpen(false); setViewingIC(check); } }} onClose={() => setBulkDialogOpen(false)} />}

      {/* Edit in-progress inventory check modal. Creation uses a dedicated page. */}
      {isModalOpen && editingIC && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="inventory-check-dialog-title" className="ui-dialog document-edit-dialog bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <h2 id="inventory-check-dialog-title" className="font-bold text-lg flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-400" />
                Chỉnh sửa phiếu kiểm kê
              </h2>
              <button aria-label="Đóng biểu mẫu kiểm kê" onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="ic-code" className="form-label">Mã phiếu kiểm kê<RequiredMark /></label>
                  <input
                    id="ic-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="form-control font-semibold"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ic-from-date" className="form-label">Từ ngày<RequiredMark /></label>
                  <ShortDateField id="ic-from-date" label="Từ ngày" value={fromDate} onChange={setFromDate}   required />
                </div>
                <div>
                  <label htmlFor="ic-to-date" className="form-label">Đến ngày<RequiredMark /></label>
                  <ShortDateField id="ic-to-date" label="Đến ngày" value={toDate} onChange={setToDate}   required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ic-warehouse" className="form-label">Kho kiểm kê<RequiredMark /></label>
                  <SearchableSelect
                    id="ic-warehouse"
                    label="Kho kiểm kê"
                    value={warehouseId}
                    onChange={value => handleWarehouseChange(Number(value))}
                    options={warehouses.map(w => ({ value: w.id, label: w.name, searchText: w.code }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ic-description" className="form-label">Ghi chú kiểm kê</label>
                  <input
                    id="ic-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Lý do hoặc ghi chú..."
                    className="form-control"
                  />
                </div>
              </div>

              {/* Line Items for Inventory Check */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 text-sm">Bảng đối chiếu Tồn sổ sách vs Tồn thực tế</h4>
                  <button
                    type="button"
                    onClick={addDetailLine}
                    className="ui-button-secondary ui-button-sm text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm sản phẩm
                  </button>
                </div>

                <div className="space-y-3">
                  {checkDetails.map((line, idx) => {
                    const bookQty = getItemStock(line.item_id, line.bin_id);
                    const diff = line.actual_quantity - bookQty;

                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                        <div className="col-span-4">
                          <label htmlFor={`ic-item-${idx}`} className="form-label">Sản phẩm<RequiredMark /></label>
                          <SearchableSelect
                            id={`ic-item-${idx}`}
                            label={`Sản phẩm dòng ${idx + 1}`}
                            value={line.item_id}
                            onChange={value => handleDetailChange(idx, 'item_id', Number(value))}
                            options={items.map(it => ({ value: it.id, label: `${it.code} - ${it.name}` }))}
                            className="!min-h-8 !px-2 !text-xs !border-slate-200"
                            required
                          />
                        </div>

                        <div className="col-span-3">
                          <label htmlFor={`ic-bin-${idx}`} className="form-label">Vị trí (Bin)<RequiredMark /></label>
                          <SearchableSelect
                            id={`ic-bin-${idx}`}
                            label={`Vị trí dòng ${idx + 1}`}
                            value={line.bin_id}
                            onChange={value => handleDetailChange(idx, 'bin_id', Number(value))}
                            options={bins.filter(b => b.warehouse_id === warehouseId).map(b => ({ value: b.id, label: `BIN-${b.location_id}: ${b.description}` }))}
                            className="!min-h-8 !px-2 !text-xs !border-slate-200"
                            searchPlaceholder="Tìm theo mã hoặc mô tả vị trí..."
                            required
                          />
                        </div>

                        <div className="col-span-2 text-center">
                          <label className="form-label">Tồn sổ sách</label>
                          <output className="flex h-8 items-center justify-center font-bold text-slate-800 text-sm">{bookQty}</output>
                        </div>

                        <div className="col-span-2">
                          <label htmlFor={`ic-actual-${idx}`} className="form-label">Tồn thực tế<RequiredMark /></label>
                          <input
                            id={`ic-actual-${idx}`}
                            type="number"
                            value={line.actual_quantity}
                            onChange={(e) => handleDetailChange(idx, 'actual_quantity', Number(e.target.value))}
                            className="form-control !min-h-8 !px-2 !text-xs text-center font-bold text-blue-600"
                          />
                        </div>

                        <div className="col-span-1 mt-5 flex justify-end">
                          <button aria-label={`Xóa dòng kiểm kê số ${idx + 1}`} type="button" onClick={() => removeDetailLine(idx)} className="flex h-8 w-8 items-center justify-center text-rose-500 hover:text-rose-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="col-span-12 text-xs font-semibold flex items-center justify-between pt-1 border-t border-slate-200 text-slate-600">
                          <span>Chênh lệch:</span>
                          <span className={`font-bold ${diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diff > 0 ? `+${diff}` : diff} sản phẩm
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="ui-button-secondary">Hủy</button>
                <button type="submit" className="ui-button-primary">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable PDF Drawer/Modal - Mẫu số 03 - VT (Thông tư 200/2014/TT-BTC) */}
      {viewingIC && (() => {
        const toDateObj = new Date(viewingIC.to_date);
        const documentDate = isNaN(toDateObj.getTime()) ? 'Chưa có ngày chứng từ'
          : `${String(toDateObj.getUTCDate()).padStart(2, '0')}/${String(toDateObj.getUTCMonth() + 1).padStart(2, '0')}/${String(toDateObj.getUTCFullYear()).padStart(4, '0')}`;

        const totalBook = viewingIC.details.reduce((s, d) => s + d.book_quantity, 0);
        const totalActual = viewingIC.details.reduce((s, d) => s + d.actual_quantity, 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="ui-dialog ui-print-dialog bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[95vh] flex flex-col">
              <div className="ui-dialog-header flex flex-wrap items-center justify-between gap-2 no-print">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Xem & In Biên Bản Kiểm Kê (Mẫu số 03 - VT)</span>
                  <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white font-medium">Chuẩn TT 200/2014/TT-BTC</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="ui-button-primary ui-button-sm">
                    <Printer className="w-4 h-4" /> In Biên Bản (A4)
                  </button>
                  <button aria-label="Đóng bản xem phiếu kiểm kê" onClick={() => setViewingIC(null)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </div>
              </div>

              {viewingIC.check_status === 'Cancelled' && (
                <div className="no-print border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs text-slate-700">
                  <span className="font-semibold">Ngày hủy:</span>{' '}
                  {formatStatusTimestamp(viewingIC.cancelled_at)}
                </div>
              )}

              {/* Printable Content Area */}
              <div className="p-8 sm:p-10 overflow-y-auto printable-area bg-white text-black text-[13px] leading-relaxed space-y-3">
                {/* Header Top Section (No Logo - Clean Image 2 style) */}
                <div className="flex justify-between items-start border-b border-black pb-2">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="font-bold text-sm text-black uppercase">
                      ĐƠN VỊ: BỘ PHẬN QUẢN LÝ KHO & TỒN KHO
                    </p>
                    <p className="text-xs text-black">
                      Nhiệm vụ: Kiểm kê thực tế & Đối soát tồn kho định kỳ
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold">Mẫu số: 03 - VT</p>
                    <p className="italic text-[11px] text-gray-600">(TT 200/2014/TT-BTC)</p>
                  </div>
                </div>

                {/* Title & Time */}
                <div className="text-center pt-2 pb-1">
                  <h1 className="text-xl font-bold uppercase text-black tracking-normal">
                    BIÊN BẢN KIỂM KÊ VẬT TƯ, CÔNG CỤ, SẢN PHẨM, HÀNG HOÁ
                  </h1>
                  <p className="italic text-xs text-black mt-0.5">
                    Thời điểm kiểm kê: 17 giờ 00 ngày {documentDate}
                  </p>
                  <p className="text-xs text-black mt-0.5">
                    Số chứng từ: <span className="font-semibold">{viewingIC.code}</span>
                  </p>
                </div>

                {/* Committee & Location Details */}
                <div className="space-y-1 text-xs pt-1 text-black">
                  <p>- Ban kiểm kê gồm có:</p>
                  <div className="grid grid-cols-2 gap-x-4 pl-4 text-xs">
                    <p>1. Ông/Bà: <span className="font-semibold">{viewingIC.user_name || 'Nguyễn Văn A'}</span> - Chức vụ: <span className="italic">Trưởng ban kiểm kê</span></p>
                    <p>2. Ông/Bà: <span className="font-semibold">Trần Thị B</span> - Chức vụ: <span className="italic">Thủ kho</span></p>
                    <p>3. Ông/Bà: <span className="font-semibold">Phạm Văn C</span> - Chức vụ: <span className="italic">Kế toán kho</span></p>
                    <p>4. Ông/Bà: <span className="font-semibold">Lê Văn D</span> - Chức vụ: <span className="italic">Ủy viên giám sát</span></p>
                  </div>
                  <p className="pt-0.5">
                    - Đã kiểm kê tại kho: <span className="font-semibold">{viewingIC.warehouse_name}</span> (Địa điểm: 244 Lê Thanh Nghị, Hà Nội)
                  </p>
                  {viewingIC.description && (
                    <p>- Ghi chú / Mục đích: <span className="italic">{viewingIC.description}</span></p>
                  )}
                </div>

                {/* Table - Inventory Details */}
                <div className="pt-2">
                  <table className="w-full border-collapse border border-black text-xs text-center" style={{ border: '1px solid #000' }}>
                    <thead>
                      <tr className="bg-slate-50 font-bold" style={{ backgroundColor: '#f8fafc' }}>
                        <th className="stt-column border border-black py-2 px-1 w-10" rowSpan={2}>STT</th>
                        <th className="border border-black py-2 px-2 text-left" rowSpan={2}>Tên sản phẩm / Quy cách</th>
                        <th className="border border-black py-2 px-1.5 w-24" rowSpan={2}>Mã số</th>
                        <th className="border border-black py-2 px-1.5 w-16" rowSpan={2}>ĐVT</th>
                        <th className="border border-black py-1 px-1" colSpan={2}>Số lượng theo</th>
                        <th className="border border-black py-1 px-1" colSpan={2}>Chênh lệch</th>
                      </tr>
                      <tr className="bg-slate-50 font-bold text-[11px]" style={{ backgroundColor: '#f8fafc' }}>
                        <th className="border border-black py-1 px-1.5 w-20">Sổ sách</th>
                        <th className="border border-black py-1 px-1.5 w-20">Thực tế</th>
                        <th className="border border-black py-1 px-1.5 w-16 text-emerald-800 font-bold">Thừa (+)</th>
                        <th className="border border-black py-1 px-1.5 w-16 text-rose-800 font-bold">Thiếu (-)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingIC.details.map((dt, idx) => {
                        const itm = items.find(it => it.id === dt.item_id || it.code === dt.item_code);
                        const unitName = itm?.base_unit_name || 'Cái';
                        const diff = dt.discrepancy;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="stt-column border border-black py-2 px-1">{idx + 1}</td>
                            <td className="border border-black py-2 px-2 text-left font-medium">{dt.item_name}</td>
                            <td className="border border-black py-2 px-1">{dt.item_code}</td>
                            <td className="border border-black py-2 px-1">{unitName}</td>
                            <td className="border border-black py-2 px-1 font-medium">{dt.book_quantity.toLocaleString('vi-VN')}</td>
                            <td className="border border-black py-2 px-1 font-bold">{dt.actual_quantity.toLocaleString('vi-VN')}</td>
                            <td className="border border-black py-2 px-1 text-emerald-800 font-bold">
                              {diff > 0 ? `+${diff.toLocaleString('vi-VN')}` : '-'}
                            </td>
                            <td className="border border-black py-2 px-1 text-rose-800 font-bold">
                              {diff < 0 ? Math.abs(diff).toLocaleString('vi-VN') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="font-bold bg-slate-100" style={{ backgroundColor: '#f1f5f9' }}>
                        <td className="border border-black py-2.5 px-2 text-center" colSpan={4}>Tổng cộng</td>
                        <td className="border border-black py-2.5 px-1 text-center">{totalBook.toLocaleString('vi-VN')}</td>
                        <td className="border border-black py-2.5 px-1 text-center font-bold">{totalActual.toLocaleString('vi-VN')}</td>
                        <td className="border border-black py-2.5 px-1 text-center text-emerald-800 font-bold">
                          {viewingIC.details.filter(d => d.discrepancy > 0).reduce((s, d) => s + d.discrepancy, 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="border border-black py-2.5 px-1 text-center text-rose-800 font-bold">
                          {Math.abs(viewingIC.details.filter(d => d.discrepancy < 0).reduce((s, d) => s + d.discrepancy, 0)).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Conclusion */}
                <div className="text-xs pt-1 space-y-0.5 text-black">
                  <p className="font-semibold">- Kết luận và kiến nghị xử lý:</p>
                  <p className="italic text-gray-700 pl-4">
                    Biên bản kiểm kê lập xong hồi 17 giờ 30 cùng ngày. Toàn bộ số lượng vật tư, hàng hóa chênh lệch đã được đối chiếu và cập nhật vào hệ thống quản lý kho.
                  </p>
                </div>

                {/* Signatures Section matching Image 2 */}
                <div className="pt-4">
                  <div className="grid grid-cols-3 gap-4 text-center text-xs mb-2">
                    <p data-document-signature-date className="col-start-3 italic">Hà Nội, ngày {documentDate}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center text-xs">
                    <div>
                      <p className="font-bold uppercase">Trưởng ban kiểm kê</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center">
                        <span className="font-semibold text-black">{viewingIC.user_name || 'Nguyễn Văn A'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold uppercase">Thủ kho</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center" />
                    </div>
                    <div>
                      <p className="font-bold uppercase">Kế toán trưởng</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
