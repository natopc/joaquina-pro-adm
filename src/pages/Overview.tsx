import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Clock, Utensils, ShoppingBag, Users, ListOrdered } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { cn } from '../lib/utils';
import { MonthlyStats } from '../services/dataService';

interface OverviewProps {
  currentMonthData: MonthlyStats | undefined;
  overviewCourierSort: { key: 'name' | 'time' | 'productivity', dir: 'asc' | 'desc' };
  toggleOverviewSort: (key: 'name' | 'time' | 'productivity') => void;
  dashboardCategories: any[];
  activeDashboardCat: string;
  setActiveDashboardCat: (id: string) => void;
  setActiveTab: (tab: any) => void;
  storesWithManual: any[];
  totalRevenueWithManual: number;
  totalOrdersWithManual: number;
  topNeighborhoods: {name: string, sales: number}[];
  lastUpdatedAt?: string;
  dbData: MonthlyStats[];
  manualData: Record<string, any>;
  selectedMonth: string;
  selectedYear: number;
}

export const Overview: React.FC<OverviewProps> = ({
  currentMonthData,
  overviewCourierSort,
  toggleOverviewSort,
  dashboardCategories,
  activeDashboardCat,
  setActiveDashboardCat,
  setActiveTab,
  storesWithManual,
  totalRevenueWithManual,
  totalOrdersWithManual,
  last30DaysCouriers,
  topNeighborhoods,
  lastUpdatedAt,
  dbData,
  manualData,
  selectedMonth,
  selectedYear
}) => {
  const validOverviewCouriers = last30DaysCouriers.filter(c => c.avgPrepTime > 0 && c.deliveriesPerHour > 0);

  const sortedOverviewCouriers = [...validOverviewCouriers].sort((a, b) => {
    const dir = overviewCourierSort.dir === 'asc' ? 1 : -1;
    if (overviewCourierSort.key === 'name') return a.name.localeCompare(b.name) * dir;
    if (overviewCourierSort.key === 'time') return (a.avgPrepTime - b.avgPrepTime) * dir;
    return (a.deliveriesPerHour - b.deliveriesPerHour) * dir;
  }).slice(0, 10);

  const activeCatData = dashboardCategories.find(c => c.id === activeDashboardCat);

  // Delivery Time logic ignores > 120 and < 5 mins
  const calculateGlobalDeliveryTime = () => {
    if (!currentMonthData) return "0 min";
    let totalTime = 0;
    let validCount = 0;
    
    currentMonthData.couriers.forEach(c => {
      c.rawDeliveries.forEach(d => {
        if (d.acceptedAt && d.finishedAt) {
          try {
             // Parse dates correctly based on JS formats
             let accept = new Date(d.acceptedAt);
             if (isNaN(accept.getTime())) {
               // Fallback structure if generic string passed (try to simulate dd/mm/yyyy hh:mm:ss reverse)
               const parts = d.acceptedAt.split(' ');
               if (parts.length === 2 && parts[0].includes('/')) {
                 const [day, month, year] = parts[0].split('/');
                 accept = new Date(`${year}-${month}-${day}T${parts[1]}`);
               }
             }

             let finish = new Date(d.finishedAt);
             if (isNaN(finish.getTime())) {
               const parts = d.finishedAt.split(' ');
               if (parts.length === 2 && parts[0].includes('/')) {
                 const [day, month, year] = parts[0].split('/');
                 finish = new Date(`${year}-${month}-${day}T${parts[1]}`);
               }
             }

             if (!isNaN(accept.getTime()) && !isNaN(finish.getTime())) {
                const diff = (finish.getTime() - accept.getTime()) / (1000 * 60);
                if (diff >= 5 && diff <= 120) {
                  totalTime += diff;
                  validCount++;
                }
             }
          } catch (e) { }
        }
      });
    });

    return validCount > 0 ? `${Math.round(totalTime / validCount)} min` : "0 min";
  };

  const monthMap: Record<string, number> = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };
  const currentMonthIdx = selectedMonth ? monthMap[selectedMonth.toLowerCase()] : -1;
  let prevMonth = selectedMonth;
  let prevYear = selectedYear;
  if (currentMonthIdx === 0) {
     prevMonth = 'Dezembro';
     prevYear = selectedYear - 1;
  } else if (currentMonthIdx > 0) {
     const mbReverse = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
     prevMonth = mbReverse[currentMonthIdx - 1];
  }
  
  const prevMonthData = dbData?.find(d => d.month.toLowerCase() === prevMonth.toLowerCase() && d.year === prevYear);
  const prevManualDataKey = `${prevMonth.toLowerCase()}-${prevYear}`;
  const prevManualData = manualData?.[prevManualDataKey] || {};

  const getMoM = (current: number, prev: number) => {
    if (prev === 0 && current > 0) return { text: "+100%", trend: "up" as const };
    if (prev === 0 && current === 0) return { text: "0.0%", trend: "neutral" as const };
    const pct = ((current - prev) / prev) * 100;
    return { 
      text: `${pct > 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`,
      trend: pct > 0 ? "up" as const : pct < 0 ? "down" as const : "neutral" as const
    };
  };

  const currentMilanesasRev = storesWithManual?.find(s => s.name === "Joaquina Milanesas")?.totalRevenue || 0;
  const currentJoaquinaRev = storesWithManual?.find(s => s.name === "Joaquina")?.totalRevenue || 0;
  
  const prevJoaquinaIfood = prevManualData.joaquinaIfoodRevenue || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'IFOOD')?.revenue || 0;
  const prevJoaquinaJotaJa = prevManualData.joaquinaJotaJaRevenue || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'JOTA JÁ')?.revenue || 0;
  const prevJoaquinaTelefone = prevManualData.joaquinaTelefoneRevenue || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'TELEFONE')?.revenue || 0;
  
  const prevJoaquinaRev = prevJoaquinaIfood + prevJoaquinaJotaJa + prevJoaquinaTelefone;
  const prevMilanesasRev = prevManualData.milanesasRevenue || 0;
  const prevGlobalRev = prevJoaquinaRev + prevMilanesasRev;

  const taxaPrev = prevMonthData?.monthDeliveryFees || 0;

  const globalMom = getMoM(totalRevenueWithManual, prevGlobalRev);
  const joaquinaMom = getMoM(currentJoaquinaRev, prevJoaquinaRev);
  const milanesasMom = getMoM(currentMilanesasRev, prevMilanesasRev);
  const deliveryMom = getMoM(currentMonthData?.avgDeliveryTime || 0, prevMonthData?.avgDeliveryTime || 0);
  const prepMom = getMoM(currentMonthData?.avgPrepTime || 0, prevMonthData?.avgPrepTime || 0);
  const taxaMom = getMoM(currentMonthData?.monthDeliveryFees || 0, taxaPrev);

  const totalBairrosSales = topNeighborhoods.reduce((sum, b) => sum + b.sales, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex justify-start">
         {lastUpdatedAt && (
            <p className="text-xs font-bold text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
               Atualizado em: {new Date(lastUpdatedAt + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard 
          title="Total Global" 
          value={`R$ ${totalRevenueWithManual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          subValue={`${totalOrdersWithManual} pedidos`}
          change={globalMom.text} 
          trend={globalMom.trend} 
          icon={DollarSign} 
          colorClass="text-primary" 
        />
        <StatCard 
          title="Joaquina" 
          value={`R$ ${currentJoaquinaRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          subValue={`${storesWithManual.find(s => s.name === "Joaquina")?.totalOrders || 0} pedidos`}
          change={joaquinaMom.text} 
          trend={joaquinaMom.trend} 
          icon={ShoppingBag} 
          colorClass="text-blue-500" 
        />
         <StatCard 
          title="Milanesas" 
          value={`R$ ${currentMilanesasRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          subValue={`${storesWithManual.find(s => s.name === "Joaquina Milanesas")?.totalOrders || 0} pedidos`}
          change={milanesasMom.text} 
          trend={milanesasMom.trend} 
          icon={ShoppingBag} 
          colorClass="text-orange-500" 
        />
        <StatCard 
          title="Tempo Entrega" 
          value={`${Math.round(currentMonthData?.avgDeliveryTime || 0)} min`} 
          change={deliveryMom.text} 
          trend={deliveryMom.trend} 
          icon={Clock} 
          colorClass="text-green-500" 
        />
        <StatCard 
          title="Tempo Preparo" 
          value={currentMonthData ? `${Math.round(currentMonthData.avgPrepTime)} min` : "0 min"} 
          change={prepMom.text} 
          trend={prepMom.trend} 
          icon={Utensils} 
          colorClass="text-purple-500" 
        />
        <StatCard 
          title="Taxa de Entrega" 
          value={`R$ ${(currentMonthData?.monthDeliveryFees || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          change={taxaMom.text} 
          trend={taxaMom.trend} 
          icon={DollarSign} 
          colorClass="text-blue-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <h3 className="text-lg font-black uppercase tracking-tight">Performance dos Entregadores</h3>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleOverviewSort('name')}>
                    Entregador {overviewCourierSort.key === 'name' && (overviewCourierSort.dir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-center cursor-pointer hover:text-primary transition-colors" onClick={() => toggleOverviewSort('time')}>
                    Tempo Médio {overviewCourierSort.key === 'time' && (overviewCourierSort.dir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:text-primary transition-colors" onClick={() => toggleOverviewSort('productivity')}>
                    Produtividade {overviewCourierSort.key === 'productivity' && (overviewCourierSort.dir === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedOverviewCouriers.map((courier) => (
                  <tr key={courier.name} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-[10px]">
                          {courier.initials}
                        </div>
                        <p className="font-bold">{courier.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-600">{courier.avgPrepTime.toFixed(0)} min</td>
                    <td className="px-6 py-4 text-right font-black text-primary">{courier.deliveriesPerHour.toFixed(1)}/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Bairros */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <h3 className="text-lg font-black uppercase tracking-tight">Top Bairros</h3>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 p-6">
            <div className="space-y-3">
              {topNeighborhoods.slice(0, 10).map((bairro, idx) => {
                const percent = totalBairrosSales > 0 ? (bairro.sales / totalBairrosSales) * 100 : 0;
                const bgWidth = Math.min(percent * 2, 100);
                return (
                  <div key={bairro.name} className="relative overflow-hidden flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/50 transition-colors">
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary/20 to-transparent transition-all duration-500"
                      style={{ width: `${bgWidth}%` }}
                    />
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 w-4">{idx + 1}.</span>
                        <span className="font-bold text-slate-700 text-sm whitespace-nowrap">{bairro.name}</span>
                      </div>
                      
                      <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400/60 z-0">
                        {percent.toFixed(1)}%
                      </span>

                      <span className="text-primary font-black text-sm relative z-10">{bairro.sales}</span>
                    </div>
                  </div>
                );
              })}
              {topNeighborhoods.length === 0 && (
                 <div className="text-center py-6 flex flex-col items-center justify-center">
                    <ListOrdered className="w-6 h-6 mb-2 text-slate-200" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Sem dados</span>
                 </div>
              )}
            </div>
          </div>
        </div>


        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col lg:col-span-3">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <h3 className="text-lg font-black uppercase tracking-tight">Mais Vendidos</h3>
            <Utensils className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-2 divide-x divide-slate-100 h-full min-h-[400px]">
              {/* Joaquina */}
              <div className="flex flex-col h-full bg-white">
                <div className="p-4 border-b border-slate-100 text-center font-black uppercase tracking-tighter text-slate-800 text-sm md:text-base bg-slate-50/30">
                  Joaquina
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-50 flex-1">
                  {dashboardCategories.filter(c => c.storeName === 'Joaquina').slice(0, 2).map(category => {
                    const totalCategorySales = category.items.reduce((sum: number, item: any) => sum + (Number(item.sales) || 0), 0);
                    return (
                    <div key={category.id} className="p-3 flex flex-col">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 text-center tracking-widest px-2">{category.name}</h4>
                      <div className="space-y-2 flex-1">
                        {category.items.slice(0, 5).map((item: any, idx: number) => {
                           const percent = totalCategorySales > 0 ? (Number(item.sales) / totalCategorySales) * 100 : 0;
                           const bgWidth = Math.min(percent * 2, 100);
                           return (
                           <div key={item.name} className="relative overflow-hidden flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50 hover:border-slate-200 transition-colors">
                             <div 
                               className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary/20 to-transparent transition-all duration-500"
                               style={{ width: `${bgWidth}%` }}
                             />
                             <div className="relative z-10 flex justify-between items-center gap-2 w-full">
                                <p className="text-[13px] font-bold text-slate-700 leading-tight">
                                  <span className="text-primary/70 mr-1.5">{idx + 1}.</span>
                                  {item.name}
                                </p>
                                <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400/60 z-0">
                                  {percent.toFixed(1)}%
                                </span>
                                <div className="text-right flex-shrink-0 relative z-10">
                                  <span className="text-xs font-black text-slate-900">{item.sales} <span className="text-slate-400 font-bold uppercase text-[9px]">vnd</span></span>
                                </div>
                             </div>
                           </div>
                           );
                        })}
                        {(!category.items || category.items.length === 0) && (
                          <div className="text-center py-6 flex flex-col items-center">
                            <ListOrdered className="w-6 h-6 mb-2 text-slate-200" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Sem dados</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              {/* Joaquina Milanesas */}
              <div className="flex flex-col h-full bg-white">
                <div className="p-4 border-b border-slate-100 text-center font-black uppercase tracking-tighter text-slate-800 text-sm md:text-base bg-slate-50/30">
                  Joaquina Milanesas
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-50 flex-1">
                  {dashboardCategories.filter(c => c.storeName === 'Joaquina Milanesas').slice(0, 2).map(category => {
                    const totalCategorySales = category.items.reduce((sum: number, item: any) => sum + (Number(item.sales) || 0), 0);
                    return (
                    <div key={category.id} className="p-3 flex flex-col">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 text-center tracking-widest px-2">{category.name}</h4>
                      <div className="space-y-2 flex-1">
                        {category.items.slice(0, 5).map((item: any, idx: number) => {
                           const percent = totalCategorySales > 0 ? (Number(item.sales) / totalCategorySales) * 100 : 0;
                           const bgWidth = Math.min(percent * 2, 100);
                           return (
                           <div key={item.name} className="relative overflow-hidden flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50 hover:border-slate-200 transition-colors">
                             <div 
                               className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary/20 to-transparent transition-all duration-500"
                               style={{ width: `${bgWidth}%` }}
                             />
                             <div className="relative z-10 flex justify-between items-center gap-2 w-full">
                                <p className="text-[13px] font-bold text-slate-700 leading-tight">
                                  <span className="text-primary/70 mr-1.5">{idx + 1}.</span>
                                  {item.name}
                                </p>
                                <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400/60 z-0">
                                  {percent.toFixed(1)}%
                                </span>
                                <div className="text-right flex-shrink-0 relative z-10">
                                  <span className="text-xs font-black text-slate-900">{item.sales} <span className="text-slate-400 font-bold uppercase text-[9px]">vnd</span></span>
                                </div>
                             </div>
                           </div>
                           );
                        })}
                        {(!category.items || category.items.length === 0) && (
                          <div className="text-center py-6 flex flex-col items-center">
                            <ListOrdered className="w-6 h-6 mb-2 text-slate-200" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Sem dados</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
