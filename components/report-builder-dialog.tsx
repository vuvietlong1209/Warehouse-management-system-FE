'use client';

import { FilterSelect } from '@/components/filter-select';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Eye, FilePlus2, Loader2, Printer, X } from 'lucide-react';
import { Button, RequiredMark } from '@/components/ui';
import { ShortDateField } from '@/components/short-date-field';
import type { Warehouse } from '@/types/warehouse';
import { collectReportSnapshot, formatReportCell, normalizeReportCriteria, reportPeriodLabel, ReportCriteria, ReportFormat,
  reportFileName, ReportSnapshot, reportTemplates, reportTotalLabelSpan, ReportType } from '@/lib/report-builder';
import { createReportFile, printReportSnapshot } from '@/lib/report-export';

type GeneratedReport = { criteria: ReportCriteria; snapshot: ReportSnapshot; url: string; fileName: string };
const formatNames: Record<ReportFormat, string> = { EXCEL: 'Excel (.xlsx)', WORD: 'Word (.docx)', PDF: 'PDF (.pdf)' };

export function ReportBuilderDialog({ initialCriteria, warehouses, onClose }: {
  initialCriteria: ReportCriteria; warehouses: Warehouse[]; onClose: () => void;
}) {
  const [criteria, setCriteria] = useState<ReportCriteria>({ ...initialCriteria });
  const [generated, setGenerated] = useState<GeneratedReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const dirty = Boolean(generated && JSON.stringify(criteria) !== JSON.stringify(generated.criteria));
  const change = <K extends keyof ReportCriteria>(key: K, value: ReportCriteria[K]) => setCriteria(previous => ({ ...previous, [key]: value }));

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { request.current?.abort(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  useEffect(() => () => { if (generated) URL.revokeObjectURL(generated.url); }, [generated]);
  useEffect(() => { panel.current?.focus(); }, [preview]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (preview) setPreview(false); else onClose(); }
      if (event.key !== 'Tab') return;
      const focusable = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([aria-hidden]),a[href]') || [])]
        .filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, preview]);

  const generate = async () => {
    if (generating) return;
    const controller = new AbortController();
    request.current = controller;
    const chosen = normalizeReportCriteria(criteria);
    setGenerating(true); setError(null);
    try {
      const snapshot = await collectReportSnapshot(chosen, warehouses, controller.signal);
      const blob = await createReportFile(snapshot, chosen.format, controller.signal);
      if (!controller.signal.aborted) {
        setGenerated({ criteria: chosen, snapshot, url: URL.createObjectURL(blob), fileName: reportFileName(snapshot, chosen.format) });
        setCriteria(chosen);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tạo được báo cáo');
    } finally { if (!controller.signal.aborted) setGenerating(false); }
  };
  const print = async () => {
    if (!generated || printing) return;
    setPrinting(true); setError(null);
    try { await printReportSnapshot(generated.snapshot); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không mở được bản in'); }
    finally { setPrinting(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="report-builder-title" tabIndex={-1}
      className={`ui-dialog flex max-h-[92vh] w-full flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl outline-none ${preview ? 'max-w-[1280px]' : 'max-w-[720px]'}`}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <h2 id="report-builder-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><FilePlus2 className="size-5 text-blue-600" />{preview ? 'Xem báo cáo' : 'Tạo báo cáo'}</h2>
        <button type="button" aria-label="Đóng popup báo cáo" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
      </header>
      <div className="min-h-0 overflow-auto px-5 py-4">
        {preview && generated ? <ReportPreview snapshot={generated.snapshot} /> : <form id="report-builder-form" noValidate onSubmit={event => { event.preventDefault(); void generate(); }}>
          <fieldset disabled={generating} className="space-y-4">
            <div><label htmlFor="builder-template" className="form-label">Mẫu báo cáo<RequiredMark /></label><FilterSelect label="Mẫu báo cáo" id="builder-template" className="form-control" value={criteria.reportType} onChange={event => change('reportType', event as ReportType)}>{reportTemplates.map(template => <option key={template.value} value={template.value}>{template.label}</option>)}</FilterSelect></div>
            <div className={`grid gap-3 ${criteria.format !== 'EXCEL' ? 'sm:grid-cols-2' : ''}`}>
              <div><label htmlFor="builder-format" className="form-label">Định dạng<RequiredMark /></label><FilterSelect label="Định dạng báo cáo" id="builder-format" className="form-control" value={criteria.format} onChange={event => change('format', event as ReportFormat)}>{Object.entries(formatNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</FilterSelect></div>
              {criteria.format !== 'EXCEL' && <div><label htmlFor="builder-paper" className="form-label">Khổ giấy khi in</label><FilterSelect label="Khổ giấy khi in" id="builder-paper" className="form-control" value={criteria.paperSize} onChange={event => change('paperSize', event as 'A4' | 'A5')}><option value="A4">A4</option><option value="A5">A5</option></FilterSelect></div>}
            </div>
            <div className="border-t border-slate-100 pt-3">
              <h3 className="mb-3 text-[13px] font-semibold text-slate-900">Bộ lọc dữ liệu</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {criteria.reportType !== 'STOCK' && <div><span className="form-label">Từ ngày<RequiredMark /></span><ShortDateField label="Từ ngày tạo báo cáo" value={criteria.fromDate} onChange={value => change('fromDate', value)} /></div>}
                <div className={criteria.reportType === 'STOCK' ? 'sm:col-span-2' : ''}><span className="form-label">{criteria.reportType === 'STOCK' ? 'Tồn kho đến ngày' : 'Đến ngày'}<RequiredMark /></span><ShortDateField label={criteria.reportType === 'STOCK' ? 'Tồn kho đến ngày' : 'Đến ngày tạo báo cáo'} value={criteria.toDate} min={criteria.reportType === 'STOCK' ? undefined : criteria.fromDate} onChange={value => change('toDate', value)} /></div>
                <div><label htmlFor="builder-warehouse" className="form-label">Kho hàng</label><FilterSelect label="Kho hàng báo cáo" id="builder-warehouse" className="form-control" value={criteria.warehouseId} onChange={event => change('warehouseId', event)}><option value="">Tất cả kho hàng</option>{warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</FilterSelect></div>
                <div><label htmlFor="builder-search" className="form-label">Từ khóa tìm kiếm</label><input id="builder-search" className="form-control" placeholder={criteria.reportType === 'KK' ? 'Mã chứng từ...' : criteria.reportType === 'PO' || criteria.reportType === 'SO' ? 'Mã chứng từ, đối tác...' : 'Mã hoặc tên sản phẩm...'} value={criteria.search} maxLength={128} onChange={event => change('search', event.target.value)} /></div>
              </div>
            </div>
          </fieldset>
          {generated && <section aria-label="Báo cáo đã tạo" className="mt-4 border-t border-slate-200 pt-3">
            <p role="status" className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700"><CheckCircle2 className="size-4" />Đã tạo báo cáo · {generated.snapshot.rows.length} bản ghi</p>
            <p className="break-all text-xs text-slate-600">{generated.fileName}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => setPreview(true)}><Eye className="size-4" />Xem báo cáo</Button><Button type="button" variant="secondary" disabled={printing} onClick={() => void print()}><Printer className="size-4" />{printing ? 'Đang mở...' : 'In báo cáo'}</Button><DownloadReport report={generated} /></div>
            {dirty && <p className="mt-2 text-xs text-amber-700">Tiêu chí đã thay đổi. Nhấn Tạo báo cáo để cập nhật kết quả.</p>}
          </section>}
        </form>}
        {error && <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        {preview ? <Button variant="secondary" onClick={() => setPreview(false)}><ArrowLeft className="size-4" />Quay lại</Button> : <Button variant="secondary" onClick={onClose}>Đóng</Button>}
        {preview && generated ? <div className="flex gap-2"><DownloadReport report={generated} /><Button disabled={printing} onClick={() => void print()}><Printer className="size-4" />In báo cáo</Button></div>
          : <Button type="submit" form="report-builder-form" disabled={generating}>{generating ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}{generating ? 'Đang tạo...' : 'Tạo báo cáo'}</Button>}
      </footer>
    </div>
  </div>;
}

function DownloadReport({ report }: { report: GeneratedReport }) {
  return <a href={report.url} download={report.fileName} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700"><Download className="size-4" />Tải {report.criteria.format === 'EXCEL' ? 'Excel' : report.criteria.format === 'WORD' ? 'Word' : 'PDF'}</a>;
}

export function ReportPreview({ snapshot }: { snapshot: ReportSnapshot }) {
  const totalWidth = snapshot.columns.reduce((sum, column) => sum + column.width, 0);
  return <article aria-label="Nội dung báo cáo đã tạo" className="text-slate-900">
    <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs"><span>ĐƠN VỊ: QUẢN LÝ KHO & THEO DÕI TỒN KHO</span><span>Mẫu số: {snapshot.formCode}</span></div>
    <h3 className="text-center text-base font-bold">{snapshot.title}</h3>
    <p className="date-value mb-3 mt-1 text-center text-xs">{reportPeriodLabel(snapshot)}</p>
    <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs"><p>Kho: {snapshot.warehouseName}{snapshot.search && <> · Từ khóa: {snapshot.search}</>}</p><p className="date-value">Ngày lập: {new Date(snapshot.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })}</p></div>
    <div className="overflow-x-auto"><table className={`report-table w-full table-fixed [&_td]:break-words ${['NXT','COGS'].includes(snapshot.reportType) ? 'min-w-[1100px]' : 'min-w-[800px]'}`}>
      <colgroup>{snapshot.columns.map((column, index) => <col key={index} style={{ width: `${column.width / totalWidth * 100}%` }} />)}</colgroup>
      <thead><tr>{snapshot.columns.map((column, index) => <th key={index} className={index === 0 ? 'stt-column' : ''}>{column.label}</th>)}</tr></thead>
      <tbody>{snapshot.rows.length ? snapshot.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column} className={snapshot.columns[column].label === 'Ngày' ? 'date-cell' : undefined} style={{ textAlign: column === 0 ? 'center' : snapshot.columns[column].align }}>{formatReportCell(value, snapshot.fromDate)}</td>)}</tr>) : <tr><td colSpan={snapshot.columns.length} className="py-8 text-center text-slate-500">Không có dữ liệu phù hợp</td></tr>}</tbody>
      <tfoot>{snapshot.totals.map((row, index) => { const span = reportTotalLabelSpan(row); return <tr key={index}>{row.map((value, column) => column > 0 && column < span ? null : <th key={column} colSpan={column === 0 ? span : 1} style={{ textAlign: column === 0 ? 'left' : snapshot.columns[column].align }}>{formatReportCell(value, snapshot.fromDate)}</th>)}</tr>; })}</tfoot>
    </table></div>
  </article>;
}
