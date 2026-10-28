'use client';

import { FilterSelect } from '@/components/filter-select';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWarehouse } from '@/context/WarehouseContext';
import { ShortDateField } from '@/components/short-date-field';
import { FilePlus2, Search, RefreshCw, ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react';
import { Button, CatalogPagination, PageHeader, WholeRowViewport, formatDateVN } from '@/components/ui';
import { costingCells, costingColumns, costingTotals, formatReportCell, type CostingRow, type ReportType } from '@/lib/report-builder';

const ReportBuilderDialog = dynamic(() => import('@/components/report-builder-dialog').then(module => module.ReportBuilderDialog), { ssr: false });


type PageInfo = { page: number; page_size: number; total: number; total_pages: number };
type InventoryRow = { id:number; code:string; name:string; unit:string; beginning_quantity:number; beginning_value:number; import_quantity:number; import_value:number; export_quantity:number; export_value:number; adjustment_quantity:number; ending_quantity:number; ending_value:number };

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const amount = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export default function ReportsPage() {
  return <Suspense fallback={<p className="p-4 text-sm text-slate-700">Đang tải báo cáo...</p>}><ReportsContent/></Suspense>;
}

function ReportsContent() {
  const searchParams = useSearchParams(), requestedReport = searchParams.get('report');
  const { warehouses, goodsReceipts, goodsIssues, inventoryChecks, dataRevision } = useWarehouse();
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>(requestedReport === 'COGS' ? 'COGS' : 'NXT');
  useEffect(() => { if (requestedReport === 'COGS') setReportType('COGS'); }, [requestedReport]);
  const printSize = 'A4';
  const [builderOpen, setBuilderOpen] = useState(false);
  const [fromDate, setFromDate] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(iso(now));
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const request = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [costingRows, setCostingRows] = useState<CostingRow[]>([]);
  const [inventorySummary, setInventorySummary] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<PageInfo>({ page:1, page_size:25, total:0, total_pages:0 });

  const query = useMemo(() => new URLSearchParams({
    from_date: reportType === 'STOCK' ? toDate : fromDate, to_date: toDate, page: String(page), page_size: String(pageSize),
    ...(warehouseId ? { warehouse_id: warehouseId } : {}), ...(search.trim() ? { search: search.trim() } : {}),
  }).toString(), [reportType, fromDate, toDate, warehouseId, search, page, pageSize]);

  const loadReport = useCallback(async () => {
    request.current?.abort();
    if (!['NXT','STOCK','COGS'].includes(reportType)) { setLoading(false); setError(null); return; }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(null);
    try {
      const endpoint = reportType === 'COGS' ? 'costing' : 'inventory-summary';
      const response = await fetch(`/api/reports/${endpoint}?${query}`, { cache: 'no-store', signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.error || 'Không tải được báo cáo');
      if (controller.signal.aborted) return;
      if (!body.data.length && page > 1) { setPage(1); return; }
      setPagination(body.pagination);
      if (reportType === 'COGS') setCostingRows(body.data); else setInventoryRows(body.data);
      setInventorySummary(body.summary);
    } catch (cause:any) { if (!controller.signal.aborted) setError(cause.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [query, reportType, page, dataRevision]);

  useEffect(() => { const timer=setTimeout(loadReport, 250); return () => { clearTimeout(timer); request.current?.abort(); }; }, [loadReport]);
  useEffect(() => setPage(1), [reportType, fromDate, toDate, warehouseId, search, pageSize]);

  const inRange = useCallback((date:string, selectedWarehouse:number) => {
    const day=date.slice(0,10);
    return day>=fromDate && day<=toDate && (!warehouseId || selectedWarehouse===Number(warehouseId));
  }, [fromDate,toDate,warehouseId]);
  const normalizedSearch=search.trim().toLowerCase();
  const filteredPO=useMemo(()=>goodsReceipts.filter(row=>inRange(row.order_date,row.warehouse_id)&&(!normalizedSearch||row.code.toLowerCase().includes(normalizedSearch)||(row.partner_name||'').toLowerCase().includes(normalizedSearch))),[goodsReceipts,inRange,normalizedSearch]);
  const filteredSO=useMemo(()=>goodsIssues.filter(row=>inRange(row.order_date,row.warehouse_id)&&(!normalizedSearch||row.code.toLowerCase().includes(normalizedSearch)||(row.partner_name||'').toLowerCase().includes(normalizedSearch))),[goodsIssues,inRange,normalizedSearch]);
  const filteredIC=useMemo(()=>inventoryChecks.filter(row=>inRange(row.to_date,row.warehouse_id)&&(!normalizedSearch||row.code.toLowerCase().includes(normalizedSearch))),[inventoryChecks,inRange,normalizedSearch]);

  const serverPaged = ['NXT', 'STOCK', 'COGS'].includes(reportType);
  const documentRows = reportType === 'PO' ? filteredPO : reportType === 'SO' ? filteredSO : filteredIC;
  const totalPages = serverPaged ? Math.max(1, pagination.total_pages) : Math.max(1, Math.ceil(documentRows.length / pageSize));
  const currentPage = serverPaged ? pagination.page : Math.min(page, totalPages);
  const offset = (currentPage - 1) * (serverPaged ? pagination.page_size : pageSize);
  const visibleDocuments = documentRows.slice(offset, offset + pageSize);
  useEffect(() => { if (!serverPaged && page > totalPages) setPage(totalPages); }, [serverPaged, page, totalPages]);

  const tabs:[ReportType,string][]=[['NXT','Nhập - Xuất - Tồn'],['STOCK','Tồn kho'],['COGS','Giá vốn và lợi nhuận'],['PO','Phiếu nhập'],['SO','Phiếu xuất'],['KK','Kiểm kê']];
  const reportTitle = reportType==='COGS'?'BÁO CÁO GIÁ VỐN VÀ LỢI NHUẬN':reportType==='STOCK'?'BÁO CÁO TỒN KHO':reportType==='NXT'?'BÁO CÁO TỔNG HỢP NHẬP - XUẤT - TỒN KHO':reportType==='PO'?'BẢNG KÊ CHỨNG TỪ PHIẾU NHẬP KHO':reportType==='SO'?'BẢNG KÊ CHỨNG TỪ PHIẾU XUẤT KHO':'BẢNG KÊ BIÊN BẢN KIỂM KÊ';
  const formCode = reportType==='COGS'?'BC-KHO-06':reportType==='STOCK'?'BC-KHO-07':reportType==='NXT'?'BC-KHO-01':reportType==='PO'?'BC-KHO-03':reportType==='SO'?'BC-KHO-04':'BC-KHO-05';
  return <div className="paged-data-page" data-compact-report>
    <style>{`@media print { @page { size: ${printSize} ${['NXT','COGS'].includes(reportType)?'landscape':'portrait'}; margin: 10mm; } }`}</style>
    <PageHeader title="Báo cáo quản trị kho" actions={<div className="no-print flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={()=>void loadReport()}><RefreshCw className={`size-4 ${loading?'animate-spin':''}`}/>Làm mới</Button>
      <Button aria-haspopup="dialog" onClick={() => setBuilderOpen(true)}><FilePlus2 className="size-4" />Tạo báo cáo</Button>
    </div>} />
    <div className="report-control-panel no-print">
      <div className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${reportType === 'STOCK' ? 'min-[1152px]:grid-cols-[1.3fr_1fr_1fr_1.4fr]' : 'min-[1152px]:grid-cols-[1.3fr_.9fr_.9fr_1fr_1.4fr]'}`}>
        <FilterSelect label="Chọn báo cáo phân tích" aria-label="Chọn báo cáo phân tích" value={reportType} onChange={e=>setReportType(e as ReportType)} className="form-control">{tabs.map(([key,label])=><option key={key} value={key}>{label}</option>)}</FilterSelect>
        {reportType !== 'STOCK' && <ShortDateField label="Từ ngày" value={fromDate} onChange={setFromDate}/>}
        <ShortDateField label={reportType === 'STOCK' ? 'Tồn kho đến ngày' : 'Đến ngày'} value={toDate} min={reportType === 'STOCK' ? undefined : fromDate} onChange={setToDate}/>
        <FilterSelect label="Lọc báo cáo theo kho" aria-label="Lọc báo cáo theo kho" value={warehouseId} onChange={e=>setWarehouseId(e)} className="form-control"><option value="">Tất cả kho</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</FilterSelect>
        <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input aria-label="Tìm trong báo cáo" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mã, tên, đối tác..." className="form-control pl-8"/></div>
      </div>
    </div>
    {error&&<div className="no-print rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</div>}
    <section className={`printable-area report-document report-screen-panel paged-list-panel print-page-${printSize.toLowerCase()}`}>
      <header className="report-print-header mb-5">
        <div className="flex justify-between items-start border-b-2 border-black pb-2">
          <div><p className="font-bold text-sm uppercase">ĐƠN VỊ: QUẢN LÝ KHO & THEO DÕI TỒN KHO</p><p className="text-xs mt-0.5">Bộ phận: Quản lý hàng tồn kho</p></div>
          <div className="text-right"><p className="font-bold text-xs">Mẫu số: {formCode}</p><p className="text-[10px] italic">Báo cáo quản trị nội bộ</p></div>
        </div>
        <div className="text-center pt-4"><h2 className="text-xl font-bold uppercase">{reportTitle}</h2><p className="date-value text-xs italic mt-1">{reportType === 'STOCK' ? `Tính đến ngày ${formatDateVN(toDate)}` : `Từ ngày ${formatDateVN(fromDate)} đến ngày ${formatDateVN(toDate)}`}</p></div>
        <div className="grid grid-cols-2 gap-4 text-xs mt-4"><p><b>Kho:</b> {warehouseId?warehouses.find(w=>w.id===Number(warehouseId))?.name:'Tất cả kho hàng'}</p><p className="date-value text-right"><b>Ngày lập:</b> {formatDateVN(new Date().toISOString())}</p></div>
      </header>
      {loading?<div className="py-16 text-center text-slate-500">Đang tổng hợp số liệu...</div>:reportType==='COGS'?<><CostingKpis summary={inventorySummary}/><CostingTable rows={costingRows} summary={inventorySummary} offset={offset}/></>:reportType==='STOCK'?<StockTable rows={inventoryRows} summary={inventorySummary} offset={offset}/>:reportType==='NXT'?<><InventoryKpis summary={inventorySummary}/><InventoryTable rows={inventoryRows} summary={inventorySummary} offset={offset}/></>:<DocumentReport type={reportType} rows={visibleDocuments} allRows={documentRows} offset={offset}/>} 
      <div className="print-signatures hidden mt-10 grid-cols-4 text-center text-xs"><div><b>NGƯỜI LẬP BIỂU</b><p className="italic mt-1">(Ký, ghi rõ họ tên)</p></div><div><b>THỦ KHO</b><p className="italic mt-1">(Ký, ghi rõ họ tên)</p></div><div><b>KẾ TOÁN TRƯỞNG</b><p className="italic mt-1">(Ký, ghi rõ họ tên)</p></div><div><b>GIÁM ĐỐC</b><p className="italic mt-1">(Ký, đóng dấu)</p></div></div>
    </section>
    <CatalogPagination page={currentPage} totalPages={totalPages} pageSize={pageSize} disabled={serverPaged && loading}
      onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
    {builderOpen && <ReportBuilderDialog warehouses={warehouses} initialCriteria={{ reportType, fromDate, toDate, warehouseId, search, format: 'PDF', paperSize: 'A4' }} onClose={() => setBuilderOpen(false)} />}
  </div>;
}

function ReportKpi({icon,label,value,color='text-slate-900'}:{icon?:React.ReactNode;label:string;value:string;color?:string}) { return <div className="report-kpi-card"><div className="flex items-center gap-2">{icon}<p className="report-kpi-label">{label}</p></div><p className={`report-kpi-value ${color}`} title={value}>{value}</p></div> }

function InventoryKpis({summary}:{summary:Record<string,number>}) { return <div className="report-kpi-grid"><ReportKpi icon={<Wallet className="size-4 text-slate-500"/>} label="Tồn đầu kỳ" value={`${number.format(summary.beginning_quantity||0)} đơn vị`}/><ReportKpi icon={<ArrowDownToLine className="size-4 text-emerald-600"/>} label="Nhập trong kỳ" value={`${number.format(summary.import_quantity||0)} đơn vị`} color="text-emerald-700"/><ReportKpi icon={<ArrowUpFromLine className="size-4 text-blue-600"/>} label="Xuất trong kỳ" value={`${number.format(summary.export_quantity||0)} đơn vị`} color="text-blue-700"/><ReportKpi icon={<Wallet className="size-4 text-blue-600"/>} label="Tồn cuối kỳ" value={`${number.format(summary.ending_quantity||0)} đơn vị`} color="text-blue-700"/></div> }

function InventoryTable({rows,summary,offset}:{rows:InventoryRow[];summary:Record<string,number>;offset:number}) { const isMoney=(index:number)=>[1,3,5,8].includes(index); return <WholeRowViewport key={rows.map(row => row.id).join(',')} className="report-table-wrap" label="Danh sách báo cáo"><table className="report-table inventory-report-table min-w-[1320px] w-full border-collapse"><thead><tr><th rowSpan={2} className="stt-column">STT</th><th rowSpan={2} >Mã SP</th><th rowSpan={2} >Tên sản phẩm</th><th rowSpan={2}>ĐVT</th><th colSpan={2}>Đầu kỳ</th><th colSpan={2}>Nhập trong kỳ</th><th colSpan={2}>Xuất trong kỳ</th><th rowSpan={2} className="text-center">Điều chỉnh</th><th colSpan={2}>Cuối kỳ</th></tr><tr><th className="text-center">SL</th><th className="text-center">Giá trị (VNĐ)</th><th className="text-center">SL</th><th className="text-center">Giá trị (VNĐ)</th><th className="text-center">SL</th><th className="text-center">Giá trị (VNĐ)</th><th className="text-center">SL</th><th className="text-center">Giá trị (VNĐ)</th></tr></thead><tbody>{!rows.length && <ReportEmptyRow columns={13} />}{rows.map((r,i)=><tr key={r.id}><td className="stt-column">{offset+i+1}</td><td className="font-semibold text-blue-700">{r.code}</td><td className="min-w-56 font-medium text-slate-800">{r.name}</td><td>{r.unit}</td>{[r.beginning_quantity,r.beginning_value,r.import_quantity,r.import_value,r.export_quantity,r.export_value,r.adjustment_quantity,r.ending_quantity,r.ending_value].map((v,j)=><td key={j} className="text-center">{isMoney(j)?amount.format(Number(v)):number.format(Number(v))}</td>)}</tr>)}</tbody><tfoot><tr><th colSpan={4}>TỔNG CỘNG</th>{['beginning_quantity','beginning_value','import_quantity','import_value','export_quantity','export_value','adjustment_quantity','ending_quantity','ending_value'].map((key,j)=><th key={key} className="text-center">{isMoney(j)?amount.format(summary[key]||0):number.format(summary[key]||0)}</th>)}</tr></tfoot></table></WholeRowViewport> }


function documentStatus(status:string) { const labels:Record<string,string>={Pending:'Chờ duyệt',Confirmed:'Đã xác nhận',Rejected:'Đã từ chối',InProgress:'Đang thực hiện',Completed:'Đã hoàn tất',Cancelled:'Đã hủy'}; const tone=['Confirmed','Completed'].includes(status)?'text-emerald-700':['Pending','InProgress'].includes(status)?'text-amber-700':['Rejected'].includes(status)?'text-rose-700':'text-slate-500'; return {label:labels[status]||status,tone}; }

function DocumentReport({type,rows,allRows,offset}:{type:ReportType;rows:any[];allRows:any[];offset:number}) { const lineCount=allRows.reduce((sum,row)=>sum+(row.items||row.details||[]).length,0); const totalValue=allRows.reduce((sum,row)=>sum+(row.items||[]).reduce((value:number,line:any)=>value+Number(line.inventory_value ?? Number(line.quantity_ordered||0)*Number(line.unit_price||0)),0),0); return <div className="paged-report-body"><div className="report-kpi-grid report-kpi-grid-three"><ReportKpi label="Số chứng từ" value={`${number.format(allRows.length)} phiếu`}/><ReportKpi label="Tổng số dòng" value={`${number.format(lineCount)} dòng`}/><ReportKpi label={type==='KK'?'Nghiệp vụ kiểm kê':'Tổng giá trị'} value={type==='KK'?`${number.format(allRows.length)} biên bản`:money.format(totalValue)}/></div><DocumentTable type={type} rows={rows} offset={offset}/></div> }

function DocumentTable({type,rows,offset}:{type:ReportType;rows:any[];offset:number}) { return <WholeRowViewport key={rows.map(row => row.id).join(',')} className="report-table-wrap" label="Danh sách báo cáo"><table className="report-table min-w-[920px] w-full"><thead><tr><th className="stt-column">STT</th><th>Ngày</th><th>Mã chứng từ</th><th>Kho</th><th>Đối tác/Người lập</th><th className="text-center">Trạng thái</th><th className="text-center">Số dòng</th>{type!=='KK'&&<th className="text-center">Giá trị</th>}</tr></thead><tbody>{!rows.length && <ReportEmptyRow columns={type === 'KK' ? 7 : 8} />}{rows.map((r,i)=>{const lines=r.items||r.details||[]; const value=lines.reduce((s:number,x:any)=>s+Number(x.inventory_value ?? Number(x.quantity_ordered||0)*Number(x.unit_price||0)),0); const status=documentStatus(r.receipt_status||r.issue_status||r.check_status); return <tr key={r.id}><td className="stt-column">{offset+i+1}</td><td className="date-cell">{formatDateVN(r.order_date||r.to_date)}</td><td className="font-semibold text-blue-700">{r.code}</td><td>{r.warehouse_name}</td><td>{r.partner_name||r.user_name}</td><td className={`text-center font-semibold ${status.tone}`}>{status.label}</td><td className="text-center">{lines.length}</td>{type!=='KK'&&<td className="text-center">{money.format(value)}</td>}</tr>})}</tbody></table></WholeRowViewport> }

function ReportEmptyRow({ columns }: { columns: number }) {
  return <tr><td colSpan={columns} className="paged-table-message !py-10 text-center text-slate-500" role="status">Không có dữ liệu phù hợp với bộ lọc.</td></tr>;
}

function CostingKpis({ summary }: { summary: Record<string, number> }) {
  return <div className="report-kpi-grid report-kpi-grid-three"><ReportKpi label="Doanh thu" value={money.format(summary.period_revenue || 0)}/><ReportKpi label="Giá vốn" value={money.format(summary.recorded_cogs || 0)}/><ReportKpi label="Lợi nhuận gộp" value={money.format(summary.gross_profit || 0)}/></div>;
}

function CostingTable({ rows, summary, offset }: { rows: CostingRow[]; summary: Record<string, number>; offset: number }) {
  const total = costingTotals(summary);
  const width = costingColumns.reduce((sum, column) => sum + column.width, 0);
  return <WholeRowViewport key={rows.map(row => row.id).join(',')} className="report-table-wrap" label="Danh sách giá vốn và lợi nhuận">
    <table className="report-table min-w-[960px] table-fixed w-full"><colgroup>{costingColumns.map(column => <col key={column.label} style={{width:`${column.width/width*100}%`}}/>)}</colgroup><thead><tr>{costingColumns.map((column, index) => <th key={column.label} className={index === 0 ? 'stt-column' : index >= 3 ? 'text-center' : ''} title={index === 5 ? 'Giá vốn đã duyệt trong kỳ chia số lượng xuất trong kỳ.' : undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{!rows.length && <ReportEmptyRow columns={costingColumns.length}/>} {rows.map((row, index) => <tr key={row.id}>{costingCells(row, offset + index).map((value, column) => <td key={column} className={column === 0 ? 'stt-column' : column === 1 ? 'break-words font-semibold text-blue-700' : column === 2 ? 'break-words font-medium text-slate-800' : 'whitespace-nowrap text-center tabular-nums'}>{formatReportCell(value)}</td>)}</tr>)}</tbody>
      <tfoot><tr><th colSpan={4}>TỔNG CỘNG</th>{total.slice(4).map((value, index) => <th key={index} className="text-center tabular-nums">{formatReportCell(value)}</th>)}</tr></tfoot>
    </table>
  </WholeRowViewport>;
}

function StockTable({ rows, summary, offset }: { rows: InventoryRow[]; summary: Record<string, number>; offset: number }) {
  return <WholeRowViewport key={rows.map(row => row.id).join(',')} className="report-table-wrap" label="Danh sách báo cáo tồn kho">
    <table className="report-table min-w-[760px] w-full">
      <thead><tr><th className="stt-column">STT</th><th>Mã sản phẩm</th><th>Tên sản phẩm</th><th>Đơn vị tính</th><th className="text-center">Số lượng tồn</th><th className="text-center">Giá trị tồn (VNĐ)</th></tr></thead>
      <tbody>{!rows.length && <ReportEmptyRow columns={6} />}{rows.map((row, index) => <tr key={row.id}>
        <td className="stt-column">{offset + index + 1}</td><td className="font-semibold text-blue-700">{row.code}</td>
        <td className="min-w-56 break-words font-medium text-slate-800">{row.name}</td><td>{row.unit}</td>
        <td className="text-center">{number.format(Number(row.ending_quantity) || 0)}</td><td className="text-center">{amount.format(Number(row.ending_value) || 0)}</td>
      </tr>)}</tbody>
      <tfoot><tr><th colSpan={4}>TỔNG CỘNG</th><th className="text-center">{number.format(summary.ending_quantity || 0)}</th><th className="text-center">{amount.format(summary.ending_value || 0)}</th></tr></tfoot>
    </table>
  </WholeRowViewport>;
}
