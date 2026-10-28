'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar, Download, Wallet, Banknote, LogIn, LogOut,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { formatDateVN } from '@/components/ui';
import { DashboardProductChart } from '@/components/dashboard-product-chart';
import { DashboardIdleStock } from '@/components/dashboard-idle-stock';

function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(1) + ' tỷ VND';
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1) + ' tr VND';
  }
  return amount.toLocaleString('vi-VN') + ' VND';
}

export default function DashboardPage() {
  const { items, goodsReceipts, goodsIssues } = useWarehouse();

  // 1. Dynamic KPI Calculations
  const totalImportQty = useMemo(() => {
    return goodsReceipts.filter(po => po.receipt_status === 'Confirmed').reduce((sum, po) =>
      sum + po.items.reduce((itemSum, item) => itemSum + (Number(item.quantity_ordered) || 0), 0), 0
    );
  }, [goodsReceipts]);

  const totalExportQty = useMemo(() => {
    return goodsIssues.filter(so => so.issue_status === 'Confirmed').reduce((sum, so) =>
      sum + so.items.reduce((itemSum, item) => itemSum + (Number(item.quantity_ordered) || 0), 0), 0
    );
  }, [goodsIssues]);

  const totalMoneyOut = useMemo(() => {
    return goodsReceipts.filter(po => po.receipt_status === 'Confirmed').reduce((sum, po) =>
      sum + po.items.reduce((itemSum, item) => itemSum + Number(item.inventory_value ?? ((Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0))), 0), 0
    );
  }, [goodsReceipts]);

  const totalMoneyIn = useMemo(() => {
    return goodsIssues.filter(so => so.issue_status === 'Confirmed').reduce((sum, so) =>
      sum + so.items.reduce((itemSum, item) => itemSum + ((Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0)), 0), 0
    );
  }, [goodsIssues]);

  const { topMostExported, topRevenueProducts } = useMemo(() => {
    const products = new Map<number, { id: number; code: string; name: string; value: number; revenue: number }>();
    const catalog = new Map(items.map(item => [item.id, item]));
    for (const issue of goodsIssues.filter(row => row.issue_status === 'Confirmed')) {
      for (const line of issue.items) {
        const item = catalog.get(line.item_id);
        const product = products.get(line.item_id) || { id: line.item_id, code: item?.code || line.item_code || String(line.item_id),
          name: item?.name || line.item_name || line.item_code || String(line.item_id), value: 0, revenue: 0 };
        product.value += Number(line.quantity_ordered) || 0;
        product.revenue += (Number(line.quantity_ordered) || 0) * (Number(line.unit_price) || 0);
        products.set(line.item_id, product);
      }
    }
    const rows = [...products.values()];
    return {
      topMostExported: rows.filter(row => row.value > 0).sort((a, b) => b.value - a.value || a.code.localeCompare(b.code, 'vi')).slice(0, 5),
      topRevenueProducts: rows.filter(row => row.revenue > 0).sort((a, b) => b.revenue - a.revenue || a.code.localeCompare(b.code, 'vi'))
        .slice(0, 5).map(row => ({ ...row, value: row.revenue })),
    };
  }, [items, goodsIssues]);

  const todayStr = useMemo(() => formatDateVN(new Date().toISOString()), []);

  return (
    <div className="space-y-5">
      {/* Top Header Row */}
      <div className="page-header">
        <h1 className="page-title">Bảng điều khiển tổng quan</h1>

        <div className="flex items-center gap-2.5">
          <div className="date-value flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] font-medium shadow-xs">
            <Calendar className="size-4 text-slate-400" />
            <span suppressHydrationWarning>Hôm nay: {todayStr}</span>
          </div>

          <Link
            href="/reports"
            className="flex min-h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Download className="size-4" />
            <span>Xuất báo cáo</span>
          </Link>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 min-[1440px]:grid-cols-4">
        {/* Card 1: Tổng nhập kho */}
        <div className="kpi-card flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng nhập kho</p>
              <h3 className="mt-1.5 font-sans text-[23px] font-bold leading-7 tracking-tight text-slate-900 tabular-nums" suppressHydrationWarning>
                {totalImportQty.toLocaleString('vi-VN')} <span className="text-xs font-medium tracking-normal text-slate-400">đơn vị</span>
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Chứng từ PO</span>
            <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              {goodsReceipts.length} phiếu
            </span>
          </div>
        </div>

        {/* Card 2: Tổng xuất kho */}
        <div className="kpi-card flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng xuất kho</p>
              <h3 className="mt-1.5 font-sans text-[23px] font-bold leading-7 tracking-tight text-slate-900 tabular-nums" suppressHydrationWarning>
                {totalExportQty.toLocaleString('vi-VN')} <span className="text-xs font-medium tracking-normal text-slate-400">đơn vị</span>
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Chứng từ SO</span>
            <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {goodsIssues.length} phiếu
            </span>
          </div>
        </div>

        {/* Card 3: Doanh thu xuất kho */}
        <div className="kpi-card flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doanh thu xuất kho</p>
              <h3 className="mt-1.5 font-sans text-[23px] font-bold leading-7 tracking-tight text-slate-900 tabular-nums" suppressHydrationWarning>
                {formatCurrencyShort(totalMoneyIn)}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Giá trị xuất kho</span>
            <span className="max-w-[130px] truncate font-semibold text-emerald-700 tabular-nums" suppressHydrationWarning>
              {totalMoneyIn.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        {/* Card 4: Chi phí nhập hàng */}
        <div className="kpi-card flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chi phí nhập hàng</p>
              <h3 className="mt-1.5 font-sans text-[23px] font-bold leading-7 tracking-tight text-slate-900 tabular-nums" suppressHydrationWarning>
                {formatCurrencyShort(totalMoneyOut)}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Giá trị nhập kho</span>
            <span className="max-w-[130px] truncate font-semibold text-rose-700 tabular-nums" suppressHydrationWarning>
              {totalMoneyOut.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-2">
        <DashboardProductChart title="Sản phẩm xuất nhiều nhất" data={topMostExported}/>
        <DashboardProductChart title="Sản phẩm có doanh thu cao nhất" data={topRevenueProducts} revenue/>
      </div>
      <DashboardIdleStock/>
    </div>
  );
}
