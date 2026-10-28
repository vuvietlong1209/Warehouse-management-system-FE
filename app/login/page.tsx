'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Boxes, Eye, EyeOff, LockKeyhole, PackageCheck, ShieldCheck, TrendingUp, Truck, UserRound, Warehouse } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RequiredMark } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password, !!rememberMe);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-clip bg-[#e8f1ff] px-4 py-8 font-sans text-slate-900 sm:px-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(255,255,255,0.92),transparent_29%),radial-gradient(circle_at_84%_9%,rgba(59,130,246,0.30),transparent_29%),linear-gradient(145deg,#f5f9ff_0%,#e8f1ff_48%,#dae9fb_100%)]" />
      <div aria-hidden="true" className="absolute -bottom-36 -left-[8%] h-72 w-[68%] rotate-[-4deg] rounded-[50%] bg-brand-300/45" />
      <div aria-hidden="true" className="absolute -bottom-44 -right-[14%] h-80 w-[75%] rotate-[5deg] rounded-[50%] bg-brand-300/40" />
      <div aria-hidden="true" className="absolute left-[7%] top-[18%] grid grid-cols-5 gap-2 opacity-30">{Array.from({ length: 15 }).map((_, index) => <span key={index} className="size-1 rounded-full bg-brand-400" />)}</div>
      <div aria-hidden="true" className="absolute bottom-[14%] right-[7%] grid grid-cols-6 gap-2 opacity-25">{Array.from({ length: 18 }).map((_, index) => <span key={index} className="size-1 rounded-full bg-brand-500" />)}</div>

      <section className="relative grid w-full max-w-[960px] overflow-hidden rounded-xl border border-white/90 bg-white shadow-[0_28px_75px_-30px_rgba(30,64,175,0.46)] md:min-h-[540px] md:grid-cols-[1.08fr_.92fr]">
        <div className="relative hidden overflow-hidden border-r border-brand-200 bg-gradient-to-br from-brand-100 via-white to-brand-100/90 p-10 md:flex md:flex-col">
          <div aria-hidden="true" className="absolute -left-24 bottom-4 size-72 rounded-full border-[42px] border-brand-200/70" />
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-64 rounded-full bg-brand-200/55" />

          <div className="relative flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-300/70">
              <Boxes className="size-7" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">Hệ thống quản lý kho</h1>
          </div>

          <div className="relative flex flex-1 items-center justify-center py-5">
            <div className="relative h-80 w-full max-w-sm">
              <div className="absolute left-0 top-7 flex items-center gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-lg shadow-brand-200/50">
                <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><PackageCheck className="size-5" /></span>
                <b className="text-sm text-slate-800">Theo dõi tồn kho</b>
              </div>
              <div className="absolute right-0 top-24 flex items-center gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-lg shadow-brand-200/50">
                <span className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Truck className="size-5" /></span>
                <b className="text-sm text-slate-800">Nhập · Xuất</b>
              </div>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-lg shadow-brand-200/50">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700"><TrendingUp className="size-5" /></span>
                <b className="whitespace-nowrap text-sm text-slate-800">Dự báo nhu cầu</b>
              </div>
              <div className="absolute left-1/2 top-1/2 flex size-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand-200 to-brand-300/90 shadow-[0_24px_48px_-25px_rgba(37,99,235,0.72)] ring-8 ring-white/70">
                <Warehouse className="size-24 text-brand-700" strokeWidth={1.35} />
                <div className="mt-1 flex gap-2"><span className="h-2.5 w-10 rounded-sm bg-brand-500/70" /><span className="h-2.5 w-10 rounded-sm bg-brand-500/70" /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center bg-white p-7 sm:p-10 md:p-12">
          <div className="mb-8 md:hidden">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-brand-600 text-white"><Boxes className="size-6" /></span>
              <h1 className="text-lg font-bold text-brand-950">Hệ thống quản lý kho</h1>
            </div>
          </div>

          <div className="mb-7 flex flex-col items-center gap-4 text-center">
            <svg role="img" aria-label="Avatar mặc định" viewBox="0 0 80 80" className="size-20 shrink-0 overflow-hidden rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
              <circle cx="40" cy="27" r="14" fill="currentColor" />
              <path d="M8 80V72C8 55 22 44 40 44S72 55 72 72V80Z" fill="currentColor" />
            </svg>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Đăng nhập hệ thống</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-slate-700">Tên đăng nhập<RequiredMark /></label>
              <div className="relative">
                <UserRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/70"
                  placeholder="Nhập tên đăng nhập"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-700">Mật khẩu<RequiredMark /></label>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="login-password-field min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/60 py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/70"
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <label className="flex min-h-6 cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                name="remember_me"
                checked={!!rememberMe}
                onChange={event => setRememberMe(event.target.checked)}
                disabled={submitting}
                className="size-4 shrink-0 rounded border-slate-300 accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              />
              Ghi nhớ đăng nhập
            </label>

            {error ? (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-medium leading-5 text-rose-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-300/70 transition hover:bg-brand-700 hover:shadow-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <span className="size-4 animate-spin rounded-full border-2 border-brand-200 border-t-white" /> : null}
              {submitting ? 'Đang xác thực...' : 'Đăng nhập'}
              {!submitting ? <ArrowRight className="size-4" /> : null}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
            <p>{rememberMe
              ? 'Ghi nhớ đăng nhập tối đa 7 ngày trên trình duyệt này. Không sử dụng trên thiết bị dùng chung.'
              : 'Phiên đăng nhập tự động hết hạn sau 8 giờ. Vui lòng đăng nhập lại để tiếp tục sử dụng.'}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
