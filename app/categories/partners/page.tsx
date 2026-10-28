'use client';

import React, { useMemo, useState } from 'react';
import { Edit, Eye, MapPin, Phone, Plus, Trash2, Users, X } from 'lucide-react';
import { Button, CatalogLoadingRow, CatalogPagination, CatalogTable, CatalogToolbar, EmptyState, IconButton, PageHeader, RequiredMark, StatusBadge } from '@/components/ui';
import { useWarehouse } from '@/context/WarehouseContext';
import { Partner } from '@/types/warehouse';
import { useFeedback } from '@/context/FeedbackContext';
import { ActivityFilter, ActivityStatusFilter, useCatalogRows, useCatalogStatusConfirmation } from '@/hooks/use-catalog-status';

export default function PartnersPage() {
  const { addPartner, updatePartner, deletePartner } = useWarehouse();
  const { confirmAction, notify, showAlert } = useFeedback();
  const { rows: partners, loading, reload } = useCatalogRows<Partner>('/api/partners');
  const { prepareStatusChange, setCatalogStatus } = useCatalogStatusConfirmation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [viewingPartner, setViewingPartner] = useState<Partner | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState(true);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredPartners = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return partners.filter(partner => {
      const matchesStatus = activityFilter === 'all' || (activityFilter === 'active' ? partner.status : !partner.status);
      return matchesStatus && (!keyword || `${partner.code} ${partner.name} ${partner.phone_number || ''} ${partner.address || ''}`.toLocaleLowerCase('vi').includes(keyword));
    });
  }, [activityFilter, partners, search]);
  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / pageSize));
  const pagedPartners = filteredPartners.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = () => {
    setEditingPartner(null);
    setCode(`DT-${Date.now().toString().slice(-4)}`);
    setName('');
    setPhone('');
    setAddress('');
    setStatus(true);
    setIsModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setCode(partner.code);
    setName(partner.name);
    setPhone(partner.phone_number);
    setAddress(partner.address);
    setStatus(partner.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { code, name, phone_number: phone, address, status };
      if (editingPartner) {
        const statusChange = await prepareStatusChange({
          entity: 'partner', id: editingPartner.id, currentStatus: editingPartner.status,
          nextStatus: status, displayName: `${editingPartner.code} — ${editingPartner.name}`,
        });
        if (!statusChange.proceed) return;
        await updatePartner(editingPartner.id, { code, name, phone_number: phone, address });
        if (editingPartner.status !== status) {
          await setCatalogStatus('partner', editingPartner.id, status, statusChange.confirmed);
        }
      } else await addPartner(payload);
      await reload();
      setIsModalOpen(false);
      notify({ tone: 'success', title: editingPartner ? 'Đã cập nhật đối tác' : 'Đã thêm đối tác', message: `${code} — ${name}` });
    } catch (error: any) {
      notify({ tone: 'error', title: 'Không thể lưu đối tác', message: error.message || 'Vui lòng kiểm tra lại thông tin.' });
    }
  };

  const handleDelete = async (partner: Partner) => {
    const accepted = await confirmAction({ title: 'Xóa đối tác?', message: `${partner.code} — ${partner.name}\nĐối tác sẽ ngừng sử dụng. Lịch sử được giữ nguyên.`, confirmLabel: 'Xóa đối tác', tone: 'danger' });
    if (!accepted) return;
    const result = await deletePartner(partner.id);
    if (!result.success) showAlert({ tone: 'error', title: 'Không thể xóa đối tác', message: result.message || 'Đối tác đang được sử dụng trong hệ thống.' });
    else {
      await reload();
      notify({ tone: 'success', title: 'Đã xóa đối tác', message: `${partner.code} — ${partner.name}` });
    }
  };

  return (
    <div className="catalog-page">
      <PageHeader title="Đối tác" actions={<Button onClick={openCreateModal}><Plus className="size-4" />Thêm đối tác</Button>} />

      <CatalogToolbar
        search={search}
        onSearchChange={value => { setSearch(value); setPage(1); }}
        placeholder="Tìm theo mã, tên, số điện thoại hoặc địa chỉ..."
        shown={pagedPartners.length}
        total={filteredPartners.length}
        noun="đối tác"
        filters={<ActivityStatusFilter value={activityFilter} onChange={value => { setActivityFilter(value); setPage(1); }} />}
      />

      <CatalogTable className="min-w-[1050px]">
        <colgroup>
          <col className="w-[6%]" />
          <col className="w-[11%]" />
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[23%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead><tr><th className="stt-column">STT</th><th>Mã đối tác</th><th>Tên công ty / đối tác</th><th>Số điện thoại</th><th>Địa chỉ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>
          {loading ? <CatalogLoadingRow colSpan={7} /> : pagedPartners.length === 0 ? (
            <tr><td colSpan={7}><EmptyState title="Không tìm thấy đối tác" description="Hãy thay đổi từ khóa hoặc thêm đối tác mới." /></td></tr>
          ) : pagedPartners.map((partner, index) => <tr key={partner.id}><td className="stt-column text-slate-500">{(page - 1) * pageSize + index + 1}</td><td><span className="mono-code text-blue-700">{partner.code}</span></td><td className="font-medium text-slate-900">{partner.name}</td><td>{partner.phone_number || '—'}</td><td className="max-w-sm truncate text-slate-600" title={partner.address}>{partner.address || '—'}</td><td><StatusBadge tone={partner.status ? 'success' : 'neutral'}>{partner.status ? 'Đang hợp tác' : 'Ngừng hợp tác'}</StatusBadge></td><td className="whitespace-nowrap"><IconButton label={`Xem đối tác ${partner.name}`} tone="primary" onClick={() => setViewingPartner(partner)}><Eye className="size-4" /></IconButton><IconButton label={`Sửa đối tác ${partner.name}`} onClick={() => openEditModal(partner)}><Edit className="size-4" /></IconButton><IconButton label={`Xóa đối tác ${partner.name}`} tone="danger" onClick={() => handleDelete(partner)}><Trash2 className="size-4" /></IconButton></td></tr>)}
        </tbody>
      </CatalogTable>

      <CatalogPagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />

      {isModalOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="partner-dialog-title" className="ui-dialog catalog-dialog w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5"><h2 id="partner-dialog-title" className="font-bold text-slate-900">{editingPartner ? 'Chỉnh sửa đối tác' : 'Thêm đối tác mới'}</h2><IconButton label="Đóng biểu mẫu" onClick={() => setIsModalOpen(false)}><X className="size-5" /></IconButton></div><form onSubmit={handleSubmit} className="catalog-dialog-form grid grid-cols-2 gap-4 p-5"><div><label htmlFor="partner-code" className="form-label">Mã đối tác<RequiredMark /></label><input id="partner-code" value={code} onChange={event => setCode(event.target.value)} className="form-control" required /></div><div><label htmlFor="partner-phone" className="form-label">Số điện thoại</label><input id="partner-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} className="form-control" /></div><div className="col-span-2"><label htmlFor="partner-name" className="form-label">Tên đối tác<RequiredMark /></label><input id="partner-name" value={name} onChange={event => setName(event.target.value)} className="form-control" required /></div><div className="col-span-2"><label htmlFor="partner-address" className="form-label">Địa chỉ</label><textarea id="partner-address" value={address} onChange={event => setAddress(event.target.value)} className="form-control min-h-20 resize-y" /></div><label className="col-span-2 flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><input type="checkbox" checked={status} onChange={event => setStatus(event.target.checked)} className="size-4 rounded border-slate-300" />Đối tác đang hoạt động</label><div className="col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button type="submit">Lưu đối tác</Button></div></form></div></div> : null}

      {viewingPartner ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="partner-detail-title" className="ui-dialog catalog-dialog catalog-detail-dialog w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"><div className="flex items-center justify-between border-b pb-3"><h2 id="partner-detail-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Users className="size-5 text-blue-600" />Chi tiết đối tác</h2><IconButton label="Đóng chi tiết" onClick={() => setViewingPartner(null)}><X className="size-5" /></IconButton></div><div className="space-y-3 text-sm"><p><span className="text-slate-500">Mã đối tác:</span> <strong className="text-blue-700">{viewingPartner.code}</strong></p><p><span className="text-slate-500">Tên công ty:</span> <strong>{viewingPartner.name}</strong></p><p className="flex items-center gap-2"><Phone className="size-4 text-slate-400" />{viewingPartner.phone_number || 'Chưa cung cấp'}</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />{viewingPartner.address || 'Chưa cung cấp'}</p></div><Button className="w-full" variant="secondary" onClick={() => setViewingPartner(null)}>Đóng</Button></div></div> : null}
    </div>
  );
}
