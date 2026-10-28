import type { ManagedDocument } from '@/lib/document-api';
type StockSource = {
  items: { id: number }[]; bins: { id: number; max_capacity?: number }[];
  getItemStock?: (item: number, bin?: number) => number;
  getItemAvailableStock?: (item: number, bin?: number) => number;
};
export function feasibleAtBin(receipt: boolean, doc: ManagedDocument, item: number, bin: number, source: StockSource) {
  if(receipt){
    const capacity=source.bins.find(b=>b.id===bin)?.max_capacity;
    if(capacity==null||!source.getItemStock)return Infinity;
    return Math.max(0,Number(capacity)-source.items.reduce((sum,i)=>sum+source.getItemStock!(i.id,bin),0));
  }
  if(!source.getItemAvailableStock)return Infinity;
  const own=doc.items.filter(d=>d.item_id===item&&d.bin_id===bin).reduce((sum,d)=>sum+Number(d.reserved_quantity||0),0);
  return Math.max(0,source.getItemAvailableStock(item,bin)+own);
}
