import type { Metadata } from 'next';
import './globals.css';
import { AuthGate } from '@/components/auth-gate';
import { FeedbackProvider } from '@/context/FeedbackContext';

export const metadata: Metadata = {
  title: 'Hệ thống quản lý kho',
  description: 'Hệ thống quản lý kho, chứng từ và báo cáo nhập - xuất - tồn',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <FeedbackProvider>
          <AuthGate>{children}</AuthGate>
        </FeedbackProvider>
      </body>
    </html>
  );
}
