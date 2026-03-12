import React from 'react';
import { motion } from 'framer-motion';
import { Bike, Users, Search } from 'lucide-react';
import { MonthlyStats } from '../services/dataService';

interface CouriersProps {
  currentMonthData: MonthlyStats | undefined;
  courierSort: { key: 'name' | 'deliveries' | 'time' | 'productivity', dir: 'asc' | 'desc' };
  setCourierSort: React.Dispatch<React.SetStateAction<{ key: 'name' | 'deliveries' | 'time' | 'productivity', dir: 'asc' | 'desc' }>>;
  setSelectedCourier: (courier: any) => void;
  last30DaysCouriers: any[];
}

export const Couriers: React.FC<CouriersProps> = ({
  currentMonthData,
  courierSort,
  setCourierSort,
  setSelectedCourier,
  last30DaysCouriers
}) => {
  const validCurrentMonthCouriers = currentMonthData ? currentMonthData.couriers.filter(c => c.avgPrepTime > 0 && c.deliveriesPerHour > 0) : [];
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const filteredCouriers = validCurrentMonthCouriers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedCouriers = [...filteredCouriers].sort((a, b) => {
    const dir = courierSort.dir === 'asc' ? 1 : -1;
    if (courierSort.key === 'name') return a.name.localeCompare(b.name) * dir;
    if (courierSort.key === 'deliveries') return (a.totalDeliveries - b.totalDeliveries) * dir;
    if (courierSort.key === 'time') return (a.avgPrepTime - b.avgPrepTime) * dir;
    return (a.deliveriesPerHour - b.deliveriesPerHour) * dir;
  });

  const [top5Sorts, setTop5Sorts] = React.useState({
    timeDir: 'asc' as 'asc' | 'desc',
    prodDir: 'desc' as 'asc' | 'desc'
  });

  const validLast30DaysCouriers = last30DaysCouriers.filter(c => c.avgPrepTime > 0 && c.deliveriesPerHour > 0);

  const top5Time = [...validLast30DaysCouriers].sort((a, b) => {
    return top5Sorts.timeDir === 'asc' ? a.avgPrepTime - b.avgPrepTime : b.avgPrepTime - a.avgPrepTime;
  }).slice(0, 5);

  const top5Prod = [...validLast30DaysCouriers].sort((a, b) => {
    return top5Sorts.prodDir === 'asc' ? a.deliveriesPerHour - b.deliveriesPerHour : b.deliveriesPerHour - a.deliveriesPerHour;
  }).slice(0, 5);

  const toggleSort = (key: 'name' | 'deliveries' | 'time' | 'productivity') => {
    setCourierSort(prev => ({
      key,
      dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc'
    }));
  };

  const toggleTop5Sort = (type: 'time' | 'prod') => {
    setTop5Sorts(prev => ({
      ...prev,
      [type === 'time' ? 'timeDir' : 'prodDir']: prev[type === 'time' ? 'timeDir' : 'prodDir'] === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">Top 5: Tempo Médio</h3>
              <p className="text-[10px] uppercase font-bold text-slate-400">Últimos 30 dias</p>
            </div>
            <button 
              onClick={() => toggleTop5Sort('time')}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
            >
              Ordernar {top5Sorts.timeDir === 'asc' ? '↓' : '↑'}
            </button>
          </div>
          <div className="p-4 space-y-3">
            {top5Time.map((courier, idx) => (
              <div key={courier.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-orange-100 flex items-center justify-center font-black text-orange-600 text-xs">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-bold text-slate-700">{courier.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{courier.avgPrepTime.toFixed(0)} <span className="text-xs font-bold text-slate-400">min</span></p>
                </div>
              </div>
            ))}
            {top5Time.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Sem dados</p>}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">Top 5: Produtividade</h3>
              <p className="text-[10px] uppercase font-bold text-slate-400">Últimos 30 dias</p>
            </div>
            <button 
              onClick={() => toggleTop5Sort('prod')}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
            >
              Ordernar {top5Sorts.prodDir === 'asc' ? '↓' : '↑'}
            </button>
          </div>
          <div className="p-4 space-y-3">
            {top5Prod.map((courier, idx) => (
              <div key={courier.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-blue-100 flex items-center justify-center font-black text-blue-600 text-xs">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-bold text-slate-700">{courier.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{courier.deliveriesPerHour.toFixed(1)} <span className="text-xs font-bold text-slate-400">ent/h</span></p>
                </div>
              </div>
            ))}
            {top5Prod.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Sem dados</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-bold text-lg uppercase tracking-tight">Ranking de Entregadores</h3>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar entregador..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64 bg-white"
              />
            </div>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('name')}>
                  Entregador {courierSort.key === 'name' && (courierSort.dir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 py-5 text-center cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('deliveries')}>
                  Entregas {courierSort.key === 'deliveries' && (courierSort.dir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 py-5 text-center cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('time')}>
                  Tempo Médio {courierSort.key === 'time' && (courierSort.dir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 py-5 text-right cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('productivity')}>
                  Produtividade (ent/h) {courierSort.key === 'productivity' && (courierSort.dir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedCouriers.map((courier) => (
                <tr 
                  key={courier.name} 
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedCourier(courier)}
                >
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{courier.name}</p>
                      <p className="text-xs text-slate-400 font-medium">Motorizado</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center font-bold text-slate-700">{courier.totalDeliveries}</td>
                  <td className="px-8 py-5 text-center font-bold text-amber-600">{courier.avgPrepTime.toFixed(0)} min</td>
                  <td className="px-8 py-5 text-right font-black text-primary">{courier.deliveriesPerHour.toFixed(1)}</td>
                </tr>
              ))}
              {sortedCouriers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400">
                    <Bike className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">Nenhum dado de entregador para este período</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
