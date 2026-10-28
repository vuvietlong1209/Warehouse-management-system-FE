import type { Warehouse } from '@/types/warehouse';

export type ReportType = 'NXT' | 'PO' | 'SO' | 'KK' | 'STOCK' | 'COGS';
export type ReportFormat = 'EXCEL' | 'WORD' | 'PDF';
export type ReportCriteria = { reportType: ReportType; format: ReportFormat; fromDate: string;
  toDate: string; warehouseId: string; search: string; paperSize: 'A4' | 'A5' };
export type ReportCell = string | number;
export type ReportColumn = { label: string; width: number; align: 'left' | 'center' | 'right'; numeric?: boolean };
export type ReportSnapshot = { reportType: ReportType; title: string; formCode: string;
  fromDate: string; toDate: string; warehouseName: string; search: string; paperSize: 'A4' | 'A5';
  createdAt: string; columns: ReportColumn[]; rows: ReportCell[][]; totals: ReportCell[][] };
export const reportTemplates: { value: ReportType; label: string; title: string; code: string }[] = [
  { value: 'NXT', label: 'Nhập - Xuất - Tồn', title: 'BÁO CÁO TỔNG HỢP NHẬP XUẤT TỒN KHO', code: 'BC-KHO-01' },
  { value: 'PO', label: 'Bảng kê phiếu nhập kho', title: 'BẢNG KÊ PHIẾU NHẬP KHO', code: 'BC-KHO-03' },
  { value: 'SO', label: 'Bảng kê phiếu xuất kho', title: 'BẢNG KÊ PHIẾU XUẤT KHO', code: 'BC-KHO-04' },
  { value: 'KK', label: 'Bảng kê phiếu kiểm kê', title: 'BẢNG KÊ PHIẾU KIỂM KÊ', code: 'BC-KHO-05' },
  { value: 'STOCK', label: 'Tồn kho', title: 'BÁO CÁO TỒN KHO', code: 'BC-KHO-07' },
  { value: 'COGS', label: 'Giá vốn và lợi nhuận', title: 'BÁO CÁO GIÁ VỐN VÀ LỢI NHUẬN', code: 'BC-KHO-06' },
];
const column = (label: string, width: number, align: ReportColumn['align'] = 'left', numeric = false): ReportColumn => ({ label, width, align, numeric });
const numeric = (label: string, width = 14) => column(label, width, 'right', true);
export type CostingRow = { id: number; code: string; name: string; unit: string; stock_quantity: number;
  period_export_qty: number; applied_unit_cost: number; last_sale_price: number; period_revenue: number;
  recorded_cogs: number; gross_profit: number; gross_margin_percent: number };
export const costingColumns = [column('STT', 6, 'center'), column('Mã sản phẩm', 18), column('Tên sản phẩm', 30),
  column('ĐVT', 7, 'center'), numeric('SL xuất kỳ', 11), numeric('Giá vốn (1 đơn vị)', 19),
  numeric('Giá bán gần nhất', 17), numeric('Doanh thu', 19), numeric('Giá vốn kỳ', 19)];
export const costingCells = (row: CostingRow, index: number): ReportCell[] => [index + 1, row.code, row.name, row.unit || '',
  row.period_export_qty, row.applied_unit_cost, row.last_sale_price, row.period_revenue, row.recorded_cogs];
export function costingTotals(summary: Record<string, number>): ReportCell[] {
  const revenue = summary.period_revenue || 0, cost = summary.recorded_cogs || 0;
  return ['TỔNG CỘNG', '', '', '', summary.period_export_qty || 0, '', '', revenue, cost];
}
const quantityKeys = ['beginning_quantity', 'beginning_value', 'import_quantity', 'import_value',
  'export_quantity', 'export_value', 'adjustment_quantity', 'ending_quantity', 'ending_value'];
const statusLabels: Record<string, string> = { Pending: 'Chờ duyệt', Confirmed: 'Đã xác nhận',
  Rejected: 'Đã từ chối', InProgress: 'Đang thực hiện', Completed: 'Đã hoàn tất', Cancelled: 'Đã hủy' };

