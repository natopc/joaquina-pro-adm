import React from 'react';
import { motion } from 'framer-motion';
import { Bike, Users, Search, Calendar } from 'lucide-react';
import { parseDate, CourierMetric } from '../services/dataService';

interface CouriersProps {
  rawEntregas: any[];
  courierSort: { key: 'name' | 'deliveries' | 'time' | 'productivity' | 'avgPerDay', dir: 'asc' | 'desc' };
  setCourierSort: React.Dispatch<React.SetStateAction<{ key: 'name' | 'deliveries' | 'time' | 'productivity' | 'avgPerDay', dir: 'asc' | 'desc' }>>;
  setSelectedCourier: (courier: any) => void;
}

export const Couriers: React.FC<CouriersProps> = ({
  rawEntregas,
  courierSort,
  setCourierSort,
  setSelectedCourier
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

  const couriersData = React.useMemo(() => {
    if (!rawEntregas || rawEntregas.length === 0) return [];

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    // Agrupar entregas por entregador
    const courierGroups: Record<string, any[]> = {};
    rawEntregas.forEach(d => {
      const date = parseDate(d.hora_pedido);
      if (!date || date < start || date > end) return;

      if (!d.entregador) return;
      const rawName = d.entregador.trim();
      const name = rawName.includes('-') ? rawName.substring(rawName.indexOf('-') + 1).trim() : rawName;
      
      if (!courierGroups[name]) courierGroups[name] = [];
      courierGroups[name].push(d);
    });

    return Object.entries(courierGroups).map(([name, deliveries]) => {
      let totalPrepTime = 0;
      let validPrepCount = 0;
      const dailyGroups: Record<string, any[]> = {};

      const mappedRaw = deliveries.map(d => {
        const created = parseDate(d.hora_pedido);
        const accept = parseDate(d.aceito_entregador);
        const finish = parseDate(d.finalizado);

        if (created && accept) {
          const diff = (accept.getTime() - created.getTime()) / (1000 * 60);
          if (diff >= 0 && diff < 300) {
            totalPrepTime += diff;
            validPrepCount++;
          }
        }

        if (accept) {
          const dayKey = accept.toDateString();
          if (!dailyGroups[dayKey]) dailyGroups[dayKey] = [];
          dailyGroups[dayKey].push({ accept, finish });
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
          totalTime: d.tempo_total || '',
          courier: name,
          price: 0,
          dynamicPrice: 0,
          totalPrice: Number(d.valor_total || 0)
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

      return {
        name,
        totalDeliveries: deliveries.length,
        avgDeliveryTime: 0,
        avgPrepTime: validPrepCount > 0 ? totalPrepTime / validPrepCount : 0,
        deliveriesPerHour: totalWorkHours > 0 ? deliveries.length / totalWorkHours : 0,
        earnings: deliveries.reduce((sum, d) => sum + Number(d.valor_total || 0), 0),
        initials: name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        rawDeliveries: mappedRaw,
        workedDays,
        avgDeliveriesPerWorkedDay
      };
    }).filter(c => c.totalDeliveries > 0);
  }, [rawEntregas, startDate, endDate]);

  const filteredCouriers = couriersData.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedCouriers = [...filteredCouriers].sort((a, b) => {
    const dir = courierSort.dir === 'asc' ? 1 : -1;
    if (courierSort.key === 'name') return a.name.localeCompare(b.name) * dir;
    if (courierSort.key === 'deliveries') return (a.totalDeliveries - b.totalDeliveries) * dir;
    if (courierSort.key === 'time') return (a.avgPrepTime - b.avgPrepTime) * dir;
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
            Performance Entregadores
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Acompanhamento das entregas e produtividade por período trabalhado.
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
                      <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{courier.name}</p>
                    </div>
                  </td>
                  <td className="px-8 py-3 text-center font-bold text-slate-700">{courier.totalDeliveries}</td>
                  <td className="px-8 py-3 text-center font-bold text-amber-600">{courier.avgPrepTime.toFixed(0)} min</td>
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
