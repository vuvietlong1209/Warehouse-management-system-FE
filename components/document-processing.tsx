'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, Pencil, Plus, Printer, Trash2, X, XCircle, PackageCheck } from 'lucide-react';
import { Button, IconButton, WholeRowViewport, formatDateVN } from '@/components/ui';
import { ShortDateField } from '@/components/short-date-field';
import { SearchableSelect } from '@/components/searchable-select';
import { ReceiptPrint, IssuePrint } from '@/components/voucher-print';
import { DocumentEditForm } from '@/components/document-edit-form';
import { DocumentModal } from '@/components/document-modal';
import { DocumentOverview } from '@/components/document-overview';
import { DocumentOperationEditor, type OperationTab } from '@/components/document-operation-editor';
import { DocumentOperationDetail } from '@/components/document-operation-detail';
import { matchesDocumentSearch } from '@/components/document-filters';
import { useSecurityConfirmation } from '@/components/security-payment-confirm';
import { useFeedback } from '@/context/FeedbackContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { documentApi, documentPath, fmt, stateLabel, paymentPurposeLabel, type DocumentKind, type ManagedDocument, type Operation, type MovementDetail } from '@/lib/document-api';
import type { GoodsReceipt, GoodsIssue } from '@/types/warehouse';

type Tab = 'view' | OperationTab;
export function OperationStatus({ value }: { value: string }) {
  return <span className={`document-status ${['Completed','Confirmed'].includes(value) ? 'text-emerald-700' : ['Pending','Draft'].includes(value) ? 'text-amber-700' : value === 'Active' ? 'text-blue-700' : 'text-slate-600'}`}>{stateLabel[value] || value}</span>;
}
function OperationRows({ rows, payment, selected, onSelect, busy, onView, onEdit, onDelete, readOnly = false }: {
  rows: Operation[]; payment: boolean; selected: number[]; onSelect: (ids: number[]) => void; busy: boolean;
  onView: (row: Operation) => void; onEdit: (row: Operation) => void; onDelete: (row: Operation) => void; readOnly?: boolean;
}) {
  const pending = rows.filter(row => row.operation_status === 'Pending');
  return <div className="table-container flex min-h-0 flex-1 flex-col"><WholeRowViewport className="min-h-0 flex-1" label="Danh sách các lần xử lý"><table className="document-table operation-table w-full min-w-[800px] text-left text-[13px]">
    <thead className="sticky top-0 z-10 bg-slate-50"><tr className="table-header"><th className="w-10 text-center"><input type="checkbox" aria-label="Chọn tất cả lần chờ xác nhận" disabled={busy || readOnly || !pending.length} checked={!!pending.length && pending.every(row => selected.includes(row.id))} onChange={e => onSelect(e.target.checked ? pending.map(row => row.id) : [])} /></th><th>Mã lần</th><th className="text-center">Lần</th><th>Ngày {payment ? 'thanh toán' : 'thực hiện'}</th>{!payment && <th className="text-center">Số mặt hàng</th>}<th className="text-center">{payment ? 'Loại tiền' : 'Số lượng'}</th>{payment && <th className="text-center">Hình thức thanh toán</th>}<th className="text-right">Giá trị (₫)</th><th className="text-center">Trạng thái</th><th className="text-center">Thao tác</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.id}><td className="text-center"><input type="checkbox" aria-label={`Chọn ${row.code}`} disabled={busy || readOnly || row.operation_status !== 'Pending'} checked={selected.includes(row.id)} onChange={e => onSelect(e.target.checked ? [...selected,row.id] : selected.filter(id => id !== row.id))} /></td><td className="font-semibold text-blue-700">{row.code}</td><td className="text-center">{row.sequence_no}</td><td className="whitespace-nowrap text-slate-700">{formatDateVN(row.payment_date || row.operation_date)}</td>{!payment && <td className="text-center tabular-nums">{fmt(row.item_count)}</td>}<td className="text-center">{payment ? paymentPurposeLabel(row) : fmt(row.quantity)}</td>{payment && <td className="whitespace-nowrap text-center">{row.method || '—'}</td>}<td className="text-right tabular-nums">{fmt(row.amount)}</td><td className="text-center"><OperationStatus value={row.operation_status} /></td><td><div className="flex items-center justify-center gap-1"><Button size="sm" variant="secondary" disabled={busy} onClick={() => onView(row)}><Eye className="size-3.5" />Xem</Button>{!readOnly && row.operation_status === 'Pending' && <IconButton label={`Chỉnh sửa ${row.code}`} disabled={busy} onClick={() => onEdit(row)}><Pencil className="size-4" /></IconButton>}{!readOnly && ['Pending','Rejected','Cancelled'].includes(row.operation_status) && <IconButton label={`Xóa ${row.code}`} tone="danger" disabled={busy} onClick={() => onDelete(row)}><Trash2 className="size-4" /></IconButton>}</div></td></tr>)}{!rows.length && <tr><td colSpan={9} className="py-10 text-center text-slate-500">Chưa có lần {payment ? 'thanh toán' : 'giao nhận'}.</td></tr>}</tbody>
  </table></WholeRowViewport></div>;
}

