import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { MonthlyStats } from '../services/dataService';

interface SalesProps {
  currentMonthData: MonthlyStats | undefined;
  storesWithManual: any[];
  totalRevenueWithManual: number;
  totalOrdersWithManual: number;
  dbData: MonthlyStats[];
  manualData: Record<string, any>;
  selectedMonth: string;
  selectedYear: number;
}

export const Sales: React.FC<SalesProps> = ({
  currentMonthData,
  storesWithManual,
  totalRevenueWithManual,
  totalOrdersWithManual,
  currentManualSales,
  dbData,
  manualData,
  selectedMonth,
  selectedYear
}) => {
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

  const prevJoaquinaIfood = prevManualData.joaquinaIfoodRevenue || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'IFOOD')?.revenue || 0;
  const prevJoaquinaJotaJa = prevManualData.joaquinaJotaJaRevenue || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'JOTA JÁ')?.revenue || 0;
  const prevJoaquinaTelefone = prevManualData.joaquinaTelefoneRevenue || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'TELEFONE')?.revenue || 0;
  
  const prevJoaquinaRev = prevJoaquinaIfood + prevJoaquinaJotaJa + prevJoaquinaTelefone;
  const prevMilanesasRev = prevManualData.milanesasRevenue || 0;
  
  const prevGlobalRev = prevJoaquinaRev + prevMilanesasRev;
  
  const prevJoaquinaIfoodOrders = prevManualData.joaquinaIfoodOrders || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'IFOOD')?.orders || 0;
  const prevJoaquinaJotaJaOrders = prevManualData.joaquinaJotaJaOrders || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'JOTA JÁ')?.orders || 0;
  const prevJoaquinaTelefoneOrders = prevManualData.joaquinaTelefoneOrders || prevMonthData?.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'TELEFONE')?.orders || 0;
  const prevMilanesasOrders = prevManualData.milanesasOrders || 0;
  
  const prevGlobalOrders = prevJoaquinaIfoodOrders + prevJoaquinaJotaJaOrders + prevJoaquinaTelefoneOrders + prevMilanesasOrders;
  
  const prevTicketMedio = prevGlobalOrders > 0 ? prevGlobalRev / prevGlobalOrders : 0;
  const currentTicketMedio = totalOrdersWithManual > 0 ? totalRevenueWithManual / totalOrdersWithManual : 0;

  const currentDays = currentMonthData?.uniqueDays || 30; // exact
  const currentDailyAvg = totalRevenueWithManual / currentDays;
  const prevDays = prevMonthData?.uniqueDays || 30;
  const prevDailyAvg = prevGlobalRev / prevDays;

  const globalMom = getMoM(totalRevenueWithManual, prevGlobalRev);
  const ordersMom = getMoM(totalOrdersWithManual, prevGlobalOrders);
  const ticketMom = getMoM(currentTicketMedio, prevTicketMedio);
  const dailyMom = getMoM(currentDailyAvg, prevDailyAvg);

  const chartData = [...dbData].reverse().map(d => {
      const monthManual = manualData[`${d.month.toLowerCase()}-${d.year}`] || {};
      
      // Joaquina Revenue (Manual canals + automated DB data)
      const jIfood = monthManual.joaquinaIfoodRevenue || d.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'IFOOD')?.revenue || 0;
      const jJotaJa = monthManual.joaquinaJotaJaRevenue || d.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'JOTA JÁ')?.revenue || 0;
      const jTelefone = monthManual.joaquinaTelefoneRevenue || d.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'TELEFONE')?.revenue || 0;
      const jReq = jIfood + jJotaJa + jTelefone;
      
      // Milanesas Revenue (Prioritize automated DB table, fallback to legacy manual if no DB data)
      const automatedMilRev = d.stores?.find(s => s.name === "Joaquina Milanesas")?.totalRevenue || 0;
      const mReq = automatedMilRev > 0 ? automatedMilRev : (monthManual.milanesasRevenue || 0);
      
      return {
         month: d.month.substring(0, 3).toUpperCase(),
         "Joaquina": jReq,
         "Joaquina Milanesas": mReq
      };
  });
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Faturamento Total" 
          value={`R$ ${totalRevenueWithManual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          change={globalMom.text} 
          trend={globalMom.trend} 
          icon={DollarSign} 
          colorClass="text-primary" 
        />
        <StatCard 
          title="Total de Pedidos" 
          value={totalOrdersWithManual.toString()} 
          change={ordersMom.text} 
          trend={ordersMom.trend} 
          icon={ShoppingBag} 
          colorClass="text-blue-500" 
        />
        <StatCard 
          title="Ticket Médio Geral" 
          value={`R$ ${currentTicketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          change={ticketMom.text} 
          trend={ticketMom.trend} 
          icon={TrendingUp} 
          colorClass="text-amber-500" 
        />
        <StatCard 
          title="Venda Média Diária" 
          value={`R$ ${currentDailyAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          subValue={`${(totalOrdersWithManual / currentDays).toFixed(1)} pedidos/dia`}
          change={dailyMom.text} 
          trend={dailyMom.trend} 
          icon={Users} 
          colorClass="text-purple-500" 
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black tracking-tight uppercase">Repediu (Marketing)</h3>
              <p className="text-sm text-slate-500 font-medium">Dados de campanhas de marketing</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary">R$ {currentManualSales.repediuRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{currentManualSales.repediuOrders} pedidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loja Joaquina */}
      {(() => {
        const joaquina = storesWithManual.find(s => s.name === 'Joaquina');
        if (!joaquina) return null;
        return (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase">Joaquina</h3>
                  <p className="text-sm text-slate-500 font-medium">Detalhamento por canal de venda</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">R$ {joaquina.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{joaquina.totalOrders} pedidos</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-4">Canal</th>
                    <th className="px-8 py-4 text-center">Pedidos</th>
                    <th className="px-8 py-4 text-center">Faturamento</th>
                    <th className="px-8 py-4 text-right">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {joaquina.channels.map((channel: any) => (
                    <tr key={channel.name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 font-bold text-slate-700">{channel.name}</td>
                      <td className="px-8 py-4 text-center font-medium">{channel.orders}</td>
                      <td className="px-8 py-4 text-center font-bold text-slate-900">R$ {channel.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-8 py-4 text-right font-black text-primary">R$ {channel.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Loja Joaquina Milanesas */}
      {(() => {
        const milanesas = storesWithManual.find(s => s.name === 'Joaquina Milanesas');
        if (!milanesas) return null;
        return (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase">Joaquina Milanesas</h3>
                  <p className="text-sm text-slate-500 font-medium">Pedidos via plataforma (iFood exclusive)</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">R$ {milanesas.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{milanesas.totalOrders} pedidos</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-4">Canal</th>
                    <th className="px-8 py-4 text-center">Pedidos</th>
                    <th className="px-8 py-4 text-center">Faturamento</th>
                    <th className="px-8 py-4 text-right">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {milanesas.channels.filter((c: any) => c.name === 'IFOOD').map((channel: any) => (
                    <tr key={channel.name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 font-bold text-slate-700">{channel.name}</td>
                      <td className="px-8 py-4 text-center font-medium">{channel.orders}</td>
                      <td className="px-8 py-4 text-center font-bold text-slate-900">R$ {channel.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-8 py-4 text-right font-black text-primary">R$ {channel.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h4 className="text-lg font-bold">Faturamento Mensal</h4>
            <p className="text-sm text-slate-500">Histórico de receita por mês</p>
          </div>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }} 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, name]}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} />
              <Bar dataKey="Joaquina" name="Joaquina" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} barSize={40} />
              <Bar dataKey="Joaquina Milanesas" name="Joaquina Milanesas" stackId="a" fill="#ea580c" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};
