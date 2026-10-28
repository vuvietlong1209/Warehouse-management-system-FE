'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn, IconButton } from '@/components/ui';

const navClass = 'flex min-h-[38px] items-center rounded-lg text-[13px] transition-colors';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(pathname.startsWith('/categories'));
  const [documentsOpen, setDocumentsOpen] = useState(pathname.startsWith('/documents'));

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('ewarehouse-sidebar-collapsed') === 'true');
  }, []);

  const changeCollapsed = (value: boolean) => {
    setCollapsed(value);
    window.localStorage.setItem('ewarehouse-sidebar-collapsed', String(value));
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'A';

  const directLink = (
    path: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
  ) => (
    <Link
      href={path}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        navClass,
        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        isActive(path)
          ? 'bg-brand-600 font-semibold text-white shadow-md shadow-brand-950/20'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white',
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );

  const openGroup = (group: 'documents' | 'categories') => {
    if (collapsed) {
      changeCollapsed(false);
      if (group === 'documents') setDocumentsOpen(true);
      if (group === 'categories') setCategoriesOpen(true);
      return;
    }
    if (group === 'documents') setDocumentsOpen(value => !value);
    if (group === 'categories') setCategoriesOpen(value => !value);
  };

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'no-print flex h-screen shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-[width] duration-200',
        collapsed ? 'w-[var(--layout-sidebar-collapsed)]' : 'w-[var(--layout-sidebar)]',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-slate-800 bg-slate-950/40', collapsed ? 'justify-center px-2' : 'gap-2.5 px-3.5')}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-950/30">
          <Boxes className="size-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="whitespace-nowrap text-xs font-bold tracking-tight text-white">Hệ thống quản lý kho</p>
            <p className="truncate text-xs text-slate-400">Quản trị kho hàng</p>
          </div>
        ) : null}
        {!collapsed ? (
          <IconButton
            label="Thu gọn thanh điều hướng"
            onClick={() => changeCollapsed(true)}
            className="shrink-0 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <PanelLeftClose className="size-4" />
          </IconButton>
        ) : null}
      </div>

      {collapsed ? (
        <div className="flex justify-center border-b border-slate-800 px-2 py-2">
          <IconButton
            label="Mở rộng thanh điều hướng"
            onClick={() => changeCollapsed(false)}
            className="text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <PanelLeftOpen className="size-4" />
          </IconButton>
        </div>
      ) : null}

      <nav aria-label="Điều hướng chính" className={cn('flex-1 space-y-4 overflow-y-auto py-4 font-medium', collapsed ? 'px-2' : 'px-3')}>
        <section aria-label="Tổng quan">
          {!collapsed ? <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Tổng quan</p> : null}
          {directLink('/', 'Bảng điều khiển', LayoutDashboard)}
          <div className="mt-1">{directLink('/forecast', 'Dự báo nhu cầu', TrendingUp)}</div>
        </section>

        <section aria-label="Vận hành kho">
          {!collapsed ? <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Vận hành kho</p> : null}
          <div className="space-y-1">
            <button
              type="button"
              title={collapsed ? 'Chứng từ kho' : undefined}
              aria-label={collapsed ? 'Chứng từ kho' : undefined}
              aria-expanded={!collapsed && documentsOpen}
              onClick={() => openGroup('documents')}
              className={cn(
                navClass,
                'w-full',
                collapsed ? 'justify-center px-2' : 'justify-between px-3',
                pathname.startsWith('/documents') ? 'bg-slate-800 font-semibold text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <span className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
                <FileText className="size-[18px] shrink-0" />
                {!collapsed ? <span>Chứng từ kho</span> : null}
              </span>
              {!collapsed ? documentsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : null}
            </button>
            {!collapsed && documentsOpen ? (
              <div className="ml-[21px] space-y-1 border-l border-slate-700 pl-3">
                {directLink('/documents/goods-receipts', 'Đơn nhập', FileText)}
                {directLink('/documents/goods-issues', 'Đơn xuất', FileText)}
                {directLink('/documents/inventory-checks', 'Kiểm kê kho', FileText)}
              </div>
            ) : null}

            <button
              type="button"
              title={collapsed ? 'Quản lý danh mục' : undefined}
              aria-label={collapsed ? 'Quản lý danh mục' : undefined}
              aria-expanded={!collapsed && categoriesOpen}
              onClick={() => openGroup('categories')}
              className={cn(
                navClass,
                'w-full',
                collapsed ? 'justify-center px-2' : 'justify-between px-3',
                pathname.startsWith('/categories') ? 'bg-slate-800 font-semibold text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <span className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
                <FolderTree className="size-[18px] shrink-0" />
                {!collapsed ? <span>Quản lý danh mục</span> : null}
              </span>
              {!collapsed ? categoriesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : null}
            </button>
            {!collapsed && categoriesOpen ? (
              <div className="ml-[21px] space-y-1 border-l border-slate-700 pl-3">
                {directLink('/categories/items', 'Sản phẩm & linh kiện', Package)}
                {directLink('/categories/locations', 'Vị trí Bin', MapPin)}
                {directLink('/categories/warehouses', 'Kho hàng', Building2)}
                {directLink('/categories/partners', 'Khách hàng & NCC', Users)}
                {directLink('/categories/users', 'Nhân viên & phân quyền', UserCheck)}
                {directLink('/categories/units', 'Đơn vị tính', Scale)}
              </div>
            ) : null}
          </div>
        </section>

        <section aria-label="Báo cáo và tài chính">
          {!collapsed ? <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Báo cáo & tài chính</p> : null}
          <div className="space-y-1">
            {directLink('/inventory/summary', 'Tổng hợp tồn kho', Boxes)}
            {directLink('/reports', 'Báo cáo phân tích', BarChart3)}
          </div>
        </section>
      </nav>

      <div className={cn('border-t border-slate-800 bg-slate-950/40', collapsed ? 'flex justify-center p-3' : 'flex items-center gap-3 p-3.5')}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-400/30 bg-brand-600 font-bold text-white">
          {initial}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name || 'Quản trị viên'}</p>
            <p className="truncate text-xs text-slate-400">{user?.role_name || 'Quản trị hệ thống'}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
