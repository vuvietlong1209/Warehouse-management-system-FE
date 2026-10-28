'use client';

import { useRef, useState } from 'react';

type StockReader = (itemId: number, binId?: number, warehouseId?: number) => number;

export function useDocumentSubmission(liveStockReader: StockReader) {
  const [submitting, setSubmitting] = useState(false);
  const active = useRef(false);
  const navigating = useRef(false);
  const stockSnapshot = useRef<StockReader | null>(null);

  const begin = () => {
    // A ref closes the double-click window before React commits the disabled state.
    if (active.current) return false;
    active.current = true;
    navigating.current = false;
    // WarehouseProvider's reader closes over immutable stock maps. Keep this form's
    // pre-posting view while the shared context receives the real updated stock.
    stockSnapshot.current = liveStockReader;
    setSubmitting(true);
    return true;
  };

  const finish = () => {
    // App Router navigation is asynchronous: do not flash/re-enable the old form.
    if (navigating.current) return;
    active.current = false;
    stockSnapshot.current = null;
    setSubmitting(false);
  };

  const navigate = (go: () => void) => {
    navigating.current = true;
    go();
  };

  return { submitting, begin, finish, navigate, getItemStock: stockSnapshot.current || liveStockReader };
}
