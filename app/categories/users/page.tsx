'use client';

import { FilterSelect } from '@/components/filter-select';
import React, { useMemo, useState } from 'react';
import { Edit, Eye, Mail, Plus, Trash2, UserCheck, X } from 'lucide-react';
import { Button, CatalogLoadingRow, CatalogPagination, CatalogTable, CatalogToolbar, EmptyState, IconButton, PageHeader, RequiredMark, StatusBadge } from '@/components/ui';
import { useWarehouse } from '@/context/WarehouseContext';
import { User } from '@/types/warehouse';
import { useFeedback } from '@/context/FeedbackContext';
import { ActivityFilter, ActivityStatusFilter, useCatalogRows, useCatalogStatusConfirmation } from '@/hooks/use-catalog-status';

export default function UsersPage() {
  const { roles, addUser, updateUser, deleteUser } = useWarehouse();
  const { confirmAction, notify, showAlert } = useFeedback();
  const { rows: users, loading, reload } = useCatalogRows<User>('/api/users');
  const { prepareStatusChange, setCatalogStatus } = useCatalogStatusConfirmation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id || 1);
  const [status, setStatus] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return users.filter(user => {
      const matchesRole = roleFilter === 'all' || String(user.role_id) === roleFilter;
      const matchesStatus = activityFilter === 'all' || (activityFilter === 'active' ? user.status : !user.status);
      const matchesSearch = !keyword || `${user.username} ${user.name} ${user.email} ${user.role_name || ''}`.toLocaleLowerCase('vi').includes(keyword);
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [activityFilter, roleFilter, search, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = () => {
    setEditingUser(null);
    setUsername('');
    setName('');
    setEmail('');
    setPassword('');
    setRoleId(roles[0]?.id || 1);
    setStatus(true);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setUsername(user.username);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRoleId(user.role_id);
    setStatus(user.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const base = { username, name, email, role_id: roleId, status };
      if (editingUser) {
        const statusChange = await prepareStatusChange({
          entity: 'user', id: editingUser.id, currentStatus: editingUser.status,
          nextStatus: status, displayName: `${editingUser.name} (@${editingUser.username})`,
        });
        if (!statusChange.proceed) return;
        const { status: _status, ...fields } = base;
        await updateUser(editingUser.id, { ...fields, ...(password ? { password } : {}) });
        if (editingUser.status !== status) {
          await setCatalogStatus('user', editingUser.id, status, statusChange.confirmed);
        }
      } else await addUser({ ...base, password });
      await reload();
      setIsModalOpen(false);
      notify({ tone: 'success', title: editingUser ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản', message: `${name} (@${username})` });
    } catch (error: any) {
      notify({ tone: 'error', title: 'Không thể lưu tài khoản', message: error.message || 'Vui lòng kiểm tra lại thông tin.' });
    }
  };

  const handleDelete = async (user: User) => {
    const accepted = await confirmAction({ title: 'Xóa tài khoản?', message: `${user.name} (@${user.username})\nTài khoản sẽ không thể đăng nhập. Lịch sử được giữ nguyên.`, confirmLabel: 'Xóa tài khoản', tone: 'danger' });
    if (!accepted) return;
    const result = await deleteUser(user.id);
    if (!result.success) showAlert({ tone: 'error', title: 'Không thể xóa tài khoản', message: result.message || 'Tài khoản đang được sử dụng hoặc là tài khoản hiện hành.' });
    else {
      await reload();
      notify({ tone: 'success', title: 'Đã xóa tài khoản', message: `@${user.username}` });
    }
  };

  const roleName = (user: User) => user.role_name || roles.find(role => role.id === user.role_id)?.role_name || 'Quản trị viên';

  return (
    <div className="catalog-page">
      <PageHeader title="Nhân viên và phân quyền" actions={<Button onClick={openCreateModal}><Plus className="size-4" />Thêm nhân viên</Button>} />
      <CatalogToolbar
        search={search}
        onSearchChange={value => { setSearch(value); setPage(1); }}
        placeholder="Tìm theo tài khoản, họ tên, email hoặc vai trò..."
        shown={pagedUsers.length}
        total={filteredUsers.length}
        noun="nhân viên"
        filters={
          <div className="flex gap-2">
          <div className="w-56 shrink-0">
            <FilterSelect label="Lọc theo vai trò"
              value={roleFilter}
              onChange={event => { setRoleFilter(event); setPage(1); }}
              className="form-control"
              aria-label="Lọc nhân viên theo vai trò"
            >
              <option value="all">Tất cả vai trò</option>
              {roles.map(role => <option key={role.id} value={role.id}>{role.role_name}</option>)}
            </FilterSelect>
          </div>
          <ActivityStatusFilter value={activityFilter} onChange={value => { setActivityFilter(value); setPage(1); }} />
          </div>
        }
      />

      <CatalogTable className="min-w-[980px]">
        <colgroup>
          <col className="w-[6%]" />
          <col className="w-[13%]" />
          <col className="w-[17%]" />
          <col className="w-[21%]" />
          <col className="w-[17%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead><tr><th className="stt-column">STT</th><th>Tên tài khoản</th><th>Họ và tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>
          {loading ? <CatalogLoadingRow colSpan={7} /> : pagedUsers.length === 0 ? (
            <tr><td colSpan={7}><EmptyState title="Không tìm thấy nhân viên" description="Hãy thay đổi từ khóa hoặc vai trò lọc." /></td></tr>
          ) : pagedUsers.map((user, index) => <tr key={user.id}><td className="stt-column text-slate-500">{(page - 1) * pageSize + index + 1}</td><td><span className="mono-code text-blue-700">@{user.username}</span></td><td className="font-medium text-slate-900">{user.name}</td><td className="text-slate-600">{user.email || '—'}</td><td><StatusBadge tone="info">{roleName(user)}</StatusBadge></td><td><StatusBadge tone={user.status ? 'success' : 'neutral'}>{user.status ? 'Đang hoạt động' : 'Đã khóa'}</StatusBadge></td><td className="whitespace-nowrap"><IconButton label={`Xem tài khoản ${user.username}`} tone="primary" onClick={() => setViewingUser(user)}><Eye className="size-4" /></IconButton><IconButton label={`Sửa tài khoản ${user.username}`} onClick={() => openEditModal(user)}><Edit className="size-4" /></IconButton><IconButton label={`Xóa tài khoản ${user.username}`} tone="danger" onClick={() => handleDelete(user)}><Trash2 className="size-4" /></IconButton></td></tr>)}
        </tbody>
      </CatalogTable>

      <CatalogPagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />

      {isModalOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="ui-dialog catalog-dialog max-h-[calc(100vh-40px)] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5"><h2 id="user-dialog-title" className="font-bold text-slate-900">{editingUser ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h2><IconButton label="Đóng biểu mẫu" onClick={() => setIsModalOpen(false)}><X className="size-5" /></IconButton></div><form onSubmit={handleSubmit} className="catalog-dialog-form grid grid-cols-2 gap-4 p-5"><div><label htmlFor="user-username" className="form-label">Tên đăng nhập<RequiredMark /></label><input id="user-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="form-control" required /></div><div><label htmlFor="user-password" className="form-label">{editingUser ? 'Mật khẩu mới (không bắt buộc)' : <>Mật khẩu<RequiredMark /></>}</label><input id="user-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} className="form-control" required={!editingUser} /></div><div><label htmlFor="user-name" className="form-label">Họ và tên<RequiredMark /></label><input id="user-name" value={name} onChange={event => setName(event.target.value)} className="form-control" required /></div><div><label htmlFor="user-email" className="form-label">Email làm việc<RequiredMark /></label><input id="user-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="form-control" required /></div><div className="col-span-2"><label htmlFor="user-role" className="form-label">Vai trò / phân quyền<RequiredMark /></label><select id="user-role" value={roleId} onChange={event => setRoleId(Number(event.target.value))} className="form-control" required>{roles.map(role => <option key={role.id} value={role.id}>{role.role_name}</option>)}</select></div><label className="col-span-2 flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><input type="checkbox" checked={status} onChange={event => setStatus(event.target.checked)} className="size-4 rounded border-slate-300" />Cho phép đăng nhập</label><div className="col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button type="submit">Lưu tài khoản</Button></div></form></div></div> : null}

      {viewingUser ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="user-detail-title" className="ui-dialog catalog-dialog catalog-detail-dialog w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"><div className="flex items-center justify-between border-b pb-3"><h2 id="user-detail-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserCheck className="size-5 text-blue-600" />Thông tin nhân viên</h2><IconButton label="Đóng chi tiết" onClick={() => setViewingUser(null)}><X className="size-5" /></IconButton></div><dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm"><dt className="text-slate-500">Tài khoản</dt><dd className="font-semibold text-blue-700">@{viewingUser.username}</dd><dt className="text-slate-500">Họ tên</dt><dd className="font-semibold">{viewingUser.name}</dd><dt className="text-slate-500">Email</dt><dd className="flex items-center gap-2"><Mail className="size-4 text-slate-400" />{viewingUser.email}</dd><dt className="text-slate-500">Vai trò</dt><dd><StatusBadge tone="info">{roleName(viewingUser)}</StatusBadge></dd></dl><Button className="w-full" variant="secondary" onClick={() => setViewingUser(null)}>Đóng</Button></div></div> : null}
    </div>
  );
}
