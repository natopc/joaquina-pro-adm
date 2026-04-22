import React, { useMemo, useState } from 'react';
import { Calendar, Filter, Star, MapPin, Store } from 'lucide-react';
import { parseDate } from '../services/dataService';

interface CustomersProps {
  rawVendas: any[];
}

interface CustomerData {
  nome: string;
  endereco: string;
  pedidos: number;
  origens: Record<string, number>;
  origemPrincipal: string;
}

export function Customers({ rawVendas }: CustomersProps) {
  // Padrão: Últimos 30 dias
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [limit, setLimit] = useState(15);

  const topCustomers = useMemo(() => {
    if (!rawVendas || rawVendas.length === 0) return [];

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const customersMap = new Map<string, CustomerData>();

    rawVendas.forEach(v => {
      const date = parseDate(v.Data || v.data);
      if (!date || date < start || date > end) return;

      const rawNome = (v.Cliente || v.cliente || '').trim();
      const statusNome = (v.StatusNome || v.status_nome || '').trim().toLowerCase();
      
      // Ignorar cancelados
      if (statusNome === 'cancelado') return;

      // Se não tem nome, ignorar
      if (!rawNome) return;

      const logradouro = (v.Logradouro || v.logradouro || '').trim();
      const numero = (v.NumeroEntrega || v.numero_entrega || '').trim();
      const endereco = `${logradouro}${numero ? `, ${numero}` : ''}`.trim() || 'Endereço não informado';

      const originRaw = (v.Origem || v.origem || '').toUpperCase();
      let origin = 'OUTROS';
      if (originRaw.includes('IFOOD')) origin = 'IFOOD';
      else if (originRaw.includes('APP - JOTA')) origin = 'JOTA JÁ';
      else if (originRaw.includes('PAINEL - JOTA')) origin = 'TELEFONE';
      else origin = originRaw || 'OUTROS';

      const key = `${rawNome.toLowerCase()}|${endereco.toLowerCase()}`;

      if (!customersMap.has(key)) {
        customersMap.set(key, {
          nome: rawNome,
          endereco,
          pedidos: 0,
          origens: {},
          origemPrincipal: origin
        });
      }

      const c = customersMap.get(key)!;
      c.pedidos++;
      c.origens[origin] = (c.origens[origin] || 0) + 1;
    });

    // Calcular origem principal
    const results = Array.from(customersMap.values()).map(c => {
      let mainOrigin = c.origemPrincipal;
      let maxCount = 0;
      Object.entries(c.origens).forEach(([orig, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mainOrigin = orig;
        }
      });
      c.origemPrincipal = mainOrigin;
      return c;
    });

    results.sort((a, b) => b.pedidos - a.pedidos);

    return results.slice(0, limit);
  }, [rawVendas, startDate, endDate, limit]);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Top Clientes
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Clientes com maior número de pedidos no período.
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

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <div className="flex items-center px-3 text-slate-400">
              <Filter className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top</span>
            <input
              type="number"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              min={1}
              max={100}
              className="bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 w-16 px-2 py-1 text-center"
            />
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Pos</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Endereço</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Origem Principal</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                    Nenhum cliente encontrado neste período.
                  </td>
                </tr>
              ) : (
                topCustomers.map((customer, index) => {
                  const maxPedidos = topCustomers[0].pedidos;
                  const percentage = Math.min((customer.pedidos / maxPedidos) * 100, 100);
                  
                  return (
                    <tr key={index} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative">
                      <td className="p-4">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {index + 1}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {customer.nome}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                          <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                          <span className="truncate max-w-[200px] md:max-w-xs">{customer.endereco}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center">
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5">
                            <Store className="w-3 h-3" />
                            {customer.origemPrincipal}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 relative">
                        <div className="flex items-center justify-end gap-3 relative z-10">
                          <span className="font-black text-slate-800">{customer.pedidos}</span>
                        </div>
                        <div 
                          className="absolute inset-y-1 right-1 bg-primary/5 rounded-xl -z-0 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
