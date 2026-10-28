'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { WarehouseProvider } from '@/context/WarehouseContext';
import { AppShell } from '@/components/app-shell';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-300">
        <div className="w-9 h-9 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
        <p className="text-sm">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) router.replace('/login');
    if (user && isLoginPage) router.replace('/');
  }, [isLoginPage, loading, router, user]);

  if (loading) return <LoadingScreen />;
  if (!user) return isLoginPage ? children : <LoadingScreen />;
  if (isLoginPage) return <LoadingScreen />;

  return (
    <WarehouseProvider>
      <AppShell>{children}</AppShell>
    </WarehouseProvider>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
