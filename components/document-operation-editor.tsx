'use client';
import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui';
import { SearchableSelect } from '@/components/searchable-select';
import { ShortDateField } from '@/components/short-date-field';
import { FilterSelect } from '@/components/filter-select';
import { DocumentProductLines } from '@/components/document-product-lines';
import { useWarehouse } from '@/context/WarehouseContext';
import { feasibleAtBin } from '@/lib/document-stock-limits';
import { fmt, todayISO, purposeLabel, isSecurityRefund, paymentPurposeLabel, type DocumentKind, type ManagedDocument, type MovementDetail, type Operation } from '@/lib/document-api';

export type OperationTab = 'movement' | 'payment';
export function DocumentOperationEditor({ kind, doc, tab, busy, onCancel, onSave, movement, payment }: {
  kind: DocumentKind; doc: ManagedDocument; tab: OperationTab; busy: boolean; onCancel: () => void; onSave: (body: unknown) => Promise<void>;
  movement?: MovementDetail; payment?: Operation;
}) {
  const source = useWarehouse(), receipt = kind === 'receipt';
  const [date, setDate] = useState(() => (movement?.operation_date || payment?.payment_date || todayISO()).slice(0, 10)), [note, setNote] = useState(movement?.description || payment?.note || ''), [purpose, setPurpose] = useState(payment && isSecurityRefund(payment) ? 'SECURITY_REFUND' : payment?.purpose || 'PAYMENT');
  const [amount, setAmount] = useState(payment?.amount ?? doc.outstanding_amount), [method, setMethod] = useState(payment?.method || 'Chuyển khoản'), [refund, setRefund] = useState(payment?.refund_of_id ? String(payment.refund_of_id) : '');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState(() => doc.items.flatMap(d => {
    const own = movement?.items.filter(x => (receipt ? x.goods_receipt_detail_id : x.goods_issue_detail_id) === d.id) || [];
    return own.length ? own.map(x => ({ detail_id: d.id, quantity: Number(receipt ? x.paid_quantity : x.quantity), bonus_quantity: Number(x.bonus_quantity || 0), bin_id: d.bin_id }))
      : [{ detail_id: d.id, quantity: 0, bonus_quantity: 0, bin_id: d.bin_id }];
  }));
  const requestKey = useRef(crypto.randomUUID());
  const change = (index: number, field: string, value: number) => setLines(current => current.map((line, i) => i === index ? { ...line, [field]: value } : line));
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    if (tab === 'movement' && !lines.some(line => line.quantity + line.bonus_quantity > 0)) { setError('Nhập lượng thực hiện lớn hơn 0.'); return; }
    try { await onSave(tab === 'payment' ? { payment_date: date, purpose: purpose === 'SECURITY_REFUND' ? 'REFUND' : purpose, amount, method, note, refund_of_id: Number(refund) || null, request_key: requestKey.current }
      : { operation_date: date, description: note, items: lines.filter(line => line.quantity + line.bonus_quantity > 0), request_key: requestKey.current }); }
    catch (e) { setError((e as Error).message); }
  };
  if (tab === 'movement') return <form className="document-initial-form" onSubmit={submit}>
    <fieldset disabled={busy} className="document-initial-fields">
      <section aria-label="Thông tin lần thực hiện" className="execution-general movement-execution-general">
        <label className="form-label !mb-0">Tìm sản phẩm<div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="search" aria-label={`Tìm sản phẩm của lần ${receipt ? 'nhập' : 'xuất'}`} className="form-control pl-9" placeholder="Mã hoặc tên sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} /></div></label>
        <label className="form-label !mb-0">Ngày thực hiện<ShortDateField required label="Ngày lần thực hiện" value={date} onChange={setDate} /></label>
        <label className="form-label movement-execution-note !mb-0">Ghi chú / Lý do<textarea aria-label={`Ghi chú lần ${receipt ? 'nhập' : 'xuất'}`} className="form-control resize-none" rows={2} value={note} maxLength={192} onChange={e => setNote(e.target.value)} /></label>
      </section>
      <section aria-label="Sản phẩm lần thực hiện" className="initial-products-section">
        <div className="initial-section-heading"><h4>Sản phẩm {receipt ? 'nhập' : 'xuất'} kho</h4><span>{lines.length} sản phẩm</span></div>
        <DocumentProductLines receiptOperation={receipt} issueOperation={!receipt} limitToFeasible={receipt||doc.lifecycle_status!=='Draft'} search={search} label={receipt ? 'nhập' : 'xuất'} viewportLabel="Danh sách sản phẩm lần thực hiện" inputLabel={index => `Lượng lần này ${doc.items.find(d => d.id === lines[index].detail_id)!.item_code}`}
          lines={lines.map((line, index) => {
            const d=doc.items.find(d=>d.id===line.detail_id)!, own=movement?.items.filter(x=>(receipt?x.goods_receipt_detail_id:x.goods_issue_detail_id)===d.id).reduce((sum,x)=>sum+Number(receipt?x.paid_quantity:x.quantity),0)||0;
            const otherLines=lines.filter((x,i)=>i!==index&&x.bin_id===line.bin_id&&(receipt||doc.items.find(d=>d.id===x.detail_id)?.item_id===d.item_id)).reduce((sum,x)=>sum+x.quantity+x.bonus_quantity,0);
            const pending=doc.items.filter(x=>x.bin_id===line.bin_id&&(receipt||x.item_id===d.item_id)).reduce((sum,x)=>sum+Number(x.pending_quantity),0)-(movement?.items.filter(x=>{const root=doc.items.find(d=>d.id===(receipt?x.goods_receipt_detail_id:x.goods_issue_detail_id));return root?.bin_id===line.bin_id&&(receipt||root.item_id===d.item_id);}).reduce((sum,x)=>sum+Number(x.quantity),0)||0);
            const feasible=Math.max(0,feasibleAtBin(receipt,doc,d.item_id,line.bin_id,source)-otherLines-Math.max(0,pending));
            return {key:`${d.id}:${index}`,code:d.item_code,name:d.item_name,unit:d.unit,bin:`${d.bin_code?`${d.bin_code} · `:''}${d.bin_description}`,binId:line.bin_id,quantity:line.quantity,neededQuantity:Number(d.recordable_quantity)+own,unitPrice:Number(d.unit_price),feasibleQuantity:Number.isFinite(feasible)?feasible:undefined};
          })}
          onQuantityChange={(index, quantity) => change(index, 'quantity', quantity)} />
      </section>
    </fieldset>
    {error && <p role="alert" className="initial-form-error">{error}</p>}
    <footer className="initial-form-footer"><Button variant="secondary" disabled={busy} onClick={onCancel}>Hủy</Button><Button type="submit" disabled={busy}>{movement ? 'Lưu thay đổi' : 'Lưu chờ xác nhận'}</Button></footer>
  </form>;
  return <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
    <div className="min-h-0 flex-1 overflow-auto px-5 py-3"><fieldset disabled={busy} className="space-y-2">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-slate-700">Giá trị đơn<strong className="whitespace-nowrap tabular-nums text-slate-900">{fmt(doc.planned_amount)} ₫</strong></div><div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-slate-700">Còn phải thanh toán<strong className="whitespace-nowrap tabular-nums text-blue-700">{fmt(doc.outstanding_amount)} ₫</strong></div></div>
      <div className="document-payment-fields">
        <label className="form-label !mb-0">Ngày thanh toán<ShortDateField required label="Ngày lần thực hiện" value={date} onChange={setDate} /></label>
        <label className="form-label !mb-0">Loại thanh toán<FilterSelect label="Loại khoản tiền" value={purpose} onChange={value => { setPurpose(value); setRefund(''); }} className="form-control">{Object.entries(purposeLabel).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</FilterSelect></label>
        <label className="form-label !mb-0">Phương thức<FilterSelect label="Phương thức thanh toán" value={method} onChange={setMethod} className="form-control">{(!['Tiền mặt', 'Chuyển khoản'].includes(method) ? [method, 'Tiền mặt', 'Chuyển khoản'] : ['Tiền mặt', 'Chuyển khoản']).map(value => <option key={value} value={value}>{value}</option>)}</FilterSelect></label>
        <label className="form-label !mb-0">Số tiền (₫)<input aria-label="Số tiền thanh toán" className="form-control text-right font-semibold tabular-nums" type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} /><span className="mt-1 block text-right text-xs font-normal text-slate-700">Còn phải thanh toán: <strong>{fmt(doc.outstanding_amount)} ₫</strong></span></label>
      </div>
      {['REFUND','SECURITY_REFUND'].includes(purpose) && <label className="form-label">Khoản tiền gốc<SearchableSelect id="refund-origin" label="Khoản tiền gốc" required value={refund} onChange={setRefund} options={doc.payments.filter(p => p.operation_status === 'Confirmed' && p.purpose !== 'REFUND' && (purpose === 'SECURITY_REFUND') === (p.purpose === 'SECURITY' && p.security_action !== 'APPLY')).map(p => ({ value: p.id, label: `${p.code} · ${paymentPurposeLabel(p)} · ${fmt(p.amount)} ₫` }))} /></label>}
      <label className="form-label !mb-0">Ghi chú<input className="form-control" value={note} maxLength={192} onChange={e => setNote(e.target.value)} /></label>
    </fieldset>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}</div>
    <footer className="flex shrink-0 justify-end gap-2 border-t bg-slate-50 px-5 py-3"><Button variant="secondary" disabled={busy} onClick={onCancel}>Hủy</Button><Button type="submit" disabled={busy}>{payment ? 'Lưu thay đổi' : 'Lưu chờ xác nhận'}</Button></footer>
  </form>;
}
