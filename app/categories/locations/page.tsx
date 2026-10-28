'use client';

import { FilterSelect } from '@/components/filter-select';
import React, { useMemo, useState } from 'react';
import { Edit, Eye, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Bin } from '@/types/warehouse';
import { Button, CatalogLoadingRow, CatalogPagination, CatalogTable, CatalogToolbar, EmptyState, IconButton, PageHeader, RequiredMark, StatusBadge } from '@/components/ui';
import { useFeedback } from '@/context/FeedbackContext';
import { ActivityFilter, ActivityStatusFilter, useCatalogRows, useCatalogStatusConfirmation } from '@/hooks/use-catalog-status';

export default function LocationsPage() {
  const { warehouses, addBin, updateBin, deleteBin } = useWarehouse();
  const { confirmAction, notify, showAlert } = useFeedback();
  const { rows: bins, loading, reload } = useCatalogRows<Bin>('/api/bins');
  const { prepareStatusChange, setCatalogStatus } = useCatalogStatusConfirmation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const [viewingBin, setViewingBin] = useState<Bin | null>(null);
  const [locationId, setLocationId] = useState('105');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || 1);
  const [description, setDescription] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(5000);
  const [status, setStatus] = useState(true);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredBins = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return bins.filter(bin => {
      const matchesWarehouse = warehouseFilter === 'all' || String(bin.warehouse_id) === warehouseFilter;
      const matchesStatus = activityFilter === 'all' || (activityFilter === 'active' ? bin.status : !bin.status);
      const searchable = `BIN-${bin.location_id} ${bin.warehouse_name || ''} ${bin.description || ''}`.toLocaleLowerCase('vi');
      return matchesWarehouse && matchesStatus && (!keyword || searchable.includes(keyword));
    });
  }, [activityFilter, bins, search, warehouseFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredBins.length / pageSize));
  const pagedBins = filteredBins.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = () => {
    setEditingBin(null);
    setLocationId(String(Math.floor(100 + Math.random() * 900)));
    setWarehouseId(warehouses[0]?.id || 1);
    setDescription('');
    setMaxCapacity(5000);
    setStatus(true);
    setIsModalOpen(true);
  };

  const openEditModal = (bin: Bin) => {
    setEditingBin(bin);
    setLocationId(bin.location_id);
    setWarehouseId(bin.warehouse_id);
    setDescription(bin.description);
    setMaxCapacity(Number(bin.max_capacity));
    setStatus(bin.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const locationCode = locationId.trim();
      if (!locationCode || locationCode.length > 24) throw new Error('Mã vị trí phải có từ 1 đến 24 ký tự.');
      const payload = { location_id: locationCode, warehouse_id: warehouseId, description, max_capacity: maxCapacity, status };
      if (editingBin) {
        const statusChange = await prepareStatusChange({
          entity: 'bin', id: editingBin.id, currentStatus: editingBin.status,
          nextStatus: status, displayName: `BIN-${editingBin.location_id} — ${editingBin.description}`,
        });
        if (!statusChange.proceed) return;
        const { status: _status, ...fields } = payload;
        await updateBin(editingBin.id, fields);
        if (editingBin.status !== status) {
          await setCatalogStatus('bin', editingBin.id, status, statusChange.confirmed);
        }
      } else await addBin(payload);
      await reload();
      setIsModalOpen(false);
      notify({ tone: 'success', title: editingBin ? 'Đã cập nhật vị trí' : 'Đã thêm vị trí', message: `BIN-${locationId} — ${description}` });
    } catch (error: any) {
      notify({ tone: 'error', title: 'Không thể lưu vị trí', message: error.message || 'Vui lòng kiểm tra lại thông tin.' });
    }
  };

  const handleDelete = async (bin: Bin) => {
    const accepted = await confirmAction({ title: 'Xóa vị trí lưu trữ?', message: `BIN-${bin.location_id} — ${bin.description || 'Chưa có mô tả'}\nVị trí sẽ ngừng sử dụng. Lịch sử được giữ nguyên.`, confirmLabel: 'Xóa vị trí', tone: 'danger' });
    if (!accepted) return;
    const result = await deleteBin(bin.id);
    if (!result.success) showAlert({ tone: 'error', title: 'Không thể xóa vị trí', message: result.message || 'Vị trí đang có tồn kho hoặc đang được sử dụng.' });
    else {
      await reload();
      notify({ tone: 'success', title: 'Đã xóa vị trí', message: `BIN-${bin.location_id}` });
    }
  };

  return (
    <div className="catalog-page">
      <PageHeader
        title="Vị trí lưu trữ"
        actions={<Button onClick={openCreateModal}><Plus className="size-4" />Thêm vị trí</Button>}
      />

      <CatalogToolbar
        search={search}
        onSearchChange={value => { setSearch(value); setPage(1); }}
        placeholder="Tìm theo mã, kho hoặc mô tả vị trí..."
        shown={pagedBins.length}
        total={filteredBins.length}
        noun="vị trí"
        filters={
          <div className="flex gap-2">
          <FilterSelect label="Lọc vị trí theo kho"
            value={warehouseFilter}
            onChange={event => { setWarehouseFilter(event); setPage(1); }}
            className="form-control w-60"
            aria-label="Lọc vị trí theo kho"
          >
            <option value="all">Tất cả kho hàng</option>
            {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </FilterSelect>
          <ActivityStatusFilter value={activityFilter} onChange={value => { setActivityFilter(value); setPage(1); }} />
          </div>
        }
      />

      <CatalogTable className="min-w-[1040px]">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[11%]" />
              <col className="w-[20%]" />
              <col className="w-[29%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead><tr><th className="stt-column">STT</th><th>Mã vị trí</th><th>Kho hàng</th><th>Mô tả vị trí</th><th>Sức chứa tối đa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading ? <CatalogLoadingRow colSpan={7} /> : pagedBins.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="Không tìm thấy vị trí lưu trữ" description="Hãy thay đổi từ khóa, bộ lọc hoặc thêm vị trí mới." /></td></tr>
              ) : pagedBins.map((bin, index) => (
                <tr key={bin.id}>
                  <td className="stt-column text-slate-500">{(page - 1) * pageSize + index + 1}</td>
                  <td><span className="mono-code text-blue-700 !whitespace-normal [overflow-wrap:anywhere]">BIN-{bin.location_id}</span></td>
                  <td className="font-medium text-slate-900">{bin.warehouse_name || 'Kho tổng'}</td>
                  <td className="text-slate-700">{bin.description}</td>
                  <td className="font-semibold tabular-nums text-slate-900">{Number(bin.max_capacity).toLocaleString('vi-VN')} đơn vị</td>
                  <td><StatusBadge tone={bin.status ? 'success' : 'neutral'}>{bin.status ? 'Sẵn sàng' : 'Ngừng sử dụng'}</StatusBadge></td>
                  <td className="whitespace-nowrap">
                    <IconButton label={`Xem vị trí BIN-${bin.location_id}`} tone="primary" onClick={() => setViewingBin(bin)}><Eye className="size-4" /></IconButton>
                    <IconButton label={`Sửa vị trí BIN-${bin.location_id}`} onClick={() => openEditModal(bin)}><Edit className="size-4" /></IconButton>
                    <IconButton label={`Xóa vị trí BIN-${bin.location_id}`} tone="danger" onClick={() => handleDelete(bin)}><Trash2 className="size-4" /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
      </CatalogTable>

      <CatalogPagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="location-dialog-title" className="ui-dialog catalog-dialog w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5">
              <h2 id="location-dialog-title" className="font-bold text-slate-900">{editingBin ? 'Chỉnh sửa vị trí' : 'Thêm vị trí mới'}</h2>
              <IconButton label="Đóng biểu mẫu" onClick={() => setIsModalOpen(false)}><X className="size-5" /></IconButton>
            </div>
            <form onSubmit={handleSubmit} className="catalog-dialog-form space-y-4 p-5">
              <div><label htmlFor="location-id" className="form-label">Mã vị trí<RequiredMark /></label><input id="location-id" type="text" maxLength={24} value={locationId} onChange={event => setLocationId(event.target.value)} placeholder="Ví dụ: A01, KE-A1" className="form-control" required /></div>
              <div><label htmlFor="location-warehouse" className="form-label">Kho trực thuộc<RequiredMark /></label><select id="location-warehouse" value={warehouseId} onChange={event => setWarehouseId(Number(event.target.value))} className="form-control" required>{warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
              <div><label htmlFor="location-description" className="form-label">Mô tả vị trí<RequiredMark /></label><input id="location-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Ví dụ: Khu A - Kệ 01 - Ô 03" className="form-control" required /></div>
              <div><label htmlFor="location-capacity" className="form-label">Sức chứa tối đa (đơn vị)<RequiredMark /></label><input id="location-capacity" type="number" min="1" step="1" value={maxCapacity} onFocus={event => event.currentTarget.select()} onChange={event => setMaxCapacity(Number(event.target.value))} className="form-control" required /></div>
              <label className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><input type="checkbox" checked={status} onChange={event => setStatus(event.target.checked)} className="size-4 rounded border-slate-300" />Cho phép sử dụng vị trí</label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button type="submit">Lưu vị trí</Button></div>
            </form>
          </div>
        </div>
      ) : null}

      {viewingBin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="location-detail-title" className="ui-dialog catalog-dialog catalog-detail-dialog w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3"><h2 id="location-detail-title" className="flex min-w-0 items-center gap-2 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]"><MapPin className="size-5 shrink-0 text-blue-600" /><span className="min-w-0">Chi tiết BIN-{viewingBin.location_id}</span></h2><IconButton label="Đóng chi tiết" onClick={() => setViewingBin(null)}><X className="size-5" /></IconButton></div>
            <dl className="grid grid-cols-[130px_1fr] gap-y-3 text-sm"><dt className="text-slate-500">Kho trực thuộc</dt><dd className="font-semibold">{viewingBin.warehouse_name}</dd><dt className="text-slate-500">Mô tả</dt><dd>{viewingBin.description}</dd><dt className="text-slate-500">Sức chứa tối đa</dt><dd className="font-semibold tabular-nums">{Number(viewingBin.max_capacity).toLocaleString('vi-VN')} đơn vị</dd><dt className="text-slate-500">Trạng thái</dt><dd><StatusBadge tone={viewingBin.status ? 'success' : 'neutral'}>{viewingBin.status ? 'Đang sử dụng' : 'Ngừng sử dụng'}</StatusBadge></dd></dl>
            <Button className="w-full" variant="secondary" onClick={() => setViewingBin(null)}>Đóng</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
