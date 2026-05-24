import React from 'react';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  colorClass: string;
  rightLabel?: string;
  inverseTrendColors?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subValue, 
  change, 
  trend, 
  icon: Icon, 
  colorClass, 
  rightLabel,
  inverseTrendColors = false
}) => {
  // Determine color based on trend and whether colors are inverted
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  
  let textClass = "text-slate-600 bg-slate-50";
  if (isUp) {
    textClass = inverseTrendColors ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50";
  } else if (isDown) {
    textClass = inverseTrendColors ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50";
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-2 rounded-xl bg-slate-50", colorClass)}>
            <Icon className="w-5 h-5" />
          </div>
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1",
            textClass
          )}>
            {change}
            {isUp && <ArrowUpRight className="w-3 h-3" />}
            {isDown && <ArrowDownRight className="w-3 h-3" />}
          </span>
        </div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
      </div>
      <div className="flex justify-between items-end mt-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-extrabold">{value}</h3>
          {subValue && <span className="text-xs text-slate-400 font-bold">{subValue}</span>}
        </div>
        {rightLabel && (
          <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg shrink-0">
            {rightLabel}
          </span>
        )}
      </div>
    </div>
  );
};
