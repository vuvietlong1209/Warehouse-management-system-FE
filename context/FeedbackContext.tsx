'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X, XCircle } from 'lucide-react';
import { Button, IconButton, cn } from '@/components/ui';

export type FeedbackTone = 'success' | 'error' | 'warning' | 'info';

type NotificationOptions = {
  tone?: FeedbackTone;
  title: string;
  message?: string;
  duration?: number;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warning';
};

type PromptOptions = {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
};

type AlertOptions = {
  title: string;
  message: string;
  tone?: 'error' | 'warning' | 'info';
};

type Toast = Required<Pick<NotificationOptions, 'tone' | 'title'>> & {
  id: number;
  message?: string;
};

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void }
  | { kind: 'alert'; options: AlertOptions };

type FeedbackContextValue = {
  notify: (options: NotificationOptions) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
  requestText: (options: PromptOptions) => Promise<string | null>;
  showAlert: (options: AlertOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

// Share the readable body typography without changing titles, buttons or status colors.
const feedbackMessageClassName = 'whitespace-pre-line text-sm font-normal leading-5 text-slate-700';

const toastStyles: Record<FeedbackTone, { border: string; icon: string; iconBg: string }> = {
  success: { border: 'border-emerald-200', icon: 'text-emerald-600', iconBg: 'bg-emerald-50' },
  error: { border: 'border-rose-200', icon: 'text-rose-600', iconBg: 'bg-rose-50' },
  warning: { border: 'border-amber-200', icon: 'text-amber-600', iconBg: 'bg-amber-50' },
  info: { border: 'border-blue-200', icon: 'text-blue-600', iconBg: 'bg-blue-50' },
};

function FeedbackIcon({ tone, className }: { tone: FeedbackTone; className?: string }) {
  const props = { className: cn('size-5', className) };
  if (tone === 'success') return <CheckCircle2 {...props} />;
  if (tone === 'error') return <XCircle {...props} />;
  if (tone === 'warning') return <AlertTriangle {...props} />;
  return <Info {...props} />;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const dialogPanel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const notify = useCallback((options: NotificationOptions) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const tone = options.tone || 'info';
    setToasts(current => [...current.slice(-3), { id, tone, title: options.title, message: options.message }]);
    window.setTimeout(() => dismissToast(id), options.duration ?? 4500);
  }, [dismissToast]);

  const confirmAction = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    setDialog({ kind: 'confirm', options, resolve });
  }), []);

  const requestText = useCallback((options: PromptOptions) => new Promise<string | null>(resolve => {
    setPromptValue('');
    setDialog({ kind: 'prompt', options, resolve });
  }), []);

  const showAlert = useCallback((options: AlertOptions) => {
    setDialog({ kind: 'alert', options });
  }, []);

  const cancelDialog = useCallback(() => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(false);
    else if (dialog.kind === 'prompt') dialog.resolve(null);
    setDialog(null);
    setPromptValue('');
  }, [dialog]);

  const submitDialog = useCallback(() => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(true);
    else if (dialog.kind === 'prompt') dialog.resolve(promptValue.trim());
    setDialog(null);
    setPromptValue('');
  }, [dialog, promptValue]);

  useEffect(() => {
    if (!dialog) return undefined;
    const panel = dialogPanel.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const initialSelector = dialog.kind === 'prompt' ? 'textarea' : dialog.kind === 'alert' ? '[data-feedback-dismiss]' : '[data-feedback-cancel]';
    const initialTarget = panel?.querySelector<HTMLElement>(initialSelector);
    (initialTarget || panel)?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelDialog();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const targets = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),[tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0);
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    // Capture Escape before a catalog/document popup underneath can also close.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [cancelDialog, dialog]);

  const value = useMemo(() => ({ notify, confirmAction, requestText, showAlert }), [confirmAction, notify, requestText, showAlert]);
  const dialogTone = dialog?.kind === 'confirm' ? dialog.options.tone || 'primary' : 'warning';
  const dialogIconTone: FeedbackTone = dialog?.kind === 'alert' ? dialog.options.tone || 'error'
    : dialogTone === 'danger' ? 'error' : dialogTone === 'warning' ? 'warning' : 'info';
  const isPromptInvalid = dialog?.kind === 'prompt' && dialog.options.required !== false && !promptValue.trim();

  const feedbackLayer = (
    <>
      <div
        className="feedback-notifications pointer-events-none fixed right-4 top-4 w-[min(390px,calc(100vw-2rem))]"
        style={{ zIndex: dialog ? 9990 : 10010 }}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-y-auto overscroll-contain">
        {toasts.map(toast => {
          const style = toastStyles[toast.tone];
          return (
            <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-xl shadow-slate-900/10', style.border)}>
              <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', style.iconBg, style.icon)}><FeedbackIcon tone={toast.tone} /></div>
              <div className="min-w-0 flex-1 pt-0.5 [overflow-wrap:anywhere]"><p className="text-sm font-bold text-slate-900">{toast.title}</p>{toast.message ? <p className={cn('mt-1', feedbackMessageClassName)}>{toast.message}</p> : null}</div>
              <IconButton label="Đóng thông báo" className="-mr-1 -mt-1 size-8 shrink-0" onClick={() => dismissToast(toast.id)}><X className="size-4" /></IconButton>
            </div>
          );
        })}
        </div>
      </div>

      {dialog ? (
        <div
          className="feedback-dialog-overlay fixed inset-0 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          style={{ zIndex: 10000 }}
          onMouseDown={event => { if (event.target === event.currentTarget) cancelDialog(); }}
        >
          <div
            ref={dialogPanel}
            role={dialog.kind === 'alert' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            aria-describedby={dialog.options.message ? 'feedback-dialog-description' : undefined}
            tabIndex={-1}
            className="feedback-dialog flex max-h-[calc(100dvh-2rem)] w-full max-w-[420px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 outline-none"
          >
            <div className="min-h-0 overflow-y-auto overscroll-contain">
            {dialog.kind === 'alert' ? (
              <div className="space-y-4 px-6 pb-5 pt-6 text-center [overflow-wrap:anywhere]">
                <div className={cn('mx-auto flex size-16 items-center justify-center rounded-full', toastStyles[dialogIconTone].iconBg, toastStyles[dialogIconTone].icon)}>
                  <AlertTriangle className="size-7" aria-hidden="true" />
                </div>
                <h2 id="feedback-dialog-title" className="text-base font-bold text-slate-900">{dialog.options.title}</h2>
                <p id="feedback-dialog-description" className={feedbackMessageClassName}>{dialog.options.message}</p>
              </div>
            ) : (
            <div className="flex items-start gap-3 p-5">
              <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', toastStyles[dialogIconTone].iconBg, toastStyles[dialogIconTone].icon)}>
                {dialogTone === 'danger' ? <ShieldAlert className="size-5" /> : <FeedbackIcon tone={dialogIconTone} />}
              </div>
              <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <h2 id="feedback-dialog-title" className="text-base font-bold text-slate-900">{dialog.options.title}</h2>
                {dialog.options.message ? <p id="feedback-dialog-description" className={cn('mt-1.5', feedbackMessageClassName)}>{dialog.options.message}</p> : null}
              </div>
              <IconButton label="Đóng hộp thoại" className="-mr-2 -mt-2 shrink-0" onClick={cancelDialog}><X className="size-5" /></IconButton>
            </div>
            )}

            {dialog.kind === 'prompt' ? (
              <div className="px-5 pb-5">
                <label htmlFor="feedback-prompt-input" className="form-label">{dialog.options.label || 'Nội dung'}</label>
                <textarea id="feedback-prompt-input" autoFocus value={promptValue} onChange={event => setPromptValue(event.target.value)} placeholder={dialog.options.placeholder} className="form-control min-h-24 resize-y rounded-sm p-2" maxLength={500} />
                <p className="mt-1.5 text-right text-[11px] text-slate-400">{promptValue.length}/500 ký tự</p>
              </div>
            ) : null}
            </div>

            {dialog.kind === 'alert' ? (
              <div className="shrink-0 px-6 pb-6">
                <Button data-feedback-dismiss variant={dialogIconTone === 'error' ? 'danger' : 'primary'} className="w-full" onClick={cancelDialog}>Đã hiểu &amp; Đóng</Button>
              </div>
            ) : (
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
                <Button data-feedback-cancel variant="secondary" onClick={cancelDialog}>{dialog.options.cancelLabel || 'Hủy'}</Button>
                <Button variant={dialogTone === 'danger' ? 'danger' : 'primary'} disabled={isPromptInvalid} onClick={submitDialog}>
                  {dialog.options.confirmLabel || (dialog.kind === 'prompt' ? 'Xác nhận' : 'Tiếp tục')}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {mounted ? createPortal(feedbackLayer, document.body) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback phải được sử dụng bên trong FeedbackProvider');
  return context;
}
