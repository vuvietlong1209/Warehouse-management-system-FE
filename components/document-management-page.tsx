'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, PackageCheck, PackagePlus, Plus } from 'lucide-react';
import { Button, PageHeader, CatalogPagination, WholeRowViewport, formatDateVN } from '@/components/ui';
import { DocumentFilters, emptyDocumentFilters, matchesDocumentSearch } from '@/components/document-filters';
import { DocumentProcessingDialog, OperationStatus } from '@/components/document-processing';
import { IssueAvailabilityDialog } from '@/components/issue-availability-dialog';
import { ReplenishmentDialog } from '@/components/replenishment-dialog';
import { documentApi, documentPath, fmt, type DocumentKind, type ManagedDocument } from '@/lib/document-api';
import { useWarehouse } from '@/context/WarehouseContext';

export function DocumentManagementPage({kind}: {kind:DocumentKind}) {
  const receipt=kind==='receipt',noun=receipt?'nhập':'xuất',path=documentPath(kind),router=useRouter();
  const {warehouses,partners,items,bins,units,getItemStock,getItemAvailableStock,dataRevision}=useWarehouse();
  const [documents,setDocuments]=useState<ManagedDocument[]>([]),[filters,setFilters]=useState(emptyDocumentFilters),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
  const [processing,setProcessing]=useState<number | null>(null),[proposal,setProposal]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{try{setDocuments(await documentApi(path));setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[path]);
  useEffect(()=>{let live=true;documentApi<ManagedDocument[]>(path).then(data=>{if(live){setDocuments(data);setError('');}}).catch(e=>live&&setError(e.message)).finally(()=>live&&setLoading(false));return()=>{live=false;};},[path,dataRevision]);
  const filtered=useMemo(()=>documents.filter(d=>matchesDocumentSearch(filters.search,d.code,d.partner_name,d.warehouse_name)&&(!filters.fromDate||d.order_date.slice(0,10)>=filters.fromDate)&&(!filters.toDate||d.order_date.slice(0,10)<=filters.toDate)&&(!filters.warehouseId||d.warehouse_id===Number(filters.warehouseId))&&(!filters.partnerId||d.partner_id===Number(filters.partnerId))&&(!filters.status||d.lifecycle_status===filters.status)),[documents,filters]);
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pages),visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize);
  return <div className="catalog-page document-list-page managed-documents">
    <PageHeader title={`Đơn ${noun}`} actions={<><Button variant="secondary" onClick={()=>setProposal(true)}>{receipt?<PackagePlus className="size-4" />:<PackageCheck className="size-4" />}{receipt?'Xem lượng cần nhập':'Xem xuất kho khả thi'}</Button><Link className="ui-button-primary" href={`/documents/goods-${receipt?'receipts':'issues'}/create`}><Plus className="size-4" />Tạo đơn {noun}</Link></>} />
    <DocumentFilters searchPlaceholder="Mã đơn, kho hoặc đối tác..." statusLabel="Trạng thái đơn" idPrefix={`managed-${kind}`} filters={filters} onApply={value=>{setFilters(value);setPage(1);}} warehouses={warehouses} warehouseLabel={`Kho ${noun}`} partners={partners} partnerLabel={receipt?'Nhà cung cấp':'Khách hàng / Đại lý'} statuses={(receipt?['Active','Completed','Cancelled']:['Draft','Active','Completed','Cancelled']).map(value=>({value,label:value==='Draft'?'Mới lập':value==='Active'?'Đang thực hiện':value==='Completed'?'Hoàn thành':'Đã hủy'}))} />
    {error&&<p role="alert" className="shrink-0 text-sm text-rose-700">{error}</p>}
    <div className="table-container flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"><WholeRowViewport className="min-h-0 flex-1" label={`Danh sách đơn ${noun}`} fillPage><table className="document-table w-full min-w-[1120px] text-left text-[13px]">
      <thead className="sticky top-0 z-10 bg-slate-50"><tr className="table-header"><th>Mã đơn</th><th>Ngày lập</th><th>Kho hàng</th><th>{receipt?'Nhà cung cấp':'Khách hàng / Đại lý'}</th><th className="text-center">Yêu cầu</th><th className="text-right">Tổng giá trị (₫)</th><th className="text-right">Còn thanh toán (₫)</th><th className="text-center">Trạng thái</th><th className="text-center">Thao tác</th></tr></thead>
      <tbody>{visible.map(doc=><tr key={doc.id}><td className="document-code">{doc.code}</td><td className="document-date">{formatDateVN(doc.order_date)}</td><td className="min-w-36 font-medium text-slate-800">{doc.warehouse_name}</td><td className="min-w-44 font-medium text-slate-700">{doc.partner_name}</td><td className="document-count text-center tabular-nums">{fmt(doc.items.reduce((s,d)=>s+Number(d.quantity_ordered),0))}</td><td className="document-amount">{fmt(doc.planned_amount)}</td><td className="document-amount">{fmt(doc.outstanding_amount)}</td><td className="text-center"><OperationStatus value={doc.lifecycle_status} /></td><td><div className="flex items-center justify-center gap-1 whitespace-nowrap"><Button size="sm" variant="secondary" onClick={()=>setProcessing(doc.id)}><FileText className="size-3.5" />Xử lý đơn</Button></div></td></tr>)}{!visible.length&&<tr><td colSpan={9} className="py-12 text-center text-slate-600">{loading?'Đang tải danh sách…':'Không có đơn phù hợp.'}</td></tr>}</tbody>
    </table></WholeRowViewport><div className="shrink-0 border-t px-4 py-2 text-xs text-slate-600">Hiển thị {visible.length} / {filtered.length} đơn {noun}</div></div>
    <CatalogPagination page={safePage} totalPages={pages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1);}} />
    {processing!==null&&<DocumentProcessingDialog key={`${kind}-${processing}`} kind={kind} id={processing} onClose={()=>setProcessing(null)} onChanged={load} />}
    {proposal&&(receipt?<ReplenishmentDialog warehouses={warehouses} initialWarehouseId={Number(filters.warehouseId)||undefined} onUseSelection={(selection,warehouse)=>{setProposal(false);const query=new URLSearchParams({items:selection.map(row=>row.itemId).join(',')});if(warehouse)query.set('warehouse_id',String(warehouse));router.push(`/documents/goods-receipts/create?${query}`);}} onClose={()=>setProposal(false)} />:<IssueAvailabilityDialog items={items} bins={bins} warehouses={warehouses} units={units} getItemStock={getItemStock} getItemAvailableStock={getItemAvailableStock} initialWarehouseId={Number(filters.warehouseId)||undefined} onUseSelection={selection=>{setProposal(false);const query=new URLSearchParams({warehouse_id:String(selection[0].warehouseId),lines:selection.map(row=>`${row.itemId}:${row.binId}`).join(',')});router.push(`/documents/goods-issues/create?${query}`);}} onClose={()=>setProposal(false)} />)}
  </div>;
}