export function validateReportCriteria(criteria: ReportCriteria) {
  if (!reportTemplates.some(template => template.value === criteria.reportType)) throw new Error('Mẫu báo cáo không còn được hỗ trợ');
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(criteria.fromDate) || !validDate(criteria.toDate) || criteria.fromDate > criteria.toDate)
    throw new Error('Vui lòng chọn khoảng ngày hợp lệ: từ ngày không được lớn hơn đến ngày.');
  if (criteria.search.trim().length > 128) throw new Error('Từ khóa tìm kiếm không được dài quá 128 ký tự.');
}

export function normalizeReportCriteria(criteria: ReportCriteria): ReportCriteria {
  return { ...criteria, search: criteria.search.trim(),
    fromDate: criteria.reportType === 'STOCK' ? criteria.toDate : criteria.fromDate };
}

export function reportPeriodLabel(snapshot: Pick<ReportSnapshot, 'reportType' | 'fromDate' | 'toDate'>) {
  return snapshot.reportType === 'STOCK' ? `Tính đến ngày ${displayReportDate(snapshot.toDate)}`
    : `Từ ngày ${displayReportDate(snapshot.fromDate)} đến ngày ${displayReportDate(snapshot.toDate)}`;
}

export async function collectReportSnapshot(criteria: ReportCriteria, warehouses: Warehouse[], signal?: AbortSignal): Promise<ReportSnapshot> {
  criteria = normalizeReportCriteria(criteria);
  validateReportCriteria(criteria);
  const template = reportTemplates.find(template => template.value === criteria.reportType)!;
  const snapshot: ReportSnapshot = { reportType: criteria.reportType, title: template.title,
    formCode: template.code, fromDate: criteria.fromDate, toDate: criteria.toDate,
    warehouseName: criteria.warehouseId ? warehouses.find(warehouse => warehouse.id === Number(criteria.warehouseId))?.name || 'Kho đang chọn' : 'Tất cả kho hàng',
    search: criteria.search.trim(), paperSize: criteria.paperSize, createdAt: new Date().toISOString(),
    columns: [], rows: [], totals: [] };
  const read = async (url: string) => {
    const response = await fetch(url, { cache: 'no-store', signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || body.error || 'Không tải được dữ liệu báo cáo');
    return body;
  };
  if (['NXT', 'STOCK', 'COGS'].includes(criteria.reportType)) {
    const endpoint = criteria.reportType === 'COGS' ? 'costing' : 'inventory-summary';
    const params = new URLSearchParams({ from_date: criteria.fromDate, to_date: criteria.toDate, page_size: '100',
      ...(criteria.warehouseId ? { warehouse_id: criteria.warehouseId } : {}),
      ...(snapshot.search ? { search: snapshot.search } : {}) });
    const records: Record<string, any>[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      params.set('page', String(page));
      const body = await read(`/api/reports/${endpoint}?${params}`);
      records.push(...body.data);
      totalPages = body.pagination.total_pages;
      page += 1;
    } while (page <= totalPages);
    if (criteria.reportType === 'COGS') {
      snapshot.columns = costingColumns;
      snapshot.rows = records.map((row, index) => costingCells(row as CostingRow, index));
      const totals = Object.fromEntries(['period_export_qty', 'period_revenue', 'recorded_cogs']
        .map(key => [key, records.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)]));
      snapshot.totals = [costingTotals(totals)];
    } else if (criteria.reportType === 'STOCK') {
      snapshot.columns = [column('STT', 7, 'center'), column('Mã sản phẩm', 20), column('Tên sản phẩm', 36),
        column('Đơn vị tính', 10, 'center'), numeric('Số lượng tồn', 16), numeric('Giá trị tồn (VNĐ)', 24)];
      snapshot.rows = records.map((row, index) => [index + 1, row.code, row.name, row.unit || '',
        Number(row.ending_quantity) || 0, Number(row.ending_value) || 0]);
      snapshot.totals = [['TỔNG CỘNG', '', '', '',
        records.reduce((sum, row) => sum + (Number(row.ending_quantity) || 0), 0),
        records.reduce((sum, row) => sum + (Number(row.ending_value) || 0), 0)]];
    } else if (criteria.reportType === 'NXT') {
      snapshot.columns = [column('STT', 7, 'center'), column('Mã SP', 14), column('Tên sản phẩm', 28), column('ĐVT', 6, 'center'),
        numeric('Đầu kỳ SL', 9), numeric('Đầu kỳ giá trị'), numeric('Nhập SL', 9), numeric('Nhập giá trị'),
        numeric('Xuất SL', 9), numeric('Xuất giá trị'), numeric('Điều chỉnh', 10), numeric('Cuối kỳ SL', 9), numeric('Cuối kỳ giá trị')];
      snapshot.rows = records.map((row, index) => [index + 1, row.code, row.name, row.unit || '', ...quantityKeys.map(key => Number(row[key]) || 0)]);
      snapshot.totals = [['TỔNG CỘNG', '', '', '', ...quantityKeys.map(key => records.reduce((sum, row) => sum + (Number(row[key]) || 0), 0))]];
    }
  } else {
    // Read fresh documents, not the displayed page or potentially stale context arrays.
    const endpoint = criteria.reportType === 'PO' ? 'goods-receipts' : criteria.reportType === 'SO' ? 'goods-issues' : 'inventory-checks';
    const body = await read(`/api/${endpoint}`);
    if (!Array.isArray(body)) throw new Error('Không tải được đầy đủ danh sách chứng từ');
    const search = snapshot.search.toLocaleLowerCase('vi-VN');
    const records = body.filter((row: any) => {
      const day = String(criteria.reportType === 'KK' ? row.to_date : row.order_date).slice(0, 10);
      const matchesSearch = !search || String(row.code).toLocaleLowerCase('vi-VN').includes(search)
        || (criteria.reportType !== 'KK' && String(row.partner_name || '').toLocaleLowerCase('vi-VN').includes(search));
      return day >= criteria.fromDate && day <= criteria.toDate && (!criteria.warehouseId || row.warehouse_id === Number(criteria.warehouseId)) && matchesSearch;
    });
    snapshot.columns = [column('STT', 9, 'center'), column('Ngày', 22, 'center'), column('Mã chứng từ', 26),
      column('Kho', 26), column('Đối tác/Người lập', 32), column('Trạng thái', 20, 'center'), numeric('Số dòng', 11),
      ...(criteria.reportType === 'KK' ? [] : [numeric('Giá trị (VNĐ)', 25)])];
    snapshot.rows = records.map((row: any, index: number) => {
      const lines = (criteria.reportType === 'KK' ? row.details : row.items) || [];
      const status = criteria.reportType === 'PO' ? row.receipt_status : criteria.reportType === 'SO' ? row.issue_status : row.check_status;
      return [index + 1, displayReportDate(String(criteria.reportType === 'KK' ? row.to_date : row.order_date).slice(0, 10)), row.code,
        row.warehouse_name || '', row.partner_name || row.user_name || '', statusLabels[status] || status, lines.length,
        ...(criteria.reportType === 'KK' ? [] : [lines.reduce((sum: number, line: any) => sum + Number(line.inventory_value ?? Number(line.quantity_ordered || 0) * Number(line.unit_price || 0)), 0)])];
    });
  }
  return snapshot;
}

export function displayReportDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
export function formatReportCell(value: ReportCell, referenceDate = '2000-01-01') {
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  // Older saved snapshots keep their original data; only their date presentation changes.
  return value.replace(/^(\d{2}\/\d{2}\/)(\d{2})$/, (_, prefix, year) => `${prefix}${referenceDate.slice(0, 2)}${year}`);
}
export function reportTotalLabelSpan(row: ReportCell[]) {
  let span = 1;
  while (span < row.length && row[span] === '') span += 1;
  return span;
}
export function reportFileName(snapshot: ReportSnapshot, format: ReportFormat) {
  return `Bao_cao_${snapshot.reportType}_${snapshot.fromDate}_${snapshot.toDate}.${format === 'EXCEL' ? 'xlsx' : format === 'WORD' ? 'docx' : 'pdf'}`;
}
