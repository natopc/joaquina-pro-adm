import React from 'react';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change: string;
  trend: 'up' | 'down';
  icon: LucideIcon;
  colorClass: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, change, trend, icon: Icon, colorClass }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-2 rounded-xl bg-slate-50", colorClass)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={cn(
        "text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1",
        trend === 'up' ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
      )}>
        {change}
        {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      </span>
    </div>
    <p className="text-slate-500 text-sm font-medium">{title}</p>
    <div className="flex items-baseline gap-2 mt-1">
      <h3 className="text-2xl font-extrabold">{value}</h3>
      {subValue && <span className="text-xs text-slate-400 font-bold">{subValue}</span>}
    </div>
  </div>
);
