'use client';

import { AlertTriangle } from 'lucide-react';
import { formatDateVN } from '@/components/ui';

export type ForecastCoverage = {
  series_count: number;
  ready_series_count: number;
  unavailable_series_count: number;
  required_through_date: string;
  complete_through_date: string | null;
  minimum_history_weeks: number;
};

export function formatForecastValue(value: number | null | undefined, formatter: Intl.NumberFormat) {
  return value == null ? '—' : formatter.format(value);
}

export function ForecastCoverageNotice({ coverage }: {
  coverage?: ForecastCoverage | null;
}) {
  if (!coverage?.unavailable_series_count) return null;
  return (
    <div role="status" className="flex shrink-0 items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-slate-700">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold text-slate-900">Chưa đủ dữ liệu dự báo.</strong>{' '}
        {coverage.complete_through_date ? `Lịch sử đầy đủ đến ${formatDateVN(coverage.complete_through_date)}; ` : ''}
        cần đủ {coverage.minimum_history_weeks} tuần liên tục và chốt đến {formatDateVN(coverage.required_through_date)}.
        {' '}Dấu “—” là chưa xác định, không phải 0. Không tự điền tuần thiếu hoặc đề xuất nhập từ dữ liệu thiếu.
      </p>
    </div>
  );
}
