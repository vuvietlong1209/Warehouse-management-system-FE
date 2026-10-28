'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/ui';

type DocumentCreateShellProps = {
  backHref: string;
  title: string;
  description?: string;
  statusLabel: string;
  children: ReactNode;
  summary: ReactNode;
  busy?: boolean;
};

export function DocumentCreateShell({
  backHref,
  title,
  description,
  statusLabel,
  children,
  summary,
  busy = false,
}: DocumentCreateShellProps) {
  return (
    <div aria-busy={busy} className="mx-auto w-full max-w-[1500px] space-y-5 pb-8">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label="Quay lại danh sách chứng từ"
            aria-disabled={busy}
            tabIndex={busy ? -1 : undefined}
            onClick={event => { if (busy) event.preventDefault(); }}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-xs transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            {description ? <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}
          </div>
        </div>
        <StatusBadge tone="warning">{statusLabel}</StatusBadge>
      </div>

      <fieldset disabled={busy} className="m-0 grid min-w-0 items-start gap-4 border-0 p-0 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {children}
        </section>
        <aside className="xl:sticky xl:top-5">{summary}</aside>
      </fieldset>
    </div>
  );
}
