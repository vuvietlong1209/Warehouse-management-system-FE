'use client';
import { WholeRowViewport } from '@/components/ui';
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select';
import { fmt } from '@/lib/document-api';
import { matchesDocumentSearch } from '@/components/document-filters';

export type ProductExecutionLine = {
  key: string | number; code: string; name: string; bin: string; binId: number;
  quantity: number; neededQuantity: number; unitPrice: number; feasibleQuantity?: number; unit?: string;
};

export function DocumentProductLines({ lines, label, viewportLabel, inputLabel, onQuantityChange, onBinChange, binOptions, receiptOperation = false, issueOperation = false, initialDelivery = false, limitToFeasible = true, search = '' }: {
  lines: ProductExecutionLine[]; label: 'nhập' | 'xuất'; viewportLabel: string; inputLabel: (index: number) => string;
  onQuantityChange: (index: number, quantity: number) => void;
  onBinChange?: (index: number, bin: number) => void; binOptions?: SearchableSelectOption[];
  receiptOperation?: boolean; issueOperation?: boolean; initialDelivery?: boolean; limitToFeasible?: boolean; search?: string;
}) {
  const separateQuantityColumns = receiptOperation || issueOperation || initialDelivery;
  const visible = lines.map((line, index) => ({ line, index })).filter(({ line }) => matchesDocumentSearch(search, line.code, line.name));
  return <WholeRowViewport className="initial-products-viewport" label={viewportLabel}>
    <table className={`initial-products-table execution-products-table${receiptOperation || issueOperation ? ' movement-execution-products-table' : ''}${initialDelivery ? ' initial-execution-products-table' : ''}`}>
      <colgroup><col className="execution-col-index" /><col className="execution-col-code" /><col className="execution-col-name" /><col className="execution-col-bin" />{separateQuantityColumns && <><col className="execution-col-unit" /><col className="execution-col-needed" /></>}<col className="execution-col-quantity" /><col className="execution-col-amount" /></colgroup>
      <thead><tr><th scope="col" className="text-center">STT</th><th scope="col">Mã sản phẩm</th><th scope="col">Tên sản phẩm</th><th scope="col">Vị trí</th>{separateQuantityColumns && <><th scope="col" className="receipt-unit-cell text-center">Đơn vị tính</th><th scope="col" className="text-center">Lượng cần {label}</th></>}<th scope="col" className="text-center">Lượng {label}</th><th scope="col" className="text-right">Thành tiền (₫)</th></tr></thead>
      <tbody>{visible.map(({ line, index }) => <tr key={line.key}>
        <td className="text-center tabular-nums">{index + 1}</td>
        <td><span className="initial-product-code execution-product-code">{line.code}</span></td>
        <td><p className="initial-product-name">{line.name}</p></td>
        <td>{onBinChange ? <SearchableSelect id={`execution-bin-${line.key}`} label={`Vị trí ${line.code}`} required value={line.binId} options={binOptions || []} onChange={value => onBinChange(index, Number(value))} /> : <p className="initial-bin-name">{line.bin}</p>}</td>
        {separateQuantityColumns && <><td className="receipt-unit-cell text-center text-slate-700">{line.unit || '—'}</td><td className="text-center font-medium tabular-nums text-slate-900">{fmt(line.neededQuantity)}</td></>}
        <td><input aria-label={inputLabel(index)} required type="number" min="0" max={Math.min(line.neededQuantity,limitToFeasible?line.feasibleQuantity??Infinity:Infinity)} step="0.01" value={line.quantity} className="form-control text-center font-semibold tabular-nums" onChange={event => onQuantityChange(index, Number(event.target.value))} />{(!separateQuantityColumns || line.feasibleQuantity!==undefined) && <p className="initial-field-hint text-center">{!separateQuantityColumns && <>Cần {label}: <strong>{fmt(line.neededQuantity)}</strong></>}{line.feasibleQuantity!==undefined&&<span className="block">{receiptOperation ? 'Sức chứa khả thi' : issueOperation ? 'Lượng xuất khả thi' : 'Khả thi'}: {fmt(line.feasibleQuantity)}</span>}</p>}</td>
        <td className="text-right"><output aria-label={`Thành tiền dòng ${index + 1}`} className="initial-line-amount">{fmt(line.quantity * line.unitPrice)} ₫</output></td>
      </tr>)}{!visible.length && <tr><td colSpan={separateQuantityColumns ? 8 : 6} className="text-center text-slate-600">Không tìm thấy sản phẩm phù hợp.</td></tr>}</tbody>
    </table>
  </WholeRowViewport>;
}
