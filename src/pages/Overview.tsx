import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Clock, Utensils, ShoppingBag, Users, ListOrdered } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { cn } from '../lib/utils';
import { MonthlyStats, parseDate } from '../services/dataService';

const getJoaquinaStats = (vendas: any[], monthNum: number, year: number, maxDay: number) => {
  let revenue = 0;
  let orders = 0;
  vendas.forEach(v => {
    const d = v.Data || v.data;
    const date = parseDate(d);
    if (date && (date.getMonth() + 1) === monthNum && date.getFullYear() === year) {
      if (date.getDate() <= maxDay) {
        revenue += Number((v.ValorFInal !== undefined ? v.ValorFInal : v.valor_final) || 0);
        orders += 1;
      }
    }
  });
  return { revenue, orders };
};

const getMilanesasStats = (milanesas: any[], monthNum: number, year: number, maxDay: number) => {
  let revenue = 0;
  let orders = 0;
  milanesas.forEach(f => {
    const d = f.data;
    const date = parseDate(d);
    if (date && (date.getMonth() + 1) === monthNum && date.getFullYear() === year) {
      if (date.getDate() <= maxDay) {
        revenue += Number(f.faturamento || 0);
        orders += Number(f.pedidos || 0);
      }
    }
  });
  return { revenue, orders };
};

const getDeliveryFees = (vendas: any[], monthNum: number, year: number, maxDay: number) => {
  let fees = 0;
  vendas.forEach(v => {
    const d = v.Data || v.data;
    const date = parseDate(d);
    if (date && (date.getMonth() + 1) === monthNum && date.getFullYear() === year) {
      if (date.getDate() <= maxDay) {
        const statusNome = v.StatusNome || v.status_nome;
        if (!statusNome || statusNome.toLowerCase() !== 'cancelado') {
          const taxaEntrega = v.TaxaEntrega !== undefined ? v.TaxaEntrega : v.taxa_entrega;
          const taxaRaw = typeof taxaEntrega === 'string' ? taxaEntrega.replace(',', '.') : (taxaEntrega || 0);
          const taxa = Number(taxaRaw);
          if (!isNaN(taxa) && taxa > 0) {
            if (taxa.toFixed(2).endsWith('.90')) {
              fees += taxa;
            }
          }
        }
      }
    }
  });
  return fees;
};

const getTimeMetrics = (entregas: any[], monthNum: number, year: number, maxDay: number) => {
  let totalPrepTime = 0;
  let validPrepCount = 0;
  let totalDeliveryTime = 0;
  let validDeliveryCount = 0;

  entregas.forEach(e => {
    const created = parseDate(e.hora_pedido);
    if (created && (created.getMonth() + 1) === monthNum && created.getFullYear() === year) {
      if (created.getDate() <= maxDay) {
        const accept = parseDate(e.aceito_entregador);
        const finish = parseDate(e.finalizado);

        // Prep Time: created to accept
        if (accept && !isNaN(accept.getTime()) && !isNaN(created.getTime())) {
          const diffPrep = (accept.getTime() - created.getTime()) / (1000 * 60);
          if (diffPrep >= 0 && diffPrep < 300) {
            totalPrepTime += diffPrep;
            validPrepCount++;
          }
        }

        // Delivery Time: accept to finish
        if (accept && finish && !isNaN(accept.getTime()) && !isNaN(finish.getTime())) {
          const diffDeliv = (finish.getTime() - accept.getTime()) / (1000 * 60);
          if (diffDeliv >= 5 && diffDeliv <= 120) {
            totalDeliveryTime += diffDeliv;
            validDeliveryCount++;
          }
        }
      }
    }
  });

  return {
    avgPrepTime: validPrepCount > 0 ? totalPrepTime / validPrepCount : 0,
    avgDeliveryTime: validDeliveryCount > 0 ? totalDeliveryTime / validDeliveryCount : 0
  };
};

