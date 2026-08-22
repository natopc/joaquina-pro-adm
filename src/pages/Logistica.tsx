import React, { useMemo, useState } from 'react';
import { Calendar, Package } from 'lucide-react';
import { parseDate } from '../services/dataService';

interface LogisticaProps {
  rawVendas: any[];
}

export function Logistica({ rawVendas }: LogisticaProps) {
  const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem('logistica_startDate');
    if (saved) return saved;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  });
  
  const [endDate, setEndDate] = useState(() => {
    const saved = localStorage.getItem('logistica_endDate');
    if (saved) return saved;
    return getLocalDateString(new Date());
  });

  React.useEffect(() => {
    localStorage.setItem('logistica_startDate', startDate);
  }, [startDate]);

  React.useEffect(() => {
    localStorage.setItem('logistica_endDate', endDate);
  }, [endDate]);

  // orderedDays: 1=Segunda, 2=Terça, ..., 6=Sábado, 0=Domingo
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];
  const orderedDaysNames = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO'];
  
  const hourRanges = Array.from({ length: 24 }, (_, i) => i);

  const tableData = useMemo(() => {
    if (!rawVendas || rawVendas.length === 0) return { matrix: [], maxAvg: 0 };

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let current = new Date(start);
    while (current <= end) {
      dayCounts[current.getDay() as keyof typeof dayCounts]++;
      current.setDate(current.getDate() + 1);
    }

    const acc: Record<number, Record<number, number>> = {};
    hourRanges.forEach(h => {
      acc[h] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    });

    rawVendas.forEach(v => {
      const date = parseDate(v.Data || v.data);
      if (!date || date < start || date > end) return;
      
      const statusNome = (v.StatusNome || v.status_nome || '').trim().toLowerCase();
      if (statusNome === 'cancelado') return;

      const horaStr = v.Hora || v.hora;
      if (!horaStr) return;
      
      let hour = -1;
      if (typeof horaStr === 'string') {
        const parts = horaStr.split(':');
        if (parts.length > 0) {
          hour = parseInt(parts[0], 10);
        }
      } else if (typeof horaStr === 'number') {
        hour = Math.floor(horaStr * 24);
      }
      
      if (hour >= 0 && hour < 24) {
        const dayOfWeek = date.getDay();
        acc[hour][dayOfWeek]++;
      }
    });

    let maxAvg = 0;
    const matrix = hourRanges.map(h => {
      const rowAvgs: number[] = [];
      orderedDays.forEach(dayIndex => {
        const total = acc[h][dayIndex];
        const count = dayCounts[dayIndex as keyof typeof dayCounts];
        const avg = count > 0 ? total / count : 0;
        if (avg > maxAvg) maxAvg = avg;
        rowAvgs.push(avg);
      });
      return {
        hourLabel: `${String(h).padStart(2, '0')}-${String(h + 1).padStart(2, '0')}`,
        averages: rowAvgs
      };
    });

    const activeMatrix = matrix.filter(row => row.averages.some(avg => avg > 0));

    return { matrix: activeMatrix, maxAvg };
  }, [rawVendas, startDate, endDate]);

  const getHeatmapColor = (value: number, max: number) => {
    if (value === 0 || max === 0) return 'transparent';
    const intensity = Math.max(0.1, value / max);
    return `rgba(234, 88, 12, ${intensity})`; 
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col xl:flex-row gap-6 xl:items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Logística
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Quantidade média de entregas hora a hora, por dia de semana.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <div className="flex items-center px-3 text-slate-400">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer p-1"
            />
            <span className="text-slate-300 font-bold">até</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer p-1 pr-4"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm border-collapse">
            <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="p-4 border-r border-slate-100 text-left">HORA / DIA</th>
                {orderedDaysNames.map(day => (
                  <th key={day} className="p-4 border-r border-slate-100 last:border-r-0">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.matrix.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhum dado encontrado para o período.
                  </td>
                </tr>
              ) : (
                tableData.matrix.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                    <td className="p-4 border-r border-slate-100 font-bold text-slate-500 text-left whitespace-nowrap">
                      {row.hourLabel}
                    </td>
                    {row.averages.map((avg, i) => (
                      <td 
                        key={i} 
                        className={`p-4 border-r border-slate-100 last:border-r-0 font-black transition-colors ${avg > 0 ? 'text-slate-800' : 'text-slate-300'}`}
                        style={{ backgroundColor: getHeatmapColor(avg, tableData.maxAvg) }}
                      >
                        {avg > 0 ? avg.toFixed(1) : '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
