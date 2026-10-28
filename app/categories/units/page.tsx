'use client';

import React, { useMemo, useState } from 'react';
import { Edit, Eye, Plus, Scale, Trash2, X } from 'lucide-react';
import { Button, CatalogLoadingRow, CatalogPagination, CatalogTable, CatalogToolbar, EmptyState, IconButton, PageHeader, RequiredMark, StatusBadge } from '@/components/ui';
import { useWarehouse } from '@/context/WarehouseContext';
import { BaseUnit } from '@/types/warehouse';
import { useFeedback } from '@/context/FeedbackContext';
import { ActivityFilter, ActivityStatusFilter, useCatalogRows, useCatalogStatusConfirmation } from '@/hooks/use-catalog-status';

export default function UnitsPage() {
  const { addUnit, updateUnit, deleteUnit } = useWarehouse();
  const { confirmAction, notify, showAlert } = useFeedback();
  const { rows: units, loading, reload } = useCatalogRows<BaseUnit>('/api/base-units');
  const { prepareStatusChange, setCatalogStatus } = useCatalogStatusConfirmation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BaseUnit | null>(null);
  const [viewingUnit, setViewingUnit] = useState<BaseUnit | null>(null);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(true);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredUnits = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return units.filter(unit => {
      const matchesStatus = activityFilter === 'all' || (activityFilter === 'active' ? unit.status : !unit.status);
      return matchesStatus && (!keyword || `${unit.code} ${unit.description}`.toLocaleLowerCase('vi').includes(keyword));
    });
  }, [activityFilter, search, units]);
  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / pageSize));
  const pagedUnits = filteredUnits.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = () => {
    setEditingUnit(null);
    setCode('');
    setDescription('');
    setStatus(true);
    setIsModalOpen(true);
  };

  const openEditModal = (unit: BaseUnit) => {
    setEditingUnit(unit);
    setCode(unit.code);
    setDescription(unit.description);
    setStatus(unit.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { code, description, status };
      if (editingUnit) {
        const statusChange = await prepareStatusChange({
          entity: 'unit', id: editingUnit.id, currentStatus: editingUnit.status,
          nextStatus: status, displayName: `${editingUnit.code} — ${editingUnit.description}`,
        });
        if (!statusChange.proceed) return;
        await updateUnit(editingUnit.id, { code, description });
        if (editingUnit.status !== status) {
          await setCatalogStatus('unit', editingUnit.id, status, statusChange.confirmed);
        }
      } else await addUnit(payload);
      await reload();
      setIsModalOpen(false);
      notify({ tone: 'success', title: editingUnit ? 'Đã cập nhật đơn vị tính' : 'Đã thêm đơn vị tính', message: `${code} — ${description}` });
    } catch (error: any) {
      notify({ tone: 'error', title: 'Không thể lưu đơn vị tính', message: error.message || 'Vui lòng kiểm tra lại thông tin.' });
    }
  };

  const handleDelete = async (unit: BaseUnit) => {
    const accepted = await confirmAction({ title: 'Xóa đơn vị tính?', message: `${unit.code}\nĐơn vị tính sẽ ngừng sử dụng. Lịch sử được giữ nguyên.`, confirmLabel: 'Xóa đơn vị', tone: 'danger' });
    if (!accepted) return;
    const result = await deleteUnit(unit.id);
    if (!result.success) showAlert({ tone: 'error', title: 'Không thể xóa đơn vị tính', message: result.message || 'Đơn vị tính đang được sử dụng.' });
    else {
      await reload();
      notify({ tone: 'success', title: 'Đã xóa đơn vị tính', message: unit.code });
    }
  };

  return (
    <div className="catalog-page">
      <PageHeader title="Đơn vị tính" actions={<Button onClick={openCreateModal}><Plus className="size-4" />Thêm đơn vị tính</Button>} />
      <CatalogToolbar
        search={search}
        onSearchChange={value => { setSearch(value); setPage(1); }}
        placeholder="Tìm theo mã hoặc mô tả đơn vị tính..."
        shown={pagedUnits.length}
        total={filteredUnits.length}
        noun="đơn vị tính"
        filters={<ActivityStatusFilter value={activityFilter} onChange={value => { setActivityFilter(value); setPage(1); }} />}
      />

      <CatalogTable className="min-w-[820px]">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[15%]" />
          <col className="w-[50%]" />
          <col className="w-[18%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead><tr><th className="stt-column">STT</th><th>Mã ĐVT</th><th>Mô tả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>
          {loading ? <CatalogLoadingRow colSpan={5} /> : pagedUnits.length === 0 ? (
            <tr><td colSpan={5}><EmptyState title="Không tìm thấy đơn vị tính" description="Hãy thay đổi từ khóa hoặc thêm đơn vị tính mới." /></td></tr>
          ) : pagedUnits.map((unit, index) => <tr key={unit.id}><td className="stt-column text-slate-500">{(page - 1) * pageSize + index + 1}</td><td><span className="mono-code text-blue-700">{unit.code}</span></td><td>{unit.description || '—'}</td><td><StatusBadge tone={unit.status ? 'success' : 'neutral'}>{unit.status ? 'Đang áp dụng' : 'Ngừng áp dụng'}</StatusBadge></td><td className="whitespace-nowrap"><IconButton label={`Xem đơn vị ${unit.code}`} tone="primary" onClick={() => setViewingUnit(unit)}><Eye className="size-4" /></IconButton><IconButton label={`Sửa đơn vị ${unit.code}`} onClick={() => openEditModal(unit)}><Edit className="size-4" /></IconButton><IconButton label={`Xóa đơn vị ${unit.code}`} tone="danger" onClick={() => handleDelete(unit)}><Trash2 className="size-4" /></IconButton></td></tr>)}
        </tbody>
      </CatalogTable>

      <CatalogPagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />

      {isModalOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="unit-dialog-title" className="ui-dialog catalog-dialog w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5"><h2 id="unit-dialog-title" className="font-bold text-slate-900">{editingUnit ? 'Chỉnh sửa đơn vị tính' : 'Thêm đơn vị tính'}</h2><IconButton label="Đóng biểu mẫu" onClick={() => setIsModalOpen(false)}><X className="size-5" /></IconButton></div><form onSubmit={handleSubmit} className="catalog-dialog-form space-y-4 p-5"><div><label htmlFor="unit-code" className="form-label">Mã đơn vị tính<RequiredMark /></label><input id="unit-code" value={code} onChange={event => setCode(event.target.value)} placeholder="Ví dụ: Cái, Hộp, Bộ" className="form-control" required /></div><div><label htmlFor="unit-description" className="form-label">Mô tả đầy đủ<RequiredMark /></label><input id="unit-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Ví dụ: Cái / chiếc đơn lẻ" className="form-control" required /></div><label className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><input type="checkbox" checked={status} onChange={event => setStatus(event.target.checked)} className="size-4 rounded border-slate-300" />Đơn vị đang được áp dụng</label><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button type="submit">Lưu đơn vị</Button></div></form></div></div> : null}

      {viewingUnit ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="unit-detail-title" className="ui-dialog catalog-dialog catalog-detail-dialog w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"><div className="flex items-center justify-between border-b pb-3"><h2 id="unit-detail-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Scale className="size-5 text-blue-600" />Chi tiết đơn vị tính</h2><IconButton label="Đóng chi tiết" onClick={() => setViewingUnit(null)}><X className="size-5" /></IconButton></div><dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm"><dt className="text-slate-500">Mã ĐVT</dt><dd className="font-semibold text-blue-700">{viewingUnit.code}</dd><dt className="text-slate-500">Diễn giải</dt><dd className="font-medium">{viewingUnit.description}</dd><dt className="text-slate-500">Trạng thái</dt><dd><StatusBadge tone={viewingUnit.status ? 'success' : 'neutral'}>{viewingUnit.status ? 'Đang sử dụng' : 'Ngừng sử dụng'}</StatusBadge></dd></dl><Button className="w-full" variant="secondary" onClick={() => setViewingUnit(null)}>Đóng</Button></div></div> : null}
    </div>
  );
}
