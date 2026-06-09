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
import { MonthlyStats, parseDate } from '../services/dataService';

const getJoaquinaStats = (vendas: any[], monthNum: number, year: number, maxDay: number) => {
  let revenue = 0;
  let orders = 0;
  const days = new Set<string>();
  vendas.forEach(v => {
    const d = v.Data || v.data;
    const date = parseDate(d);
    if (date && (date.getMonth() + 1) === monthNum && date.getFullYear() === year) {
      if (date.getDate() <= maxDay) {
        revenue += Number((v.ValorFInal !== undefined ? v.ValorFInal : v.valor_final) || 0);
        orders += 1;
        days.add(date.toDateString());
      }
    }
  });
  return { revenue, orders, uniqueDays: days.size || 1 };
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

interface SalesProps {
  currentMonthData: MonthlyStats | undefined;
  storesWithManual: any[];
  totalRevenueWithManual: number;
  totalOrdersWithManual: number;
  currentManualSales: any;
  dbData: MonthlyStats[];
  manualData: Record<string, any>;
  selectedMonth: string;
  selectedYear: number;
  rawVendas?: any[];
  rawMilanesasFaturamento?: any[];
  rawEntregas?: any[];
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
  selectedYear,
  rawVendas = [],
  rawMilanesasFaturamento = [],
  rawEntregas = []
}) => {
  const [selectedChannel, setSelectedChannel] = React.useState<{ store: string; channel: string; dailyStats: { date: string; orders: number; revenue: number }[] } | null>(null);

  const currentJoaquinaRev = storesWithManual?.find(s => s.name === "Joaquina")?.totalRevenue || 0;
  const currentMilanesasRev = storesWithManual?.find(s => s.name === "Joaquina Milanesas")?.totalRevenue || 0;
  const currentTicketMedio = totalOrdersWithManual > 0 ? totalRevenueWithManual / totalOrdersWithManual : 0;
  const currentDays = currentMonthData?.uniqueDays || 30;
  const currentDailyAvg = totalRevenueWithManual / currentDays;

  const joaquinaParticipation = totalRevenueWithManual > 0 ? (currentJoaquinaRev / totalRevenueWithManual) * 100 : 0;
  const milanesasParticipation = totalRevenueWithManual > 0 ? (currentMilanesasRev / totalRevenueWithManual) * 100 : 0;

  const monthMap: Record<string, number> = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4, 'maio': 5, 'junho': 6,
    'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
  };
  
  const currentMonthNum = selectedMonth ? monthMap[selectedMonth.toLowerCase()] : 1;

  // MTD vs PMTD percentage comparison calculations
  const { globalMom, joaquinaMom, milanesasMom, ticketMom, dailyMom } = React.useMemo(() => {
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

    // 2. Selected Month (MTD) Metrics
    const curJoaquina = getJoaquinaStats(rawVendas, currentMonthNum, selectedYear, maxDay);
    const curMilanesas = getMilanesasStats(rawMilanesasFaturamento, currentMonthNum, selectedYear, maxDay);
    
    const curRevenue = curJoaquina.revenue + curMilanesas.revenue;
    const curOrders = curJoaquina.orders + curMilanesas.orders;
    const curTicket = curOrders > 0 ? curRevenue / curOrders : 0;
    const curDailyAvg = curRevenue / curJoaquina.uniqueDays;

    // 3. Prior Month (PMTD) Metrics
    const prevJoaquina = getJoaquinaStats(rawVendas, prevMonthNum, prevYearVal, maxDay);
    const prevMilanesas = getMilanesasStats(rawMilanesasFaturamento, prevMonthNum, prevYearVal, maxDay);
    
    const prevRevenue = prevJoaquina.revenue + prevMilanesas.revenue;
    const prevOrders = prevJoaquina.orders + prevMilanesas.orders;
    const prevTicket = prevOrders > 0 ? prevRevenue / prevOrders : 0;
    const prevDailyAvg = prevRevenue / prevJoaquina.uniqueDays;

    return {
      globalMom: getMoM(curRevenue, prevRevenue),
      joaquinaMom: getMoM(curJoaquina.revenue, prevJoaquina.revenue),
      milanesasMom: getMoM(curMilanesas.revenue, prevMilanesas.revenue),
      ticketMom: getMoM(curTicket, prevTicket),
      dailyMom: getMoM(curDailyAvg, prevDailyAvg)
    };
  }, [selectedMonth, selectedYear, rawVendas, rawMilanesasFaturamento, rawEntregas]);

  const chartData = [...dbData].slice(0, 12).reverse().map(d => {
      // Joaquina Revenue (Automated DB data only)
      const jIfood = d.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'IFOOD')?.revenue || 0;
      const jJotaJa = d.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'JOTA JÁ')?.revenue || 0;
      const jTelefone = d.stores?.find(s => s.name === "Joaquina")?.channels?.find(c => c.name === 'TELEFONE')?.revenue || 0;
      const jReq = jIfood + jJotaJa + jTelefone;
      
      // Milanesas Revenue (Automated DB data only)
      const mReq = d.stores?.find(s => s.name === "Joaquina Milanesas")?.totalRevenue || 0;
      
      const yearShort = String(d.year).slice(-2);
      
      return {
         month: `${d.month.substring(0, 3).toUpperCase()}/${yearShort}`,
         "Joaquina": jReq,
         "Joaquina Milanesas": mReq
      };
  });

  const handleChannelClick = (storeName: string, channelName: string) => {
    const isJoaquina = storeName === 'Joaquina';
    const rawData = isJoaquina ? rawVendas : rawMilanesasFaturamento;

    const dailyGroups: Record<string, { orders: number, revenue: number }> = {};

    rawData.forEach(item => {
      const dateStr = item.Data || item.data || item.data_venda;
      if (!dateStr) return;

      if (isJoaquina) {
        if (channelName !== 'TODOS') {
          const origin = (item.Origem || item.origem || '').toUpperCase();
          let c = 'IFOOD';
          if (origin.includes('IFOOD')) c = 'IFOOD';
          else if (origin.includes('APP - JOTA')) c = 'JOTA JÁ';
          else if (origin.includes('PAINEL - JOTA')) c = 'TELEFONE';
          
          if (c !== channelName) return;
        }
      } else {
        if (channelName !== 'TODOS' && channelName !== 'IFOOD') return;
      }

      let dateObj: Date | null = null;
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const [y, m, d] = dateStr.split(/[ T]/)[0].split('-').map(Number);
        dateObj = new Date(y, m - 1, d, 12, 0, 0);
      } else if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split(/[ T]/)[0].split('/').map(Number);
        if (y < 100) {
          dateObj = new Date(2000 + y, m - 1, d, 12, 0, 0);
        } else {
          dateObj = new Date(y, m - 1, d, 12, 0, 0);
        }
      }

      if (!dateObj || isNaN(dateObj.getTime())) return;

      if ((dateObj.getMonth() + 1) !== currentMonthNum || dateObj.getFullYear() !== selectedYear) return;

      const dayStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      if (!dailyGroups[dayStr]) {
        dailyGroups[dayStr] = { orders: 0, revenue: 0 };
      }

      if (isJoaquina) {
        const statusNome = item.StatusNome || item.status_nome;
        if (!statusNome || statusNome.toLowerCase() !== 'cancelado') {
          dailyGroups[dayStr].orders += 1;
          dailyGroups[dayStr].revenue += Number((item.ValorFInal !== undefined ? item.ValorFInal : item.valor_final) || 0);
        }
      } else {
        dailyGroups[dayStr].orders += Number(item.pedidos || 0);
        dailyGroups[dayStr].revenue += Number(item.faturamento || 0);
      }
    });

    const statsArray = Object.entries(dailyGroups)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => {
        const [dayA] = a.date.split('/').map(Number);
        const [dayB] = b.date.split('/').map(Number);
        return dayA - dayB;
      });

    setSelectedChannel({
      store: storeName,
      channel: channelName,
      dailyStats: statsArray
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard 
          title="Faturamento Total" 
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
          rightLabel={`${joaquinaParticipation.toFixed(1).replace('.', ',')}%`}
        />
        <StatCard 
          title="Milanesas" 
          value={`R$ ${currentMilanesasRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          subValue={`${storesWithManual.find(s => s.name === "Joaquina Milanesas")?.totalOrders || 0} pedidos`}
          change={milanesasMom.text} 
          trend={milanesasMom.trend} 
          icon={ShoppingBag} 
          colorClass="text-orange-500" 
          rightLabel={`${milanesasParticipation.toFixed(1).replace('.', ',')}%`}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Loja Joaquina */}
        {(() => {
          const joaquina = storesWithManual.find(s => s.name === 'Joaquina');
          if (!joaquina) return null;
          return (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                  <div className="flex justify-between items-center">
                    <div onClick={() => handleChannelClick('Joaquina', 'TODOS')} className="cursor-pointer group">
                      <h3 className="text-xl font-black tracking-tight uppercase group-hover:text-primary transition-colors flex items-center gap-2">
                        Joaquina
                        <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Ver dias (Geral)</span>
                      </h3>
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
                        <tr key={channel.name} onClick={() => handleChannelClick('Joaquina', channel.name)} className="hover:bg-slate-100 transition-colors cursor-pointer">
                          <td className="px-8 py-4 font-bold text-slate-700 flex items-center gap-2">
                            {channel.name} <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Ver dias</span>
                          </td>
                          <td className="px-8 py-4 text-center font-medium">{channel.orders}</td>
                          <td className="px-8 py-4 text-center font-bold text-slate-900">R$ {channel.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-8 py-4 text-right font-black text-primary">R$ {channel.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Loja Joaquina Milanesas */}
        {(() => {
          const milanesas = storesWithManual.find(s => s.name === 'Joaquina Milanesas');
          if (!milanesas) return null;
          return (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                  <div className="flex justify-between items-center">
                    <div onClick={() => handleChannelClick('Joaquina Milanesas', 'TODOS')} className="cursor-pointer group">
                      <h3 className="text-xl font-black tracking-tight uppercase group-hover:text-primary transition-colors flex items-center gap-2">
                        Joaquina Milanesas
                        <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Ver dias (Geral)</span>
                      </h3>
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
                        <tr key={channel.name} onClick={() => handleChannelClick('Joaquina Milanesas', channel.name)} className="hover:bg-slate-100 transition-colors cursor-pointer">
                          <td className="px-8 py-4 font-bold text-slate-700 flex items-center gap-2">
                            {channel.name} <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Ver dias</span>
                          </td>
                          <td className="px-8 py-4 text-center font-medium">{channel.orders}</td>
                          <td className="px-8 py-4 text-center font-bold text-slate-900">R$ {channel.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-8 py-4 text-right font-black text-primary">R$ {channel.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
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

      {selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedChannel(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800">{selectedChannel.store} {selectedChannel.channel === 'TODOS' ? '- Total Geral' : `- ${selectedChannel.channel}`}</h3>
                <p className="text-sm font-medium text-slate-500">Vendas por dia em {selectedMonth}/{selectedYear}</p>
              </div>
              <button 
                onClick={() => setSelectedChannel(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {selectedChannel.dailyStats.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium">Nenhum dado encontrado para este mês.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white sticky top-0 shadow-sm text-slate-400 font-bold text-[10px] uppercase tracking-widest z-10">
                    <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4 text-center">Pedidos</th>
                      <th className="px-6 py-4 text-right">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedChannel.dailyStats.map((stat, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">{stat.date}</td>
                        <td className="px-6 py-4 text-center font-medium">{stat.orders}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">R$ {stat.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black">
                    <tr>
                      <td className="px-6 py-4 text-slate-800">TOTAL</td>
                      <td className="px-6 py-4 text-center text-slate-800">
                        {selectedChannel.dailyStats.reduce((sum, s) => sum + s.orders, 0)}
                      </td>
                      <td className="px-6 py-4 text-right text-primary">
                        R$ {selectedChannel.dailyStats.reduce((sum, s) => sum + s.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
