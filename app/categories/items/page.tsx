'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Item } from '@/types/warehouse';
import { Plus, Trash2, Edit, Eye, X, FileSpreadsheet, Package } from 'lucide-react';
import { Button, CatalogLoadingRow, CatalogPagination, CatalogTable, CatalogToolbar, EmptyState, IconButton, PageHeader, RequiredMark, StatusBadge } from '@/components/ui';
import { useFeedback } from '@/context/FeedbackContext';
import { ActivityFilter, ActivityStatusFilter, useCatalogStatusConfirmation } from '@/hooks/use-catalog-status';

export default function ItemsPage() {
  const { units, addItem, updateItem, deleteItem, importItemsFromExcel, dataRevision } = useWarehouse();
  const { confirmAction, notify, showAlert } = useFeedback();
  const { prepareStatusChange, setCatalogStatus } = useCatalogStatusConfirmation();

  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagedItems, setPagedItems] = useState<Item[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Chi tiết danh mục chỉ hiển thị thông tin nhận diện của vật tư.
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  // Form inputs
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [baseUnitId, setBaseUnitId] = useState<number>(units[0]?.id || 1);
  const [status, setStatus] = useState<boolean>(true);
  const requestSequence = useRef(0);

  const loadItems = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), activity_status: activityFilter, ...(search.trim() ? { search: search.trim() } : {}) });
      const response = await fetch(`/api/items?${params}`, { cache: 'no-store' });
      const body = await response.json();
      if (sequence !== requestSequence.current) return;
      if (!response.ok) throw new Error(body.message || body.error || 'Không tải được danh sách sản phẩm');
      setPagedItems(body.data);
      setTotalItems(body.pagination.total);
      setTotalPages(body.pagination.total_pages);
    } catch (err: any) {
      if (sequence === requestSequence.current) notify({ tone: 'error', title: 'Không tải được danh sách vật tư', message: err.message });
    } finally {
      if (sequence === requestSequence.current) setListLoading(false);
    }
  }, [activityFilter, page, pageSize, search, dataRevision]);

  useEffect(() => { const timer = setTimeout(loadItems, 250); return () => { clearTimeout(timer); requestSequence.current += 1; }; }, [loadItems]);
  useEffect(() => setPage(1), [activityFilter, search]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode(`SP-${Date.now().toString().slice(-4)}`);
    setName('');
    setBaseUnitId(units[0]?.id || 1);
    setStatus(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setBaseUnitId(item.base_unit_id);
    setStatus(item.status);
    setIsModalOpen(true);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || submitting) return;
    setSubmitting(true);
    try {
      if (editingItem) {
        const statusChange = await prepareStatusChange({
          entity: 'item', id: editingItem.id, currentStatus: editingItem.status,
          nextStatus: status, displayName: `${editingItem.code} — ${editingItem.name}`,
        });
        if (!statusChange.proceed) return;
        await updateItem(editingItem.id, { code, name, base_unit_id: baseUnitId });
        if (editingItem.status !== status) {
          await setCatalogStatus('item', editingItem.id, status, statusChange.confirmed);
        }
      } else {
        await addItem({ code, name, base_unit_id: baseUnitId, status });
      }
      setIsModalOpen(false);
      await loadItems();
      notify({ tone: 'success', title: editingItem ? 'Đã cập nhật vật tư' : 'Đã thêm vật tư', message: `${code} — ${name}` });
    } catch (err: any) {
      notify({ tone: 'error', title: 'Không thể lưu vật tư', message: err.message || 'Vui lòng kiểm tra lại thông tin và thử lại.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: Item) => {
    const accepted = await confirmAction({
      title: 'Xóa vật tư khỏi danh mục?',
      message: `${item.code} — ${item.name}\nVật tư sẽ ngừng sử dụng. Lịch sử được giữ nguyên.`,
      confirmLabel: 'Xóa vật tư',
      tone: 'danger',
    });
    if (!accepted) return;
    const res = await deleteItem(item.id);
    if (!res.success) {
      showAlert({ tone: 'error', title: 'Không thể xóa vật tư', message: res.message || 'Vật tư đang được sử dụng hoặc vẫn còn tồn kho.' });
    } else {
      await loadItems();
      notify({ tone: 'success', title: 'Đã xóa vật tư', message: `${item.code} — ${item.name}` });
    }
  };

  // Excel Import Handler
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // XLSX is sizeable, so only load it when the user actually imports a file.
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const parsedItems: Omit<Item, 'id' | 'created_at' | 'updated_at'>[] = data.map((row, idx) => ({
          code: row['Mã sản phẩm'] || row['Code'] || `SP-EXCEL-${idx + 1}`,
          name: row['Tên sản phẩm'] || row['Name'] || `Sản phẩm Excel ${idx + 1}`,
          base_unit_id: units[0]?.id || 1,
          status: true,
        }));

        await importItemsFromExcel(parsedItems);
        await loadItems();
        notify({ tone: 'success', title: 'Đã nhập dữ liệu Excel', message: `Đã xử lý ${parsedItems.length} dòng vật tư.` });
      } catch (err: any) {
        notify({ tone: 'error', title: 'Không thể nhập dữ liệu Excel', message: err.message });
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredItems = pagedItems;

  return (
    <div className="catalog-page">
      <PageHeader
        title="Sản phẩm & linh kiện"
        actions={
          <>
          {/* Import Excel */}
          <label className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Nhập Excel</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} className="hidden" />
          </label>

          {/* Add New Product */}
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm</span>
          </Button>
          </>
        }
      />

      <CatalogToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Tìm theo mã hoặc tên sản phẩm..."
        shown={filteredItems.length}
        total={totalItems}
        noun="sản phẩm"
        filters={<ActivityStatusFilter value={activityFilter} onChange={value => { setActivityFilter(value); setPage(1); }} />}
      />

      {/* Products Table */}
      <CatalogTable className="min-w-[1050px]">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[16%]" />
              <col className="w-[38%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="stt-column">STT</th>
                <th>Mã sản phẩm</th>
                <th>Tên sản phẩm</th>
                <th className="!text-center">Đơn vị tính</th>
                <th className="!text-center">Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? <CatalogLoadingRow colSpan={6} /> : filteredItems.length === 0 ? (
                <tr><td colSpan={6}><EmptyState title="Không tìm thấy sản phẩm" description="Hãy thay đổi từ khóa hoặc thêm sản phẩm mới." /></td></tr>
              ) : filteredItems.map((item, index) => {
                return (
                  <tr key={item.id}>
                    <td className="stt-column font-medium text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                    <td><span className="mono-code text-blue-700">{item.code}</span></td>
                    <td className="font-medium text-slate-900">{item.name}</td>
                    <td className="text-center text-slate-600">{item.base_unit_name || 'Cái'}</td>
                    <td className="text-center">
                      {item.status ? (
                        <StatusBadge tone="success">Đang kinh doanh</StatusBadge>
                      ) : (
                        <StatusBadge>Ngừng kinh doanh</StatusBadge>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {/* View Details Button */}
                        <IconButton
                          label="Xem chi tiết"
                          onClick={() => setViewingItem(item)}
                          tone="primary"
                        >
                          <Eye className="w-4 h-4" />
                        </IconButton>
                        {/* Edit Button */}
                        <IconButton
                          label="Sửa sản phẩm"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </IconButton>
                        {/* Delete Button */}
                        <IconButton
                          label="Xóa sản phẩm"
                          onClick={() => handleDelete(item)}
                          tone="danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
      </CatalogTable>

      <CatalogPagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />

      {/* CRUD Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="item-dialog-title" className="ui-dialog catalog-dialog bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 id="item-dialog-title" className="font-bold text-slate-900">
                {editingItem ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
              </h3>
              <IconButton label="Đóng hộp thoại" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </IconButton>
            </div>

            <form onSubmit={handleSubmit} className="catalog-dialog-form p-5 space-y-4">
              <div>
                <label htmlFor="item-code" className="form-label">Mã sản phẩm<RequiredMark /></label>
                <input
                  id="item-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div>
                <label htmlFor="item-name" className="form-label">Tên sản phẩm<RequiredMark /></label>
                <input
                  id="item-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: VGA RTX 4090"
                  className="form-control"
                  required
                />
              </div>

              <div>
                <label htmlFor="item-unit" className="form-label">Đơn vị tính<RequiredMark /></label>
                <select
                  id="item-unit"
                  value={baseUnitId}
                  onChange={(e) => setBaseUnitId(Number(e.target.value))}
                  className="form-control"
                  required
                >
                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>{unit.code} - {unit.description}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="itemStatus"
                  checked={status}
                  onChange={(e) => setStatus(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="itemStatus" className="text-sm font-medium text-slate-700">Đang hoạt động / Kinh doanh</label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={submitting}>
                  {editingItem ? 'Lưu cập nhật' : 'Tạo mới'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simple catalog detail modal — inventory movements belong to the inventory module. */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="item-detail-title" className="ui-dialog catalog-dialog w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Package className="size-5" />
                </div>
                <div>
                  <h3 id="item-detail-title" className="font-bold text-slate-900">Chi tiết vật tư</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Thông tin danh mục sản phẩm và linh kiện</p>
                </div>
              </div>
              <IconButton label="Đóng chi tiết vật tư" onClick={() => setViewingItem(null)}><X className="size-5" /></IconButton>
            </div>

            <div className="p-6">
              <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-4 text-sm">
                <dt className="text-slate-500">Mã sản phẩm</dt>
                <dd className="font-semibold text-blue-700">{viewingItem.code}</dd>
                <dt className="text-slate-500">Tên sản phẩm</dt>
                <dd className="font-semibold text-slate-900">{viewingItem.name}</dd>
                <dt className="text-slate-500">Đơn vị tính</dt>
                <dd className="font-medium text-slate-700">{viewingItem.base_unit_name || 'Cái'}</dd>
                <dt className="text-slate-500">Trạng thái</dt>
                <dd>
                  <StatusBadge tone={viewingItem.status ? 'success' : 'neutral'}>
                    {viewingItem.status ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
                  </StatusBadge>
                </dd>
              </dl>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4">
              <Button variant="secondary" onClick={() => setViewingItem(null)}>Đóng</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
