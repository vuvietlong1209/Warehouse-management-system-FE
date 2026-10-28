'use client';
import { useState } from 'react';
import { BadgeCheck, Save } from 'lucide-react';
import { DocumentModal } from '@/components/document-modal';
import { Button } from '@/components/ui';
import { DocumentProductLines } from '@/components/document-product-lines';
import { ShortDateField } from '@/components/short-date-field';
import { FilterSelect } from '@/components/filter-select';
import { useSecurityConfirmation } from '@/components/security-payment-confirm';
import { fmt, purposeLabel, type DocumentKind } from '@/lib/document-api';

export type InitialDocument = {
  code: string; order_date: string; warehouse_id: number; partner_id: number; description: string; request_key: string;
  items: { item_id: number; bin_id: number; quantity_ordered: number; unit_price: number }[];
};
export function DocumentInitialDialog({ kind, value, names, busy, onClose, onSave }: {
  kind: DocumentKind; value: InitialDocument; names: { warehouse: string; partner: string; items: { code: string; name: string; bin: string; unit: string }[] };
  busy: boolean; onClose: () => void; onSave: (body: InitialDocument & Record<string, unknown>, approve: boolean) => Promise<void>;
}) {
  const receipt = kind === 'receipt', label = receipt ? 'nhập' : 'xuất';
  const total = value.items.reduce((sum, line) => sum + line.quantity_ordered * line.unit_price, 0);
  const [date, setDate] = useState(value.order_date), [paymentDate, setPaymentDate] = useState(value.order_date);
  const [lines, setLines] = useState(value.items.map(line => ({ ...line, first_quantity: line.quantity_ordered, first_bonus: 0 })));
  const [amount, setAmount] = useState(total), [method, setMethod] = useState('Chuyển khoản'), [purpose, setPurpose] = useState('PAYMENT');
  const [note, setNote] = useState(''), [error, setError] = useState('');
  const { confirmSecurity, securityConfirmation, securityOpen } = useSecurityConfirmation();
  return <><DocumentModal title={`Lưu và thanh toán · ${value.code}`} busy={busy} inactive={securityOpen} onClose={onClose} wide className="document-initial-dialog">
    <form className="document-initial-form" onSubmit={async e => {
      e.preventDefault(); setError('');
      if (!lines.some(line => line.first_quantity + line.first_bonus > 0) && amount <= 0) { setError('Nhập lượng thực hiện hoặc số tiền thanh toán. Nếu chưa phát sinh, chọn Lưu đơn ở màn hình lập đơn.'); return; }
      const approve = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'approve';
      const securityAction = approve && amount > 0 && purpose === 'SECURITY' ? await confirmSecurity(amount) : undefined;
      if (securityAction === null) return;
      try { await onSave({ ...value, first_date: date, items: lines, initial_payment: { amount, payment_date: paymentDate, method, note, purpose, ...(securityAction ? { security_action: securityAction } : {}) } }, approve); }
      catch (e) { setError((e as Error).message); }
    }}>
      <fieldset disabled={busy} className="document-initial-fields">
        <section aria-label="Thông tin chung" className="initial-general">
          <div><span className="initial-label">Kho {label} hàng</span><p className="initial-common-value">{names.warehouse}</p></div>
          <div><span className="initial-label">{receipt ? 'Nhà cung cấp' : 'Khách hàng / Đại lý'}</span><p className="initial-common-value">{names.partner}</p></div>
          <label className="form-label !mb-0">Ngày {label} lần đầu<ShortDateField required label="Ngày giao nhận lần đầu" value={date} onChange={setDate} /></label>
        </section>
        <section aria-label="Sản phẩm lần đầu" className="initial-products-section">
          <div className="initial-section-heading"><h4>Sản phẩm {label} kho</h4><span>{lines.length} sản phẩm</span></div>
          <DocumentProductLines initialDelivery label={label} viewportLabel="Danh sách sản phẩm lần đầu" inputLabel={index => `Lượng lần đầu dòng ${index + 1}`}
            lines={lines.map((line, index) => ({ key: `${line.item_id}:${line.bin_id}:${index}`, code: names.items[index].code, name: names.items[index].name, bin: names.items[index].bin, unit: names.items[index].unit, binId: line.bin_id, quantity: line.first_quantity, neededQuantity: line.quantity_ordered, unitPrice: line.unit_price }))}
            onQuantityChange={(index, quantity) => setLines(current => current.map((row, i) => i === index ? { ...row, first_quantity: quantity } : row))} />
        </section>
        <section aria-label="Thanh toán lần đầu" className="initial-payment-section">
          <div className="initial-section-heading"><h4>Thanh toán lần đầu</h4></div>
          <div className="initial-payment-grid">
            <label className="form-label !mb-0">Ngày thanh toán<ShortDateField required={amount > 0} label="Ngày thanh toán lần đầu" value={paymentDate} onChange={setPaymentDate} /></label>
            <label className="form-label !mb-0">Loại thanh toán<FilterSelect label="Loại tiền lần đầu" value={purpose} onChange={setPurpose} className="form-control">{['PAYMENT', 'ADVANCE', 'SECURITY'].map(value => <option key={value} value={value}>{purposeLabel[value]}</option>)}</FilterSelect></label>
            <label className="form-label !mb-0">Phương thức<FilterSelect label="Phương thức thanh toán lần đầu" value={method} onChange={setMethod} className="form-control">{['Tiền mặt', 'Chuyển khoản'].map(value => <option key={value} value={value}>{value}</option>)}</FilterSelect></label>
            <label className="form-label !mb-0">Số tiền (₫)<input aria-label="Số tiền thanh toán lần đầu" required type="number" min="0" max={purpose === 'SECURITY' ? undefined : total} step="0.01" value={amount} className="form-control text-right font-semibold tabular-nums" onChange={e => setAmount(Number(e.target.value))} /><span className="initial-field-hint">Còn phải thanh toán: <strong>{fmt(total)} ₫</strong></span></label>
            <label className="form-label !mb-0">Ghi chú<input className="form-control" maxLength={192} value={note} onChange={e => setNote(e.target.value)} /></label>
          </div>
        </section>
      </fieldset>
      {error && <p role="alert" className="initial-form-error">{error}</p>}
      <footer className="initial-form-footer"><p className="initial-footer-total">Giá trị đơn: <strong>{fmt(total)} ₫</strong></p><div className="initial-footer-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" value="save" disabled={busy}><Save className="size-4" />Lưu</Button><Button type="submit" value="approve" variant="success" disabled={busy}><BadgeCheck className="size-4" />{receipt?'Lưu và duyệt':'Giữ chỗ và duyệt'}</Button></div></footer>
    </form>
  </DocumentModal>{securityConfirmation}</>;
}
