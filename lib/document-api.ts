export type DocumentKind = 'receipt' | 'issue';
export const documentPath = (kind: DocumentKind) => `/api/goods-${kind === 'receipt' ? 'receipts' : 'issues'}`;
export const todayISO = () => new Date().toLocaleDateString('sv-SE');
export const fmt = (value: number | null | undefined) => value == null ? '—' : Number(value).toLocaleString('vi-VN');
export async function documentApi<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Không thể xử lý (${response.status})`);
  return data;
}
export type DocumentLine = {
  id: number; item_id: number; item_code: string; item_name: string; unit: string; bin_id: number; bin_code?: string; bin_description: string;
  quantity_ordered: number; unit_price: number; fulfilled_quantity: number; fulfilled_bonus: number; has_movements?: boolean;
  pending_quantity: number; remaining_quantity: number; recordable_quantity: number; reserved_quantity?: number;
};
export type Operation = {
  id: number; code: string; sequence_no: number; operation_kind?: string; operation_status: string;
  operation_date?: string; payment_date?: string; quantity?: number; item_count?: number; amount: number; purpose?: string; method?: string; note?: string; refund_of_id?: number;
  description?: string; reason?: string; confirmed_at?: string; confirmed_name?: string; user_name?: string;
  root_code?: string;
  security_action?: 'KEEP' | 'APPLY' | null; refund_of_purpose?: string; refund_of_security_action?: 'KEEP' | 'APPLY' | null; refund_of_code?: string;
};
export type MovementLine = {
  id: number; goods_receipt_detail_id?: number; goods_issue_detail_id?: number; item_id: number;
  item_code: string; item_name: string; unit: string; bin_id: number; bin_code?: string; bin_description: string;
  quantity: number; paid_quantity: number; bonus_quantity: number; unit_price: number; commercial_unit_price?: number; inventory_value: number;
};
export type MovementDetail = Operation & { items: MovementLine[]; root: ManagedDocument };
export type ManagedDocument = {
  id: number; code: string; order_date: string; warehouse_id: number; partner_id: number; warehouse_name: string; partner_name: string;
  user_name: string; description: string; lifecycle_status: string; revision_no: number;
  planned_amount: number; fulfilled_amount: number; settled_amount: number; outstanding_amount: number;
  advance_balance: number; security_balance: number; fulfilled_quantity: number; remaining_quantity: number; reserved_quantity: number;
  completion_reason: string | null; can_delete: boolean; completed_at?: string;
  items: DocumentLine[]; movements: Operation[]; payments: Operation[];
};
export const stateLabel: Record<string, string> = { Draft: 'Mới lập', Active: 'Đang thực hiện', Completed: 'Hoàn thành', Pending: 'Chờ xác nhận', Confirmed: 'Đã xác nhận', Rejected: 'Đã từ chối', Cancelled: 'Đã hủy' };
export const purposeLabel: Record<string, string> = { PAYMENT: 'Thanh toán tiền hàng', ADVANCE: 'Ứng trước tiền hàng', SECURITY: 'Đặt cọc bảo đảm', REFUND: 'Hoàn tiền', SECURITY_REFUND: 'Hoàn trả cọc' };
export const isSecurityRefund = (payment: Operation) => payment.purpose === 'REFUND' && payment.refund_of_purpose === 'SECURITY' && payment.refund_of_security_action !== 'APPLY';
export const paymentPurposeLabel = (payment: Operation) => isSecurityRefund(payment) ? purposeLabel.SECURITY_REFUND
  : payment.purpose === 'SECURITY' && payment.security_action === 'APPLY' ? 'Cọc chuyển sang tiền hàng' : purposeLabel[payment.purpose || ''] || payment.purpose || '';
