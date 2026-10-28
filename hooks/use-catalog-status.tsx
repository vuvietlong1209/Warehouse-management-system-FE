'use client';

import { FilterSelect } from '@/components/filter-select';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useFeedback } from '@/context/FeedbackContext';
import { CatalogEntity, useWarehouse } from '@/context/WarehouseContext';

export type ActivityFilter = 'all' | 'active' | 'inactive';

export function ActivityStatusFilter({
  value,
  onChange,
}: {
  value: ActivityFilter;
  onChange: (value: ActivityFilter) => void;
}) {
  return (
    <FilterSelect label="Lọc theo trạng thái hoạt động"
      value={value}
      onChange={event => onChange(event as ActivityFilter)}
      className="form-control w-56 shrink-0"
      aria-label="Lọc theo trạng thái hoạt động"
    >
      <option value="all">Tất cả trạng thái</option>
      <option value="active">Đang hoạt động</option>
      <option value="inactive">Ngừng hoạt động</option>
    </FilterSelect>
  );
}

export function useCatalogRows<T>(endpoint: string) {
  const { dataRevision } = useWarehouse();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const requestSequence = useRef(0);

  const reload = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await fetch(`${endpoint}${separator}activity_status=all`, { cache: 'no-store' });
      const body = await response.json();
      if (sequence !== requestSequence.current) return;
      if (!response.ok) throw new Error(body.message || body.error || 'Không tải được danh mục');
      setRows(Array.isArray(body) ? body : body.data || []);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [endpoint, dataRevision]);

  useEffect(() => { void reload(); return () => { requestSequence.current += 1; }; }, [reload]);
  return { rows, loading, reload };
}

export function useCatalogStatusConfirmation() {
  const { getCatalogDeactivationImpact, setCatalogStatus } = useWarehouse();
  const { confirmAction } = useFeedback();

  const prepareStatusChange = useCallback(async ({
    entity,
    id,
    currentStatus,
    nextStatus,
    displayName,
  }: {
    entity: CatalogEntity;
    id: number;
    currentStatus: boolean;
    nextStatus: boolean;
    displayName: string;
  }) => {
    if (currentStatus === nextStatus || nextStatus) return { proceed: true, confirmed: false };
    const impact = await getCatalogDeactivationImpact(entity, id);
    if (!impact.requires_confirmation) return { proceed: true, confirmed: false };

    const details = [
      impact.stock !== 0 ? `Tồn: ${impact.stock.toLocaleString('vi-VN')} đơn vị` : '',
      impact.pending_documents > 0 ? `${impact.pending_documents.toLocaleString('vi-VN')} phiếu chưa duyệt` : '',
      impact.dependent_records > 0 ? `${impact.dependent_records.toLocaleString('vi-VN')} danh mục phụ thuộc` : '',
      impact.cascaded_records > 0 ? `${impact.cascaded_records.toLocaleString('vi-VN')} vị trí sẽ ngừng hoạt động` : '',
    ].filter(Boolean).join(' · ');
    const accepted = await confirmAction({
      title: `Dừng hoạt động ${impact.label.toLocaleLowerCase('vi-VN')}?`,
      message: `${displayName}\n${details}.\nKhông thể duyệt phiếu liên quan sau khi dừng. Lịch sử được giữ nguyên.`,
      confirmLabel: 'Dừng hoạt động',
      tone: 'warning',
    });
    return { proceed: accepted, confirmed: accepted };
  }, [confirmAction, getCatalogDeactivationImpact]);

  return { prepareStatusChange, setCatalogStatus };
}

