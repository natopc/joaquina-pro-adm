import React, { useMemo, useState } from 'react';
import { Calendar, Filter, Star, MapPin, Store, Search } from 'lucide-react';
import { parseDate } from '../services/dataService';
import { Modal } from '../components/Modal';

interface CustomersProps {
  rawVendas: any[];
}

interface PedidoDetalhe {
  data: Date;
  valor: number;
}

interface CustomerData {
  nome: string;
  telefone: string;
  endereco: string;
  pedidos: number;
  valorGasto: number;
  origens: Record<string, number>;
  origemPrincipal: string;
  ultimaCompra: Date;
  pedidosDetalhes: PedidoDetalhe[];
}

const ORIGINS_LIST = ['IFOOD', 'JOTA JÁ', 'TELEFONE'];

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
  
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>(ORIGINS_LIST);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

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

      // Filtro de origens (aplicado a cada pedido)
      if (!selectedOrigins.includes(origin)) return;

      const telefoneStr = (v.Telefone || v.telefone || '').trim();
      let initialTelefone = '';
      if (telefoneStr) {
        initialTelefone = telefoneStr.startsWith('0800') ? '0800' : telefoneStr;
      }

      const key = `${rawNome.toLowerCase()}|${endereco.toLowerCase()}`;

      if (!customersMap.has(key)) {
        customersMap.set(key, {
          nome: rawNome,
          telefone: initialTelefone,
          endereco,
          pedidos: 0,
          valorGasto: 0,
          origens: {},
          origemPrincipal: origin,
          ultimaCompra: date,
          pedidosDetalhes: []
        });
      }

      const c = customersMap.get(key)!;
      
      // Update phone if we find a better one
      if (!c.telefone || c.telefone === '0800') {
        if (telefoneStr && !telefoneStr.startsWith('0800')) {
          c.telefone = telefoneStr;
        } else if (telefoneStr.startsWith('0800') && !c.telefone) {
          c.telefone = '0800';
        }
      }
      c.pedidos++;
      const valorPedido = Number((v.ValorFInal !== undefined ? v.ValorFInal : v.valor_final) || 0);
      c.valorGasto += valorPedido;
      c.origens[origin] = (c.origens[origin] || 0) + 1;
      
      if (date > c.ultimaCompra) {
        c.ultimaCompra = date;
      }
      
      c.pedidosDetalhes.push({
        data: date,
        valor: valorPedido
      });
    });

    // Calcular origem principal e filtrar por busca
    let results = Array.from(customersMap.values()).map(c => {
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

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      results = results.filter(c => c.nome.toLowerCase().includes(q));
    }

    results.sort((a, b) => b.pedidos - a.pedidos);

    // Sort order details by date descending
    results.forEach(c => {
      c.pedidosDetalhes.sort((a, b) => b.data.getTime() - a.data.getTime());
    });

    return results.slice(0, limit);
  }, [rawVendas, startDate, endDate, limit, selectedOrigins, searchQuery]);

  const handleOriginToggle = (origin: string) => {
    setSelectedOrigins(prev => 
      prev.includes(origin) 
        ? prev.filter(o => o !== origin)
        : [...prev, origin]
    );
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col xl:flex-row gap-6 xl:items-center justify-between">
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
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {ORIGINS_LIST.map(origin => (
              <label key={origin} className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-slate-100 rounded-lg transition-colors">
                <input 
                  type="checkbox" 
                  checked={selectedOrigins.includes(origin)}
                  onChange={() => handleOriginToggle(origin)}
                  className="w-3.5 h-3.5 text-primary border-slate-300 rounded focus:ring-primary"
                />
                <span className="text-xs font-bold text-slate-600 uppercase">{origin}</span>
              </label>
            ))}
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
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Última Compra</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Dias</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Valor Gasto</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Pedidos</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    Nenhum cliente encontrado neste período.
                  </td>
                </tr>
              ) : (
                topCustomers.map((customer, index) => {
                  const maxPedidos = topCustomers[0].pedidos;
                  const percentage = Math.min((customer.pedidos / maxPedidos) * 100, 100);
                  
                  const ultimaCompraDate = new Date(customer.ultimaCompra);
                  ultimaCompraDate.setHours(0, 0, 0, 0);
                  const diffTime = Math.abs(today.getTime() - ultimaCompraDate.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const diasStr = diffDays === 0 ? 'Hoje' : `${diffDays} dia(s)`;

                  const ticketMedio = customer.pedidos > 0 ? customer.valorGasto / customer.pedidos : 0;
                  
                  return (
                    <tr 
                      key={index} 
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative cursor-pointer"
                      onClick={() => setSelectedCustomer(customer)}
                    >
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
                          <span className="truncate max-w-[150px] md:max-w-[200px]">{customer.endereco}</span>
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
                      <td className="p-4 text-center text-slate-500 text-sm font-medium">
                        {customer.ultimaCompra.toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 text-center text-slate-500 text-sm font-medium">
                        {diasStr}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800">
                        R$ {customer.valorGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      <td className="p-4 text-right font-bold text-slate-800">
                        R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title="Detalhes do Cliente"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h4 className="text-lg font-black text-slate-800 flex items-center gap-3">
                {selectedCustomer.nome}
                {selectedCustomer.telefone && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-lg flex items-center">
                    Telefone: {selectedCustomer.telefone === '0800' ? '' : selectedCustomer.telefone}
                  </span>
                )}
              </h4>
              <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium mt-2">
                <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                <span>{selectedCustomer.endereco}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pedidos Totais</p>
                <p className="text-2xl font-black text-slate-800">{selectedCustomer.pedidos}</p>
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Gasto</p>
                <p className="text-2xl font-black text-primary">R$ {selectedCustomer.valorGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ticket Médio</p>
                <p className="text-2xl font-black text-slate-800">R$ {(selectedCustomer.valorGasto / selectedCustomer.pedidos).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4 uppercase text-sm tracking-tight text-slate-500">Histórico de Pedidos</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {selectedCustomer.pedidosDetalhes.map((pedido, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500">{pedido.data.toLocaleDateString('pt-BR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-primary text-sm">R$ {pedido.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
