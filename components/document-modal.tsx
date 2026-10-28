'use client';
import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui';

export function DocumentModal({ title, children, actions, onClose, busy = false, wide = false, inactive = false, className = '', style }: {
  title: string; children: ReactNode; actions?: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean; inactive?: boolean; className?: string; style?: CSSProperties;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (panel.current) panel.current.inert = inactive; }, [inactive]);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-3">
    <section ref={panel} style={style} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} aria-hidden={inactive || undefined}
      onKeyDown={e => { if (e.key === 'Escape' && !busy && !inactive) { e.stopPropagation(); onClose(); } }}
      className={`ui-dialog document-child-dialog flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none ${wide ? 'max-w-6xl' : 'max-w-4xl'} ${className}`}>
      <header className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 ${actions ? 'flex-wrap py-2.5' : 'py-4'}`}>
        <h3 className="min-w-0 text-base font-bold text-slate-900">{title}</h3>
        <div className="ml-auto flex min-w-0 max-w-full items-center gap-2">
        {actions}
        <IconButton label={`Đóng ${title}`} disabled={busy || inactive} onClick={onClose}><X className="size-5" /></IconButton>
        </div>
      </header>
      {children}
    </section>
  </div>;
}
