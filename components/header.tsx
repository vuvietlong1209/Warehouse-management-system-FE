'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { useAuth } from '@/context/AuthContext';
import { IconButton } from '@/components/ui';

const pageNames: Record<string, { section: string; page: string }> = {
  '/': { section: 'Tổng quan', page: 'Bảng điều khiển' },
  '/forecast': { section: 'Tổng quan', page: 'Dự báo nhu cầu' },
  '/documents/goods-receipts': { section: 'Chứng từ kho', page: 'Đơn nhập' },
  '/documents/goods-receipts/create': { section: 'Đơn nhập', page: 'Lập đơn nhập' },
  '/documents/goods-issues': { section: 'Chứng từ kho', page: 'Đơn xuất' },
  '/documents/goods-issues/create': { section: 'Đơn xuất', page: 'Lập đơn xuất' },
  '/documents/inventory-checks': { section: 'Chứng từ kho', page: 'Kiểm kê kho' },
  '/documents/inventory-checks/create': { section: 'Kiểm kê kho', page: 'Lập phiếu kiểm kê' },
  '/categories/items': { section: 'Danh mục', page: 'Sản phẩm & linh kiện' },
  '/categories/locations': { section: 'Danh mục', page: 'Vị trí Bin' },
  '/categories/warehouses': { section: 'Danh mục', page: 'Kho hàng' },
  '/categories/partners': { section: 'Danh mục', page: 'Khách hàng & nhà cung cấp' },
  '/categories/users': { section: 'Danh mục', page: 'Nhân viên & phân quyền' },
  '/categories/units': { section: 'Danh mục', page: 'Đơn vị tính' },
  '/inventory/summary': { section: 'Báo cáo', page: 'Tổng hợp tồn kho' },
  '/reports': { section: 'Báo cáo', page: 'Báo cáo phân tích' },
};

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { isSyncing, refreshAll, users } = useWarehouse();
  const { user, logout, refreshSession } = useAuth();
  useEffect(() => {
    const current = users.find(value => value.id === user?.id);
    if (current && (current.name !== user?.name || current.role_id !== user?.role_id || current.role_name !== user?.role_name)) void refreshSession();
  }, [users, user, refreshSession]);
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'A';
  const currentPage = pageNames[pathname] || { section: 'Hệ thống quản lý kho', page: 'Quản lý kho' };

  return (
    <header className="no-print sticky top-0 z-30 flex h-[var(--layout-header)] shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-6 shadow-xs backdrop-blur">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">{currentPage.section}</p>
        <h2 className="truncate text-sm font-semibold leading-5 text-slate-900">{currentPage.page}</h2>
      </div>

      <div className="flex items-center gap-3">
        <div aria-live="polite" className="flex items-center gap-2">
          {isSyncing ? (
            <span className="status-badge status-badge-info">
              <RefreshCw className="size-3 animate-spin" />
              Đang đồng bộ
            </span>
          ) : (
            <IconButton label="Đồng bộ dữ liệu" onClick={() => void refreshAll()} tone="primary">
              <RefreshCw className="size-4" />
            </IconButton>
          )}
        </div>

        <div className="h-7 w-px bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white ring-2 ring-brand-100">
            {initial}
          </div>
          <div className="min-w-0 text-left">
            <p className="max-w-44 truncate text-sm font-semibold leading-tight text-slate-800">{user?.name || 'Quản trị viên'}</p>
            <p className="mt-0.5 text-xs leading-tight text-slate-500">{user?.role_name || 'Quản trị hệ thống'}</p>
          </div>
          <IconButton label="Đăng xuất" onClick={() => void logout()} tone="danger">
            <LogOut className="size-4" />
          </IconButton>
        </div>
      </div>
    </header>
  );
};