export function DocumentProcessingDialog({ kind, id, onClose, onChanged }: { kind: DocumentKind; id: number; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const receipt = kind === 'receipt', path = documentPath(kind), label = receipt ? 'nhập' : 'xuất';
  const { notify, confirmAction, requestText, showAlert } = useFeedback();
  const { refreshAll, costingMethod } = useWarehouse();
  const { confirmSecurity, securityConfirmation, securityOpen } = useSecurityConfirmation();
  const [doc, setDoc] = useState<ManagedDocument | null>(null), [tab, setTab] = useState<Tab>('view');
  const [selections, setSelections] = useState<Partial<Record<Tab, number[]>>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [form, setForm] = useState<OperationTab | 'edit' | null>(null);
  const [view, setView] = useState<{ row: Operation; data?: any } | null>(null), [printing, setPrinting] = useState(false), [printDoc, setPrintDoc] = useState<any>(null);
  const [editing, setEditing] = useState<{ row: Operation; root: ManagedDocument; movement?: MovementDetail } | null>(null);
  const [filters, setFilters] = useState<Partial<Record<Tab, { search: string; from: string; to: string }>>>({});
  const { search = '', from = '', to = '' } = filters[tab] || {};
  const changeFilter = (name: 'search' | 'from' | 'to', value: string) => setFilters(current => ({ ...current, [tab]: { search, from, to, [name]: value } }));
  const active = useRef(false), mounted = useRef(true), version = useRef(0);
  const reload = useCallback(async () => {
    const current = ++version.current;
    const data = await documentApi<ManagedDocument>(`${path}/${id}`);
    if (!mounted.current || current !== version.current) return;
    setDoc(data);
  }, [id, path]);
  useEffect(() => { mounted.current = true; setError(''); void reload().catch(e => mounted.current && setError(e.message)); return () => { mounted.current = false; version.current++; }; }, [reload]);
  const run = async (action: () => Promise<void>, propagate = false, removed = false) => {
    if (active.current) return; active.current = true; setBusy(true); setError('');
    try { await action(); if (!removed) await reload(); await refreshAll(); await onChanged(); if (removed) onClose(); }
    catch (e) { if (propagate) throw e; setError((e as Error).message); }
    finally { active.current = false; if (mounted.current) setBusy(false); }
  };
  const readOnly = !!doc && ['Completed', 'Cancelled'].includes(doc.lifecycle_status);
  const rows = (tab === 'payment' ? doc?.payments || [] : doc?.movements || [])
    .filter(row => matchesDocumentSearch(search, row.code, row.reason, row.description, row.note, row.user_name)
      && (!from || (row.payment_date || row.operation_date || '').slice(0, 10) >= from) && (!to || (row.payment_date || row.operation_date || '').slice(0, 10) <= to));
  const selected = selections[tab] || [], pendingSelected = rows.filter(row => selected.includes(row.id) && row.operation_status === 'Pending')
    .sort((a, b) => (a.payment_date || a.operation_date || '').localeCompare(b.payment_date || b.operation_date || '') || a.id - b.id);
  const updateSelection = (ids: number[]) => setSelections(current => ({ ...current, [tab]: ids }));
  const inspect = async (row: Operation) => {
    try { const data = await documentApi(`/api/document-operations/${tab === 'payment' ? 'payments' : 'movements'}/${row.id}`); if (mounted.current) setView(tab === 'payment' ? { row: { ...row, ...data, root_code: data.root.code } } : { row: { ...row, ...data }, data }); }
    catch (e) { setError((e as Error).message); }
  };
  const editRow = async (row: Operation) => {
    if (readOnly || row.operation_status !== 'Pending') return;
    try { const data = await documentApi(`/api/document-operations/${tab === 'payment' ? 'payments' : 'movements'}/${row.id}`); if (data.operation_status !== 'Pending') throw new Error('Lần này không còn chờ xác nhận. Vui lòng tải lại.'); if (mounted.current) { setEditing({ row: data, root: data.root, movement: tab === 'payment' ? undefined : data }); setForm(tab as OperationTab); } }
    catch (e) { setError((e as Error).message); }
  };
  const deleteRow = async (row: Operation) => {
    if (readOnly || !await confirmAction({ title: `Xóa ${row.code}?`, message: 'Xóa lần này khỏi danh sách.', tone: 'danger', confirmLabel: 'Xóa lần' })) return;
    await run(async () => { await documentApi(`/api/document-operations/${tab === 'payment' ? 'payments' : 'movements'}/${row.id}`, 'DELETE', {}); updateSelection(selected.filter(id => id !== row.id)); });
  };
  const bulk = async (approve: boolean) => {
    if (readOnly || !pendingSelected.length) return;
    let reason = '';
    const deposits = tab === 'payment' ? pendingSelected.filter(row => row.purpose === 'SECURITY') : [];
    let securityAction: 'KEEP' | 'APPLY' | null = null;
    if (approve && deposits.length) { securityAction = await confirmSecurity(deposits.reduce((sum,row)=>sum+Number(row.amount),0),deposits.length,pendingSelected.length); if (!securityAction) return; }
    else if (approve) { if (!await confirmAction({ title: `Xác nhận ${pendingSelected.length} lần?`, message: tab === 'payment' ? 'Ghi nhận các khoản tiền đã chọn.' : 'Cập nhật tồn kho theo các lần đã chọn.', confirmLabel: 'Xác nhận' })) return; }
    else { const value = await requestText({ title: 'Từ chối các lần đã chọn', label: 'Lý do', required: true, confirmLabel: 'Từ chối' }); if (!value) return; reason = value; }
    await run(async () => {
      const failures: string[] = [], done: number[] = [];
      for (const row of pendingSelected) {
        try { await documentApi(`/api/document-operations/${tab === 'payment' ? 'payments' : 'movements'}/${row.id}/${approve ? 'confirm' : 'reject'}`, 'POST', { reason, costing_method: costingMethod, ...(approve && row.purpose === 'SECURITY' ? { security_action: securityAction } : {}) }); done.push(row.id); }
        catch (e) { failures.push(`${row.code}: ${(e as Error).message}`); }
      }
      updateSelection(selected.filter(id => !done.includes(id)));
      notify({ tone: failures.length ? 'warning' : 'success', title: `Thành công ${done.length} · Không thành công ${failures.length}` });
      if (failures.length) setError(failures.join('\n'));
    });
  };
  const complete = async () => {
    if (!doc || !await confirmAction({ title: 'Xác nhận hoàn thành đơn?', message: `Hoàn tất ${doc.code}. Đơn sẽ chỉ cho phép xem và in.`, confirmLabel: 'Hoàn thành đơn' })) return;
    await run(async () => { await documentApi(`${path}/${id}/complete`, 'POST', { confirm_complete: true }); setTab('view'); });
  };
  const reserve = async () => {
    if(!doc||receipt||doc.lifecycle_status!=='Draft'||!await confirmAction({title:'Xác nhận giữ chỗ?',message:`Giữ chỗ ${fmt(doc.remaining_quantity)} đơn vị còn phải xuất của đơn ${doc.code}.`,confirmLabel:'Giữ chỗ'}))return;
    await run(async()=>{await documentApi(`${path}/${id}/reserve`,'POST',{confirm_reserve:true});notify({tone:'success',title:'Đã giữ chỗ',message:'Đơn đã chuyển sang Đang thực hiện.'});});
  };
  const removeRoot = async () => {
    if (!doc) return;
    if (!doc.can_delete) { showAlert({ title: 'Không thể xóa đơn', message: 'Đơn đã có giao dịch hoặc thanh toán được xác nhận, hoặc đã hoàn thành.', tone: 'warning' }); return; }
    if (!await confirmAction({ title: `Xóa đơn ${doc.code}?`, message: 'Xóa đơn khỏi danh sách.', tone: 'danger', confirmLabel: 'Xóa đơn' })) return;
    await run(async () => { await documentApi(`${path}/${id}`, 'DELETE', {}); notify({ tone: 'success', title: 'Đã xóa đơn' }); }, false, true);
  };
  const tabs: { id: Tab; label: string }[] = [{ id: 'view', label: 'Xem' }, { id: 'movement', label: `Các lần ${label} kho` }, { id: 'payment', label: 'Thanh toán' }];
  const createLabel = tab === 'payment' ? 'Tạo thanh toán' : `Ghi nhận lần ${label}`;
  const exhausted = !receipt && tab === 'movement' && !!doc && !doc.items.some(d => d.recordable_quantity > 0);
  const overlay = !!form || !!view || printing || securityOpen;
  const editorDoc = editing?.root || doc;
  const closeForm = () => { setForm(null); setEditing(null); };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-xs">
    <section ref={node => { if (node) node.inert = overlay; }} aria-hidden={overlay || undefined} role="dialog" aria-modal="true" aria-label={`Xử lý đơn ${doc?.code || ''}`} className="ui-dialog document-processing-dialog flex h-[90dvh] max-h-[900px] w-full max-w-[1360px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5"><div className="min-w-0"><h2 className="text-base font-bold text-slate-900">{`Xử lý đơn ${doc?.code || ''}`}</h2>{doc && <p className="mt-1 text-xs text-slate-700">{doc.warehouse_name} · {doc.partner_name} · <OperationStatus value={doc.lifecycle_status} /></p>}</div><div className="flex shrink-0 items-center gap-2">
        {doc && !receipt && doc.lifecycle_status==='Draft' && <Button size="sm" disabled={busy} onClick={reserve}><PackageCheck className="size-3.5" />Giữ chỗ</Button>}
        {doc && <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setPrintDoc(null); setPrinting(true); }}><Printer className="size-3.5" />In phiếu</Button>}
        <IconButton label="Đóng xử lý đơn" disabled={busy} onClick={onClose}><X className="size-5" /></IconButton></div></header>
      <nav className="document-switch-tabs" aria-label="Nội dung xử lý đơn"><div role="tablist" className="flex min-w-0 items-center gap-2 overflow-x-auto">{tabs.map(item => <button role="tab" aria-selected={tab === item.id} aria-controls={`document-panel-${item.id}`} key={item.id} disabled={busy} onClick={() => setTab(item.id)} className={`document-switch-tab ${tab === item.id ? 'is-active' : ''}`}>{item.label}</button>)}</div>
        {doc && !readOnly && tab !== 'view' && <div className="ml-auto flex shrink-0 items-center gap-2 pl-2"><span title={exhausted ? 'Không còn lượng xuất có thể ghi nhận.' : undefined}><Button size="sm" disabled={busy || exhausted} onClick={() => setForm(tab as OperationTab)}><Plus className="size-3.5" />{createLabel}</Button></span></div>}
      </nav>
      {error && <div role="alert" className="max-h-28 shrink-0 overflow-auto whitespace-pre-line border-b border-rose-100 bg-rose-50 px-5 py-2 text-sm text-rose-800">{error}</div>}
      {!doc && !error && <p className="p-6">Đang tải đơn…</p>}
      {doc && tab === 'view' && <DocumentOverview kind={kind} doc={doc} />}
      {tab !== 'view' && <>
        <div id={`document-panel-${tab}`} role="tabpanel" className="shrink-0 border-b px-4 py-3"><div className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 form-label !mb-0">Tìm kiếm<input className="form-control mt-1" value={search} onChange={e => changeFilter('search', e.target.value)} placeholder="Mã lần, nội dung, người lập…" /></label><label className="w-40 form-label !mb-0">Từ ngày<ShortDateField label="Từ ngày xử lý" value={from} onChange={value => changeFilter('from', value)} max={to || undefined} /></label><label className="w-40 form-label !mb-0">Đến ngày<ShortDateField label="Đến ngày xử lý" value={to} onChange={value => changeFilter('to', value)} min={from || undefined} /></label></div>
          {tab === 'payment' && doc && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700"><span>Đã thanh toán: <b>{fmt(doc.settled_amount)} ₫</b></span><span>Còn thanh toán: <b>{fmt(doc.outstanding_amount)} ₫</b></span><span>Ứng trước: <b>{fmt(doc.advance_balance)} ₫</b></span><span>Cọc bảo đảm: <b>{fmt(doc.security_balance)} ₫</b></span></div>}
        </div>
        <OperationRows rows={rows} payment={tab === 'payment'} selected={selected} onSelect={updateSelection} busy={busy} onView={inspect} onEdit={editRow} onDelete={deleteRow} readOnly={readOnly} />
      </>}
      {!readOnly && <footer className="document-processing-actions flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-slate-50 px-3 py-2">
        {tab !== 'view' && <><Button size="sm" variant="secondary" disabled={busy || !pendingSelected.length} onClick={() => bulk(false)}><XCircle className="size-3.5" />Từ chối ({pendingSelected.length})</Button><Button size="sm" variant="success" title={!receipt&&tab==='movement'&&doc?.lifecycle_status==='Draft'?'Giữ chỗ trước khi xác nhận xuất kho':undefined} disabled={busy || !pendingSelected.length || (!receipt&&tab==='movement'&&doc?.lifecycle_status==='Draft')} onClick={() => bulk(true)}><CheckCircle2 className="size-3.5" />Xác nhận ({pendingSelected.length})</Button></>}
        {doc && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => setForm('edit')}><Pencil className="size-3.5" />Điều chỉnh đơn</Button>
          <Button size="sm" variant="secondary" className="!text-rose-700" disabled={busy} onClick={removeRoot}><Trash2 className="size-3.5" />Xóa đơn</Button>
          <span title={doc.completion_reason || undefined}><Button size="sm" disabled={busy || !!doc.completion_reason} onClick={complete}>Hoàn thành đơn</Button></span></>}
      </footer>}
    </section>
    {form && editorDoc && <DocumentModal title={form === 'edit' ? 'Điều chỉnh đơn' : editing ? `Chỉnh sửa ${editing.row.code}` : createLabel} onClose={closeForm} busy={busy} wide={form === 'movement' || form === 'edit'} className={form === 'movement' ? 'document-movement-dialog document-compact-movement-dialog' : ''}>
      {form === 'edit' ? <DocumentEditForm kind={kind} doc={editorDoc} busy={busy} onCancel={closeForm} onSave={body => run(async () => { await documentApi(`${path}/${id}`, 'PUT', body); closeForm(); notify({ tone: 'success', title: 'Đã cập nhật đơn' }); }, true)} />
        : <DocumentOperationEditor kind={kind} doc={editorDoc} tab={form} movement={editing?.movement} payment={form === 'payment' ? editing?.row : undefined} busy={busy} onCancel={closeForm} onSave={body => run(async () => { await documentApi(editing ? `/api/document-operations/${form === 'payment' ? 'payments' : 'movements'}/${editing.row.id}` : `${path}/${id}/${form === 'payment' ? 'payments' : 'movements'}`, editing ? 'PUT' : 'POST', body); closeForm(); notify({ tone: 'success', title: editing ? 'Đã cập nhật lần chờ xác nhận' : 'Đã lưu lần chờ xác nhận' }); }, true)} />}
    </DocumentModal>}
    {printing && doc && <DocumentModal title={`In đơn ${doc.code}`} wide onClose={() => setPrinting(false)} actions={<>
      <SearchableSelect id="print-execution" label="Chọn chứng từ để in" wrapperClassName="w-52 sm:w-64" className="!min-h-8 !h-8 !px-2 !text-xs" value={printDoc?.id || ''} options={[{ value: '', label: 'Đơn gốc · Lượng yêu cầu' }, ...doc.movements.map(m => ({ value: m.id, label: `${m.code} · ${formatDateVN(m.operation_date)} · ${stateLabel[m.operation_status]}` }))]} onChange={async value => { if (!value) { setPrintDoc(null); return; } try { const m = await documentApi(`/api/document-operations/movements/${value}`); setPrintDoc({ ...doc, ...m, order_date: m.operation_date, items: m.items }); } catch (e) { setError((e as Error).message); } }} />
      <Button size="sm" className="shrink-0" onClick={() => window.print()}><Printer className="size-3.5" />In phiếu (A4)</Button>
    </>}>
      <div className="min-h-0 flex-1 overflow-auto">{receipt ? <ReceiptPrint document={(printDoc || doc) as unknown as GoodsReceipt} /> : <IssuePrint document={(printDoc || doc) as unknown as GoodsIssue} />}</div>
    </DocumentModal>}
    {view && <DocumentModal title={`Xem ${view.row.code}`} wide={!!view.data} className={view.data ? 'document-operation-detail-dialog' : ''} style={view.data?{height:Math.min(660,340+Math.min(6,view.data.items.filter((line:any)=>Number(line.quantity)>0).length)*52+(view.data.description||view.row.description?96:0)+(view.row.reason?64:0))}:undefined} onClose={() => setView(null)}>
      <DocumentOperationDetail row={view.row} movement={view.data} />
      <footer className="flex shrink-0 justify-end gap-2 border-t p-3 no-print"><Button variant="secondary" onClick={() => setView(null)}>Đóng</Button></footer>
    </DocumentModal>}
    {securityConfirmation}
  </div>;
}

