'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { WholeRowViewport } from '@/components/ui';
import { matchesDocumentSearch } from '@/components/document-filters';
import { fmt, type DocumentKind, type ManagedDocument } from '@/lib/document-api';

export function DocumentOverview({ kind, doc }: { kind: DocumentKind; doc: ManagedDocument }) {
  const [search, setSearch] = useState('');
  const label = kind === 'receipt' ? 'nhập' : 'xuất';
  const rows = doc.items.filter(d => matchesDocumentSearch(search, d.item_code, d.item_name));
  const metrics: [string, number][] = [
    ['Lượng yêu cầu', doc.items.reduce((s, d) => s + Number(d.quantity_ordered), 0)],
    [`Đã ${label}`, doc.fulfilled_quantity], ...(kind==='receipt'?[[`Còn phải ${label}`, doc.remaining_quantity] as [string,number]]:[]),
    ...(kind === 'issue' ? [['Số lượng giữ chỗ', doc.reserved_quantity] as [string, number]] : []), ['Giá trị đơn', doc.planned_amount], ['Còn phải thanh toán', doc.outstanding_amount],
  ];
  return <div className="document-overview flex min-h-0 flex-1 flex-col">
    <div className="document-overview-metrics grid shrink-0 grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
      {metrics.map(([title, value]) => <article key={title} className={`rounded-lg border p-3 ${['Giá trị đơn', 'Còn phải thanh toán'].includes(title) ? 'border-blue-100 bg-blue-50/60' : 'border-slate-200 bg-slate-50/60'}`}>
        <p className="text-xs font-medium text-slate-600">{title}</p>
        <p className="document-overview-value font-bold tabular-nums text-slate-900">{fmt(value)}{['Giá trị đơn', 'Còn phải thanh toán'].includes(title) && <span className="ml-1 text-sm">₫</span>}</p>
        {title === 'Còn phải thanh toán' && <p className="document-overview-settled text-slate-700">Đã thanh toán: {fmt(doc.settled_amount)} ₫</p>}
      </article>)}
    </div>
    <div className="relative max-w-lg shrink-0"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input aria-label="Tìm sản phẩm trong đơn" className="form-control !pl-9" placeholder="Tìm mã hoặc tên sản phẩm…" value={search} onChange={e => setSearch(e.target.value)} />
    </div>
    <div className="table-container flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200">
      <WholeRowViewport className="min-h-0 flex-1" label="Sản phẩm của đơn"><table className="document-table overview-table w-full text-left">
        <thead className="sticky top-0 z-10 bg-slate-50"><tr className="table-header"><th className="text-center">STT</th><th>Mã sản phẩm</th><th>Tên sản phẩm</th><th className="text-center">Đơn vị tính</th><th>Vị trí</th><th className="text-center">Lượng yêu cầu</th><th className="text-center">Đã {label}</th><th className="text-center">Còn phải {label}</th><th className="text-right">Thành tiền (₫)</th></tr></thead>
        <tbody>{rows.map((d, index) => <tr key={d.id}><td className="text-center tabular-nums">{index + 1}</td><td><span className="document-code">{d.item_code}</span></td><td className="font-medium text-slate-800">{d.item_name}</td><td className="text-center text-slate-700">{d.unit}</td><td className="text-slate-700">{d.bin_code ? `${d.bin_code} · ` : ''}{d.bin_description}</td><td className="text-center tabular-nums">{fmt(d.quantity_ordered)}</td><td className="text-center tabular-nums">{fmt(Number(d.fulfilled_quantity) + Number(d.fulfilled_bonus || 0))}</td><td className="text-center tabular-nums">{fmt(d.remaining_quantity)}</td><td className="document-amount">{fmt(Number(d.quantity_ordered) * Number(d.unit_price))}</td></tr>)}
          {!rows.length && <tr><td colSpan={9} className="py-10 text-center text-slate-500">Không có sản phẩm phù hợp.</td></tr>}
        </tbody>
      </table></WholeRowViewport>
    </div>
  </div>;
}
