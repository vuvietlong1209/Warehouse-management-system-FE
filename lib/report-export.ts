import { formatReportCell, ReportFormat, ReportSnapshot, reportPeriodLabel, reportTotalLabelSpan } from './report-builder';

export async function createReportFile(snapshot: ReportSnapshot, format: ReportFormat, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch('/api/reports/render', { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, snapshot }) });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.message || body.error || 'Không tạo được file báo cáo');
  }
  return response.blob();
}

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export function reportPrintHtml(snapshot: ReportSnapshot) {
  const landscape = ['NXT', 'COGS'].includes(snapshot.reportType);
  const totalWidth = snapshot.columns.reduce((sum, column) => sum + column.width, 0);
  const cells = (row: (string | number)[], total = false) => {
    const span = total ? reportTotalLabelSpan(row) : 1;
    return row.map((value, index) => index > 0 && index < span ? '' : `<td${typeof value === 'number' ? ' class="number"' : ''}${index === 0 && span > 1 ? ` colspan="${span}"` : ''} style="text-align:${total && index === 0 ? 'left' : index === 0 ? 'center' : snapshot.columns[index].align}">${escape(String(formatReportCell(value, snapshot.fromDate)))}</td>`).join('');
  };
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${escape(snapshot.title)}</title><style>
    @page { size: ${snapshot.paperSize} ${landscape ? 'landscape' : 'portrait'}; margin: ${snapshot.paperSize === 'A5' ? '7mm' : '10mm'}; }
    * { box-sizing: border-box; } body { font-family:'Times New Roman',Times,serif; color:#111827; margin:0; font-size:9pt; }
    h1 { font-size:14pt; text-align:center; margin:10px 0 6px; } p { margin:4px 0; }
    .meta { display:flex; justify-content:space-between; gap:16px; margin-bottom:12px; } .period { text-align:center; margin-bottom:10px; }
    table { width:100%; table-layout:fixed; border-collapse:collapse; font-size:${landscape ? snapshot.paperSize === 'A5' ? '6.5' : '8' : '8.5'}pt; }
    th,td { border:1px solid #d9d9d9; padding:5px 4px; overflow-wrap:anywhere; vertical-align:middle; }
    td.number { white-space:nowrap; ${landscape && snapshot.paperSize === 'A5' ? 'font-size:6pt;' : ''} }
    thead { display:table-header-group; } th { background:#f1f5f9; text-align:center; font-weight:600; } tr { break-inside:avoid; }
    tfoot { display:table-row-group; font-weight:600; } .empty { text-align:center; padding:20px; }
    .signatures { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:6mm; padding-bottom:22mm; text-align:center; font-size:${snapshot.paperSize === 'A5' ? '8' : '9'}pt; break-inside:avoid; page-break-inside:avoid; }
    .signatures p { font-style:italic; margin-top:4px; }
  </style></head><body><div class="meta"><span>ĐƠN VỊ: QUẢN LÝ KHO & THEO DÕI TỒN KHO</span><span>Mẫu số: ${escape(snapshot.formCode)}</span></div>
  <h1>${escape(snapshot.title)}</h1><p class="period">${escape(reportPeriodLabel(snapshot))}</p>
  <div class="meta"><span>Kho: ${escape(snapshot.warehouseName)}${snapshot.search ? `<br>Từ khóa: ${escape(snapshot.search)}` : ''}</span><span>Ngày lập: ${new Date(snapshot.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })}</span></div>
  <table><colgroup>${snapshot.columns.map(column => `<col style="width:${column.width / totalWidth * 100}%">`).join('')}</colgroup><thead><tr>${snapshot.columns.map(column => `<th>${escape(column.label)}</th>`).join('')}</tr></thead>
  <tbody>${snapshot.rows.length ? snapshot.rows.map(row => `<tr>${cells(row)}</tr>`).join('') : `<tr><td class="empty" colspan="${snapshot.columns.length}">Không có dữ liệu phù hợp</td></tr>`}</tbody>
  <tfoot>${snapshot.totals.map(row => `<tr>${cells(row, true)}</tr>`).join('')}</tfoot></table>
  <div class="signatures"><div><b>NGƯỜI LẬP BIỂU</b><p>(Ký, ghi rõ họ tên)</p></div><div><b>THỦ KHO</b><p>(Ký, ghi rõ họ tên)</p></div><div><b>KẾ TOÁN TRƯỞNG</b><p>(Ký, ghi rõ họ tên)</p></div><div><b>GIÁM ĐỐC</b><p>(Ký, đóng dấu)</p></div></div></body></html>`;
}

export async function printReportSnapshot(snapshot: ReportSnapshot) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:0;bottom:0;';
  try {
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('Không mở được bản in báo cáo'));
      frame.srcdoc = reportPrintHtml(snapshot);
      document.body.appendChild(frame);
    });
    const view = frame.contentWindow;
    if (!view) throw new Error('Không mở được bản in báo cáo');
    await frame.contentDocument?.fonts.ready;
    view.addEventListener('afterprint', () => frame.remove(), { once: true });
    view.focus();
    view.print();
    window.setTimeout(() => frame.remove(), 60000);
  } catch (error) {
    frame.remove();
    throw error;
  }
}
