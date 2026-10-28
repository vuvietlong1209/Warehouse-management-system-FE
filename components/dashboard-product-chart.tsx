'use client';

import Link from 'next/link';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PackageSearch } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export type RankedProduct = { id: number; code: string; name: string; value: number };

export function wrapProductName(name: string, limit = 25) {
  const lines: string[] = [];
  for (const word of name.split(/\s+/).filter(Boolean)) {
    const chunks = Array.from(word).reduce<string[]>((parts, char) => {
      if (!parts.length || parts[parts.length - 1].length >= limit) parts.push(char);
      else parts[parts.length - 1] += char;
      return parts;
    }, []);
    for (const chunk of chunks) {
      const previous = lines.length - 1;
      if (previous >= 0 && lines[previous].length + chunk.length + 1 <= limit) lines[previous] += ` ${chunk}`;
      else lines.push(chunk);
    }
  }
  return lines.length ? lines : [''];
}

function ProductNameTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const name = payload?.value || '', lines = wrapProductName(name);
  return <text x={x - 10} y={y} textAnchor="end" fill="#475569" fontSize={12}>
    <title>{name}</title>{lines.map((line, index) => <tspan key={index} x={x - 10} dy={index === 0 ? -(lines.length - 1) * 7 + 4 : 14}>{line}</tspan>)}
  </text>;
}

const shortAmount = (value: number) => value >= 1e9 ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1e9)} tỷ`
  : value >= 1e6 ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1e6)} tr`
  : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);

export function DashboardProductChart({ title, data, revenue = false }: { title: string; data: RankedProduct[]; revenue?: boolean }) {
  const maxLines = Math.max(1, ...data.map(row => wrapProductName(row.name).length));
  const height = Math.max(280, data.length * Math.max(48, maxLines * 14 + 20) + 30);
  return <section aria-label={title} className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card sm:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <Link href={revenue ? '/reports?report=COGS' : '/reports'} className="text-xs font-medium text-blue-600 hover:underline">Xem báo cáo →</Link>
    </div>
    {!data.length ? <EmptyState title={revenue ? 'Chưa có doanh thu xuất kho' : 'Chưa có dữ liệu xuất kho'} icon={<PackageSearch className="size-5"/>}/>
      : <div role="img" aria-label={`${title}: ${data.map(row => `${row.name}: ${row.value.toLocaleString('vi-VN')} ${revenue ? 'đồng' : 'đơn vị'}`).join('; ')}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={value => revenue ? shortAmount(Number(value)) : Number(value).toLocaleString('vi-VN')} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" width={185} interval={0} tick={<ProductNameTick/>} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} formatter={(value: number) => [`${value.toLocaleString('vi-VN')} ${revenue ? '₫' : 'đơn vị'}`, revenue ? 'Doanh thu' : 'Số lượng xuất']}/>
            <Bar dataKey="value" fill={revenue ? '#059669' : '#2563eb'} radius={[0, 5, 5, 0]} barSize={18}/>
          </BarChart>
        </ResponsiveContainer>
      </div>}
  </section>;
}
