'use client';
import { WholeRowViewport, formatDateVN } from '@/components/ui';
import { fmt, paymentPurposeLabel, stateLabel, type MovementDetail, type Operation } from '@/lib/document-api';

export function DocumentOperationDetail({ row, movement }: { row: Operation; movement?: MovementDetail }) {
  const note = movement ? movement.description || row.description : row.note || row.description;
  const entries = [
    ['Mã lần', row.code], ['Mã đơn', movement?.root.code || row.root_code || '—'],
    ['Ngày thực hiện', formatDateVN(row.payment_date || row.operation_date)], ['Trạng thái', stateLabel[row.operation_status] || row.operation_status],
    ['Người lập', row.user_name || '—'], ['Người xác nhận', row.confirmed_name || '—'],
    ...(row.purpose ? [['Loại tiền', paymentPurposeLabel(row)], ['Số tiền', `${fmt(row.amount)} ₫`], ['Phương thức', row.method || '—'], ...(row.refund_of_code ? [['Khoản gốc', row.refund_of_code]] : []), ...(row.security_action ? [['Xử lý cọc', row.security_action === 'APPLY' ? 'Chuyển sang tiền hàng' : 'Giữ cọc bảo đảm']] : [])] : []),
  ];
  return <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
    <dl className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3">
      {entries.map(([title, value]) => <div key={title}><dt className="text-xs text-slate-600">{title}</dt><dd className="mt-1 break-words font-medium text-slate-900">{value}</dd></div>)}
    </dl>
    {movement && <div className="table-container flex min-h-0 flex-1 flex-col"><WholeRowViewport className="min-h-0 flex-1" label="Sản phẩm của lần thực hiện">
      <table className="document-table w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50"><tr className="table-header"><th className="text-center">STT</th><th>Mã sản phẩm</th><th>Tên sản phẩm</th><th className="text-center">Đơn vị tính</th><th>Vị trí</th><th className="text-center">Số lượng</th><th className="text-right">Thành tiền (₫)</th></tr></thead>
        <tbody>{movement.items.filter(line => Number(line.quantity) > 0).map((line, index) => <tr key={line.id}><td className="text-center tabular-nums">{index + 1}</td><td className="document-code">{line.item_code}</td><td className="font-medium text-slate-800">{line.item_name}</td><td className="text-center text-slate-700">{line.unit}</td><td className="text-slate-700">{line.bin_code ? `${line.bin_code} · ` : ''}{line.bin_description}</td><td className="text-center tabular-nums">{fmt(line.quantity)}</td><td className="text-right font-semibold tabular-nums">{fmt(line.inventory_value)}</td></tr>)}</tbody>
      </table>
    </WholeRowViewport></div>}
    {note && <section aria-label="Ghi chú lần thực hiện" className="max-h-24 shrink-0 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><h4 className="mb-1 font-semibold text-slate-900">Ghi chú</h4><p className="whitespace-pre-wrap break-words">{note}</p></section>}
    {row.reason && <p className="max-h-16 shrink-0 overflow-auto whitespace-pre-wrap break-words text-sm text-slate-700"><strong>Lý do từ chối: </strong>{row.reason}</p>}
  </div>;
}
