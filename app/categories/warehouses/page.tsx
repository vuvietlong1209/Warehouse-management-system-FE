'use client';

import React, { useMemo, useState } from 'react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Warehouse } from '@/types/warehouse';
import { Plus, Edit, Trash2, Building2, Eye, X } from 'lucide-react';
import {
  Button,
  CatalogLoadingRow,
  CatalogPagination,
  CatalogTable,
  CatalogToolbar,
  EmptyState,
  IconButton,
  PageHeader,
  RequiredMark,
  StatusBadge,
  formatDateVN,
} from '@/components/ui';
import { useFeedback } from '@/context/FeedbackContext';
import { ActivityFilter, ActivityStatusFilter, useCatalogRows, useCatalogStatusConfirmation } from '@/hooks/use-catalog-status';

export default function WarehousesPage() {
  const { addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouse();
  const { confirmAction, notify, showAlert } = useFeedback();
  const { rows: warehouses, loading, reload } = useCatalogRows<Warehouse>('/api/warehouses');
  const { prepareStatusChange, setCatalogStatus } = useCatalogStatusConfirmation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<Warehouse | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState(true);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredWarehouses = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return warehouses.filter(warehouse => {
      const matchesStatus = activityFilter === 'all'
        || (activityFilter === 'active' ? warehouse.status : !warehouse.status);
      return matchesStatus && (!keyword || `${warehouse.code} ${warehouse.name}`.toLocaleLowerCase('vi').includes(keyword));
    });
  }, [activityFilter, search, warehouses]);
  const totalPages = Math.max(1, Math.ceil(filteredWarehouses.length / pageSize));
  const pagedWarehouses = filteredWarehouses.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = () => {
    setEditingWarehouse(null);
    setCode(`KHO-${Date.now().toString().slice(-3)}`);
    setName('');
    setStatus(true);
    setIsModalOpen(true);
  };

  const openEditModal = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setCode(wh.code);
    setName(wh.name);
    setStatus(wh.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        const statusChange = await prepareStatusChange({
          entity: 'warehouse', id: editingWarehouse.id, currentStatus: editingWarehouse.status,
          nextStatus: status, displayName: `${editingWarehouse.code} — ${editingWarehouse.name}`,
        });
        if (!statusChange.proceed) return;
        await updateWarehouse(editingWarehouse.id, { code, name });
        if (editingWarehouse.status !== status) {
          await setCatalogStatus('warehouse', editingWarehouse.id, status, statusChange.confirmed);
        }
      } else {
        await addWarehouse({ code, name, status });
      }
      await reload();
      setIsModalOpen(false);
      notify({ tone: 'success', title: editingWarehouse ? 'Đã cập nhật kho' : 'Đã thêm kho', message: `${code} — ${name}` });
    } catch (err: any) {
      notify({ tone: 'error', title: 'Không thể lưu kho', message: err.message || 'Vui lòng kiểm tra lại thông tin.' });
    }
  };

  const handleDelete = async (wh: Warehouse) => {
    const accepted = await confirmAction({ title: 'Xóa kho hàng?', message: `${wh.code} — ${wh.name}\nKho sẽ ngừng sử dụng. Lịch sử được giữ nguyên.`, confirmLabel: 'Xóa kho', tone: 'danger' });
    if (!accepted) return;
    const res = await deleteWarehouse(wh.id);
    if (!res.success) {
      showAlert({ tone: 'error', title: 'Không thể xóa kho', message: res.message || 'Kho đang chứa dữ liệu nghiệp vụ.' });
    } else {
      await reload();
      notify({ tone: 'success', title: 'Đã xóa kho', message: `${wh.code} — ${wh.name}` });
    }
  };

  return (
    <div className="catalog-page">
      <PageHeader title="Kho hàng" actions={
        <Button onClick={openCreateModal}><Plus className="size-4" />Thêm kho mới</Button>
      } />

      <CatalogToolbar
        search={search}
        onSearchChange={value => { setSearch(value); setPage(1); }}
        placeholder="Tìm theo mã hoặc tên kho..."
        shown={pagedWarehouses.length}
        total={filteredWarehouses.length}
        noun="kho hàng"
        filters={<ActivityStatusFilter value={activityFilter} onChange={value => { setActivityFilter(value); setPage(1); }} />}
      />

      <CatalogTable className="min-w-[900px]">
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[14%]" />
            <col className="w-[35%]" />
            <col className="w-[19%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="stt-column">STT</th>
              <th>Mã kho</th>
              <th>Tên kho hàng</th>
              <th>Ngày khởi tạo</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <CatalogLoadingRow colSpan={6} /> : pagedWarehouses.length === 0 ? (
              <tr><td colSpan={6}><EmptyState title="Không tìm thấy kho hàng" description="Hãy thay đổi từ khóa hoặc thêm kho hàng mới." /></td></tr>
            ) : pagedWarehouses.map((wh, index) => (
              <tr key={wh.id}>
                <td className="stt-column text-slate-500">{(page - 1) * pageSize + index + 1}</td>
                <td><span className="mono-code text-blue-700">{wh.code}</span></td>
                <td className="font-medium text-slate-900">{wh.name}</td>
                <td className="date-cell">{formatDateVN(wh.created_at)}</td>
                <td>
                  <StatusBadge tone={wh.status ? 'success' : 'neutral'}>{wh.status ? 'Đang hoạt động' : 'Ngừng hoạt động'}</StatusBadge>
                </td>
                <td className="whitespace-nowrap">
                  <IconButton label={`Xem kho ${wh.name}`} tone="primary" onClick={() => setViewingWarehouse(wh)}>
                    <Eye className="w-4 h-4" />
                  </IconButton>
                  <IconButton label={`Sửa kho ${wh.name}`} onClick={() => openEditModal(wh)}>
                    <Edit className="w-4 h-4" />
                  </IconButton>
                  <IconButton label={`Xóa kho ${wh.name}`} tone="danger" onClick={() => handleDelete(wh)}>
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
      </CatalogTable>

      <CatalogPagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="warehouse-dialog-title" className="ui-dialog catalog-dialog bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="warehouse-dialog-title" className="font-bold text-slate-900">{editingWarehouse ? 'Chỉnh sửa kho' : 'Thêm kho mới'}</h3>
              <IconButton label="Đóng hộp thoại" onClick={() => setIsModalOpen(false)}><X className="size-5" /></IconButton>
            </div>
            <form onSubmit={handleSubmit} className="catalog-dialog-form p-5 space-y-4">
              <div>
                <label htmlFor="warehouse-code" className="form-label">Mã kho hàng<RequiredMark /></label>
                <input
                  id="warehouse-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="form-control"
                  required
                />
              </div>
              <div>
                <label htmlFor="warehouse-name" className="form-label">Tên kho hàng<RequiredMark /></label>
                <input
                  id="warehouse-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Kho Miền Nam - TP.HCM"
                  className="form-control"
                  required
                />
              </div>
              <label className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><input type="checkbox" checked={status} onChange={event => setStatus(event.target.checked)} className="size-4 rounded border-slate-300" />Kho đang hoạt động</label>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                <Button type="submit">Lưu</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {viewingWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="warehouse-detail-title" className="ui-dialog catalog-dialog catalog-detail-dialog bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 id="warehouse-detail-title" className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Chi tiết Kho {viewingWarehouse.code}
              </h2>
              <IconButton label="Đóng chi tiết kho" onClick={() => setViewingWarehouse(null)}><X className="w-5 h-5" /></IconButton>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Tên kho:</span> <strong>{viewingWarehouse.name}</strong></p>
              <p className="date-value"><span className="text-slate-500">Ngày tạo:</span> {formatDateVN(viewingWarehouse.created_at)}</p>
              <p><span className="text-slate-500">Trạng thái:</span> <StatusBadge tone={viewingWarehouse.status ? 'success' : 'neutral'}>{viewingWarehouse.status ? 'Đang hoạt động' : 'Ngừng hoạt động'}</StatusBadge></p>
            </div>
            <Button className="w-full" variant="secondary" onClick={() => setViewingWarehouse(null)}>Đóng</Button>
          </div>
        </div>
      )}
    </div>
  );
}