const getMoM = (current: number, prev: number) => {
  if (prev === 0 && current > 0) return { text: "+100%", trend: "up" as const };
  if (prev === 0 && current === 0) return { text: "0,0%", trend: "neutral" as const };
  const pct = ((current - prev) / prev) * 100;
  if (isNaN(pct) || !isFinite(pct)) return { text: "0,0%", trend: "neutral" as const };
  return { 
    text: `${pct > 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`,
    trend: pct > 0 ? "up" as const : pct < 0 ? "down" as const : "neutral" as const
  };
};

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
  last30DaysCouriers: any[];
  topNeighborhoods: {name: string, sales: number}[];
  lastUpdatedAt?: string;
  dbData: MonthlyStats[];
  manualData: Record<string, any>;
  selectedMonth: string;
  selectedYear: number;
  rawVendas: any[];
  rawEntregas: any[];
  rawMilanesasFaturamento: any[];
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
  selectedYear,
  rawVendas,
  rawEntregas,
  rawMilanesasFaturamento
}) => {
  const validOverviewCouriers = last30DaysCouriers.filter(c => c.avgPrepTime > 0 && c.deliveriesPerHour > 0);

  const sortedOverviewCouriers = [...validOverviewCouriers].sort((a, b) => {
    const dir = overviewCourierSort.dir === 'asc' ? 1 : -1;
    if (overviewCourierSort.key === 'name') return a.name.localeCompare(b.name) * dir;
    if (overviewCourierSort.key === 'time') return (a.avgPrepTime - b.avgPrepTime) * dir;
    return (a.deliveriesPerHour - b.deliveriesPerHour) * dir;
  }).slice(0, 10);

  const activeCatData = dashboardCategories.find(c => c.id === activeDashboardCat);

  // MTD vs PMTD comparison calculations
  const { globalMom, deliveryMom, prepMom, taxaMom } = React.useMemo(() => {
    const monthMap: Record<string, number> = {
      'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4, 'maio': 5, 'junho': 6,
      'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
    };
    
    const currentMonthNum = selectedMonth ? monthMap[selectedMonth.toLowerCase()] : 1;
    let prevMonthNum = currentMonthNum - 1;
    let prevYearVal = selectedYear;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYearVal = selectedYear - 1;
    }

    // 1. Find maxDay of uploaded data in selected month/year
    let maxDay = 0;
    rawVendas.forEach(v => {
      const d = v.Data || v.data;
      const date = parseDate(d);
      if (date && (date.getMonth() + 1) === currentMonthNum && date.getFullYear() === selectedYear) {
        if (date.getDate() > maxDay) maxDay = date.getDate();
      }
    });

    rawMilanesasFaturamento.forEach(m => {
      const d = m.data;
      const date = parseDate(d);
      if (date && (date.getMonth() + 1) === currentMonthNum && date.getFullYear() === selectedYear) {
        if (date.getDate() > maxDay) maxDay = date.getDate();
      }
    });

    rawEntregas.forEach(e => {
      const d = e.hora_pedido;
      const date = parseDate(d);
      if (date && (date.getMonth() + 1) === currentMonthNum && date.getFullYear() === selectedYear) {
        if (date.getDate() > maxDay) maxDay = date.getDate();
      }
    });

    if (maxDay === 0) {
      maxDay = new Date(selectedYear, currentMonthNum, 0).getDate();
    }

    // 2. Metrics for selected month MTD
    const curJoaquina = getJoaquinaStats(rawVendas, currentMonthNum, selectedYear, maxDay);
    const curMilanesas = getMilanesasStats(rawMilanesasFaturamento, currentMonthNum, selectedYear, maxDay);
    const curTotalRevenue = curJoaquina.revenue + curMilanesas.revenue;

    const curTime = getTimeMetrics(rawEntregas, currentMonthNum, selectedYear, maxDay);
    const curTaxa = getDeliveryFees(rawVendas, currentMonthNum, selectedYear, maxDay);

    // 3. Metrics for prior month PMTD
    const prevJoaquina = getJoaquinaStats(rawVendas, prevMonthNum, prevYearVal, maxDay);
    const prevMilanesas = getMilanesasStats(rawMilanesasFaturamento, prevMonthNum, prevYearVal, maxDay);
    const prevTotalRevenue = prevJoaquina.revenue + prevMilanesas.revenue;

    const prevTime = getTimeMetrics(rawEntregas, prevMonthNum, prevYearVal, maxDay);
    const prevTaxa = getDeliveryFees(rawVendas, prevMonthNum, prevYearVal, maxDay);

    return {
      globalMom: getMoM(curTotalRevenue, prevTotalRevenue),
      deliveryMom: getMoM(curTime.avgDeliveryTime, prevTime.avgDeliveryTime),
      prepMom: getMoM(curTime.avgPrepTime, prevTime.avgPrepTime),
      taxaMom: getMoM(curTaxa, prevTaxa)
    };
  }, [selectedMonth, selectedYear, rawVendas, rawEntregas, rawMilanesasFaturamento]);

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
               Atualizado em: {(() => {
                 const parts = lastUpdatedAt.split('-');
                 return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : lastUpdatedAt;
               })()}
            </p>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Tempo Entrega" 
          value={`${Math.round(currentMonthData?.avgDeliveryTime || 0)} min`} 
          change={deliveryMom.text} 
          trend={deliveryMom.trend} 
          icon={Clock} 
          colorClass="text-green-500" 
          inverseTrendColors={true}
        />
        <StatCard 
          title="Tempo Preparo" 
          value={currentMonthData ? `${Math.round(currentMonthData.avgPrepTime)} min` : "0 min"} 
          change={prepMom.text} 
          trend={prepMom.trend} 
          icon={Utensils} 
          colorClass="text-purple-500" 
          inverseTrendColors={true}
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
