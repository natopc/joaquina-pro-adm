import React from 'react';
import { motion } from 'framer-motion';
import { Bike, Users, Search, Calendar, Utensils, Clock } from 'lucide-react';
import { parseDate, CourierMetric, parseDurationToMinutes, cleanIfoodCourierName } from '../services/dataService';
import { StatCard } from '../components/StatCard';

interface CouriersProps {
  rawEntregas: any[];
  courierSort: { key: 'name' | 'deliveries' | 'time' | 'productivity' | 'avgPerDay', dir: 'asc' | 'desc' };
  setCourierSort: React.Dispatch<React.SetStateAction<{ key: 'name' | 'deliveries' | 'time' | 'productivity' | 'avgPerDay', dir: 'asc' | 'desc' }>>;
  setSelectedCourier: (courier: any) => void;
  onDateRangeChange?: (startDate: string, endDate: string) => void;
  title?: string;
  subtitle?: string;
  isIfood?: boolean;
}

export const Couriers: React.FC<CouriersProps> = ({
  rawEntregas,
  courierSort,
  setCourierSort,
  setSelectedCourier,
  onDateRangeChange,
  title,
  subtitle,
  isIfood = false
}) => {
  const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Padrão: Últimos 30 dias
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  });
  const [endDate, setEndDate] = React.useState(() => {
    return getLocalDateString(new Date());
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    if (onDateRangeChange) {
      onDateRangeChange(startDate, endDate);
    }
  }, [startDate, endDate, onDateRangeChange]);

  // Métricas agregadas do período (exibidas nas abas Entregadores R3 e iFood)
  const periodOverallMetrics = React.useMemo(() => {
    if (!rawEntregas || rawEntregas.length === 0) {
      return {
        avgDeliveryTime: 0,
        validDeliveryCount: 0,
        avgPrepTime: 0,
        validPrepCount: 0
      };
    }

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    let totalDeliveryTime = 0;
    let validDeliveryCount = 0;
    let totalPrepTime = 0;
    let validPrepCount = 0;

    let fallbackDeliveryTime = 0;
    let fallbackDeliveryCount = 0;

    rawEntregas.forEach(d => {
      const date = parseDate(d.hora_pedido || d.aceito_entregador || d.Data || d.data);
      if (!date || date < start || date > end) return;

      // 1. Tempo Médio de Preparo: Entre 'Recebido'/'Criação' e 'Despachado'/'Aceito pelo entregador'
      const recebido = parseDate(d.hora_pedido || d.Recebido || d['Criação'] || d.criacao);
      const despachado = parseDate(d.aceito_entregador || d.Despachado || d['Aceito pelo entregador'] || d.aceito_pelo_entregador);

      if (recebido && despachado) {
        let diffPrep = (despachado.getTime() - recebido.getTime()) / (1000 * 60);
        if (diffPrep < 0) diffPrep += 24 * 60;
        if (diffPrep >= 0 && diffPrep < 360) {
          totalPrepTime += diffPrep;
          validPrepCount++;
        }
      }

      // 2. Tempo Médio de Entrega:
      if (isIfood) {
        // Aba iFood: Finalizado - Despachado
        const finalizado = parseDate(d.finalizado || d.Finalizado);
        if (despachado && finalizado) {
          let diffDeliv = (finalizado.getTime() - despachado.getTime()) / (1000 * 60);
          if (diffDeliv < 0) diffDeliv += 24 * 60;
          if (diffDeliv >= 0 && diffDeliv < 360) {
            const cleanCourierName = cleanIfoodCourierName(d.entregador);
            const hasCourier = Boolean(cleanCourierName);
            if (hasCourier) {
              totalDeliveryTime += diffDeliv;
              validDeliveryCount++;
            }
            fallbackDeliveryTime += diffDeliv;
            fallbackDeliveryCount++;
          }
        }
      } else {
        // Aba R3: Apenas a coluna "Tempo total da entrega" (tempo na rua do motoboy)
        const rawTotal = d.tempo_total ?? 
          d['Tempo total da entrega'] ?? 
          d['Tempo Total da Entrega'] ?? 
          d.tempo_total_da_entrega ?? 
          d['Tempo Total'] ?? 
          d['Tempo total'];
        const parsedMinutes = parseDurationToMinutes(rawTotal);
        if (parsedMinutes !== null && parsedMinutes >= 0 && parsedMinutes < 600) {
          const hasCourier = Boolean(d.entregador && String(d.entregador).trim());
          if (hasCourier) {
            totalDeliveryTime += parsedMinutes;
            validDeliveryCount++;
          }
          fallbackDeliveryTime += parsedMinutes;
          fallbackDeliveryCount++;
        }
      }
    });

    const finalDeliveryTime = validDeliveryCount > 0 ? totalDeliveryTime : fallbackDeliveryTime;
    const finalDeliveryCount = validDeliveryCount > 0 ? validDeliveryCount : fallbackDeliveryCount;

    return {
      avgDeliveryTime: finalDeliveryCount > 0 ? finalDeliveryTime / finalDeliveryCount : 0,
      validDeliveryCount: finalDeliveryCount,
      avgPrepTime: validPrepCount > 0 ? totalPrepTime / validPrepCount : 0,
      validPrepCount
    };
  }, [isIfood, rawEntregas, startDate, endDate]);

  const couriersData = React.useMemo(() => {
    if (!rawEntregas || rawEntregas.length === 0) return [];

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    // Agrupar entregas por entregador
    const courierGroups: Record<string, any[]> = {};
    rawEntregas.forEach(d => {
      const date = parseDate(d.hora_pedido || d.aceito_entregador || d.Data || d.data);
      if (!date || date < start || date > end) return;

      if (!d.entregador) return;
      let name = d.entregador.trim();
      if (isIfood || /entregador|ifood/i.test(name)) {
        name = cleanIfoodCourierName(name);
      } else {
        name = name.includes('-') ? name.substring(name.indexOf('-') + 1).trim() : name;
      }
      
      if (!name) return;
      if (!courierGroups[name]) courierGroups[name] = [];
      courierGroups[name].push(d);
    });

    return Object.entries(courierGroups).map(([name, deliveries]) => {
      let totalStreetTime = 0;
      let validStreetCount = 0;
      let totalPrepTime = 0;
      let validPrepCount = 0;
      const dailyGroups: Record<string, any[]> = {};

      const mappedRaw = deliveries.map(d => {
        const created = parseDate(d.hora_pedido);
        const accept = parseDate(d.aceito_entregador);
        const finish = parseDate(d.finalizado);

        if (isIfood) {
          // Aba IFood: Tempo na rua = Finalizado - Despachado (accept)
          if (accept && finish) {
            let diff = (finish.getTime() - accept.getTime()) / (1000 * 60);
            if (diff < 0) diff += 24 * 60;
            if (diff >= 0 && diff < 300) {
              totalStreetTime += diff;
              validStreetCount++;
            }
          }
        } else {
          // Apenas na aba entregadores R3:
          // A tabela que faz upload já tem a coluna (Tempo total da entrega) que é exatamente o cálculo do tempo
          // que o motoboy demora na rua e é em cima dela que deve-se calcular o tempo médio.
          const rawTotal = d.tempo_total ?? 
            d['Tempo total da entrega'] ?? 
            d['Tempo Total da Entrega'] ?? 
            d.tempo_total_da_entrega ?? 
            d['Tempo Total'] ?? 
            d['Tempo total'];
          const parsedMinutes = parseDurationToMinutes(rawTotal);
          if (parsedMinutes !== null && parsedMinutes >= 0 && parsedMinutes < 600) {
            totalStreetTime += parsedMinutes;
            validStreetCount++;
          }
        }

        if (created && accept) {
          let diff = (accept.getTime() - created.getTime()) / (1000 * 60);
          if (diff < 0) diff += 24 * 60;
          if (diff >= 0 && diff < 300) {
            totalPrepTime += diff;
            validPrepCount++;
          }
        }

        const refDate = accept || created;
        if (refDate) {
          const dayKey = refDate.toDateString();
          if (!dailyGroups[dayKey]) dailyGroups[dayKey] = [];
          dailyGroups[dayKey].push({ accept: refDate, finish });
        }

        return {
          orderId: d.pedido,
          requester: '',
          created: d.hora_pedido,
          customer: d.cliente || d.cliente_novo || '',
          destination: d.destino || '',
          distance: parseFloat(d.distancia) || 0,
          status: d.finalizado ? 'Finalizado' : 'Em Andamento',
          acceptedAt: d.aceito_entregador,
          finishedAt: d.finalizado,
          totalTime: d.tempo_total || d['Tempo total da entrega'] || '',
          courier: name,
          price: 0,
          dynamicPrice: 0,
          totalPrice: Number(d.valor_total || 0),
          origem: d.origem || (isIfood ? 'IFood' : 'R3')
        };
      });

      let totalWorkHours = 0;
      Object.values(dailyGroups).forEach(dayTimes => {
        const times = dayTimes.filter(t => t.accept && t.finish);
        if (times.length > 0) {
          const firstAccept = Math.min(...times.map(t => t.accept!.getTime()));
          const lastFinish = Math.max(...times.map(t => t.finish!.getTime()));
          const hours = (lastFinish - firstAccept) / (1000 * 60 * 60);
          totalWorkHours += hours > 0.1 ? hours : 0.5;
        }
      });

      const workedDays = Object.keys(dailyGroups).length;
      const avgDeliveriesPerWorkedDay = workedDays > 0 ? deliveries.length / workedDays : 0;
      const avgDeliveryTime = validStreetCount > 0 ? totalStreetTime / validStreetCount : 0;

      return {
        name,
        totalDeliveries: deliveries.length,
        avgDeliveryTime,
        avgPrepTime: validPrepCount > 0 ? totalPrepTime / validPrepCount : 0,
        deliveriesPerHour: totalWorkHours > 0 ? deliveries.length / totalWorkHours : 0,
        earnings: deliveries.reduce((sum, d) => sum + Number(d.valor_total || 0), 0),
        initials: name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        rawDeliveries: mappedRaw,
        workedDays,
        avgDeliveriesPerWorkedDay
      };
    }).filter(c => c.totalDeliveries > 0);
  }, [rawEntregas, startDate, endDate, isIfood]);

  const filteredCouriers = couriersData.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedCouriers = [...filteredCouriers].sort((a, b) => {
    const dir = courierSort.dir === 'asc' ? 1 : -1;
    if (courierSort.key === 'name') return a.name.localeCompare(b.name) * dir;
    if (courierSort.key === 'deliveries') return (a.totalDeliveries - b.totalDeliveries) * dir;
    if (courierSort.key === 'time') return (a.avgDeliveryTime - b.avgDeliveryTime) * dir;
    if (courierSort.key === 'productivity') return (a.deliveriesPerHour - b.deliveriesPerHour) * dir;
    if (courierSort.key === 'avgPerDay') return (a.avgDeliveriesPerWorkedDay - b.avgDeliveriesPerWorkedDay) * dir;
    return 0;
  });

  const toggleSort = (key: 'name' | 'deliveries' | 'time' | 'productivity' | 'avgPerDay') => {
    setCourierSort(prev => ({
      key,
      dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc'
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col xl:flex-row gap-6 xl:items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Bike className="w-5 h-5 text-primary" />
            {title || 'Performance Entregadores'}
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {subtitle || 'Acompanhamento das entregas e produtividade por período trabalhado.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
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

      {/* Cards de Métricas Gerais do Período (Exibidos nas abas R3 e iFood) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Tempo Médio de Entrega"
          value={`${periodOverallMetrics.avgDeliveryTime.toFixed(0)} min`}
          subValue={`${periodOverallMetrics.validDeliveryCount} ${periodOverallMetrics.validDeliveryCount === 1 ? 'entrega de motoboy' : 'entregas de motoboys'}`}
          icon={Bike}
          colorClass="text-amber-500"
          rightLabel={isIfood ? "iFood • Período" : "R3 • Período"}
        >
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>
              {isIfood 
                ? 'Média de todas as entregas dos motoboys no período filtrado' 
                : 'Média de todas as entregas dos motoboys no período filtrado'}
            </span>
            <span className="font-bold text-slate-700">
              {isIfood ? 'Despachado → Finalizado' : 'Tempo total da entrega'}
            </span>
          </div>
        </StatCard>

        <StatCard
          title="Tempo Médio de Preparo"
          value={`${periodOverallMetrics.avgPrepTime.toFixed(0)} min`}
          subValue={`${periodOverallMetrics.validPrepCount} ${periodOverallMetrics.validPrepCount === 1 ? 'pedido despachado' : 'pedidos despachados'}`}
          icon={Utensils}
          colorClass="text-purple-600"
          rightLabel="Cozinha / Loja"
        >
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>
              {isIfood 
                ? 'Tempo entre pedido realizado e saída para entrega' 
                : 'Tempo entre criação do pedido e aceite pelo entregador'}
            </span>
            <span className="font-bold text-slate-700">
              {isIfood ? 'Recebido → Despachado' : 'Criação → Aceito pelo entregador'}
            </span>
          </div>
        </StatCard>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-bold text-lg uppercase tracking-tight">Ranking de Entregadores</h3>
          <div className="flex items-center gap-4">
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
                <th className="px-8 py-5 text-center cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('avgPerDay')}>
                  Média por Dia Trabalhado {courierSort.key === 'avgPerDay' && (courierSort.dir === 'asc' ? '↑' : '↓')}
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
                  <td className="px-8 py-3">
                    <div className="flex flex-col">
                      <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                        {isIfood || /entregador|ifood/i.test(courier.name) ? cleanIfoodCourierName(courier.name) : courier.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-3 text-center font-bold text-slate-700">{courier.totalDeliveries}</td>
                  <td className="px-8 py-3 text-center font-bold text-amber-600">{courier.avgDeliveryTime.toFixed(0)} min</td>
                  <td className="px-8 py-3 text-center font-bold text-slate-700">
                    {courier.avgDeliveriesPerWorkedDay.toFixed(1)}
                    <span className="text-[10px] text-slate-400 font-medium block">
                      ({courier.workedDays} {courier.workedDays === 1 ? 'dia' : 'dias'} trab.)
                    </span>
                  </td>
                  <td className="px-8 py-3 text-right font-black text-primary">{courier.deliveriesPerHour.toFixed(1)}</td>
                </tr>
              ))}
              {sortedCouriers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400">
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

