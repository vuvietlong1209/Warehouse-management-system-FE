'use client';

import { useWarehouse } from '@/context/WarehouseContext';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, isSyncing, loadError, refreshAll } = useWarehouse();

  return (
    <div className="app-print-shell flex h-dvh min-h-0 overflow-hidden">
      {/* Subtle Top Sync Indicator (Non-blocking) */}
      {isSyncing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-gradient-to-r from-blue-500 via-blue-500 to-emerald-500 animate-pulse pointer-events-none" />
      )}

      <Sidebar />
      <div className="app-print-content flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="app-print-main relative min-h-0 flex-1 overflow-y-auto px-6 py-5 2xl:px-7 2xl:py-6">
          {loading ? (
            /* Loading state: chỉ hiển thị lần đầu khi không có cache */
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-500">Đang khởi tạo dữ liệu hệ thống...</p>
            </div>
          ) : loadError ? (
            /* Error state: backend không phản hồi */
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border-2 border-red-100">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center max-w-md">
                <h3 className="mb-1 text-base font-bold text-slate-800">Không thể kết nối máy chủ</h3>
                <p className="text-sm leading-relaxed text-slate-500">{loadError}</p>
              </div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 text-xs text-slate-600 text-left max-w-sm w-full">
                <p className="font-semibold text-slate-700 mb-1.5">👉 Cách khắc phục:</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Mở CMD trong thư mục <code className="bg-slate-100 px-1 rounded font-mono">backend/</code></li>
                  <li>Chạy lệnh: <code className="bg-slate-100 px-1 rounded font-mono">npm run dev</code></li>
                  <li>Nhấn nút Thử lại bên dưới</li>
                </ol>
              </div>
              <button
                onClick={() => refreshAll()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Thử kết nối lại
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
