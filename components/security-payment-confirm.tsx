'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentModal } from '@/components/document-modal';
import { Button } from '@/components/ui';
import { fmt } from '@/lib/document-api';

export type SecurityAction = 'KEEP' | 'APPLY';
export function useSecurityConfirmation() {
  const [prompt, setPrompt] = useState<{ amount: number; count: number; paymentCount: number } | null>(null);
  const resolver = useRef<((value: SecurityAction | null) => void) | null>(null);
  useEffect(() => () => { resolver.current?.(null); resolver.current = null; }, []);
  const confirmSecurity = useCallback((amount: number, count = 1, paymentCount = count) => {
    if (resolver.current) return Promise.resolve(null);
    return new Promise<SecurityAction | null>(resolve => { resolver.current = resolve; setPrompt({ amount, count, paymentCount }); });
  }, []);
  const finish = (value: SecurityAction | null) => { const resolve = resolver.current; resolver.current = null; setPrompt(null); resolve?.(value); };
  const securityConfirmation = prompt && <DocumentModal title="Xác nhận cọc bảo đảm" style={{ maxWidth: 560 }} onClose={() => finish(null)}>
    <div className="space-y-2 px-5 py-3 text-sm text-slate-700">
      <p>{prompt.count} khoản cọc · <strong className="tabular-nums text-slate-900">{fmt(prompt.amount)} ₫</strong>{prompt.paymentCount > prompt.count && <span> · {prompt.paymentCount - prompt.count} khoản tiền khác</span>}</p>
      <p>Giữ cọc để hoàn trả sau, hoặc chuyển cọc sang tiền hàng.</p>
    </div>
    <footer className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-5 py-3">
      <Button size="sm" variant="secondary" onClick={() => finish(null)}>Hủy</Button>
      <Button size="sm" variant="secondary" onClick={() => finish('KEEP')}>Xác nhận cọc</Button>
      <Button size="sm" onClick={() => finish('APPLY')}>Chuyển sang tiền hàng</Button>
    </footer>
  </DocumentModal>;
  return { confirmSecurity, securityConfirmation, securityOpen: !!prompt };
}
