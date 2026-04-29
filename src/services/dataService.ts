import { parse } from 'date-fns';
import { supabase } from '../lib/supabase';
import { get, set } from 'idb-keyval';

// New Type for Last 30 Days Top 5
export interface Last30DaysCourier {
  name: string;
  initials: string;
  totalDeliveries: number;
  avgPrepTime: number; // For the requested time calculation ("Tempo Médio")
  deliveriesPerHour: number; // For the Productivity calculation
}

export interface RawDelivery {
  orderId: string;
  requester: string;
  created: string;
  customer: string;
  destination: string;
  distance: number;
  status: string;
  acceptedAt: string;
  finishedAt: string;
  totalTime: string;
  courier: string;
  price: number;
  dynamicPrice: number;
  totalPrice: number;
}

export interface CourierMetric {
  name: string;
  totalDeliveries: number;
  avgDeliveryTime: number; // in minutes (acceptedAt to finishedAt)
  avgPrepTime: number; // in minutes (created to acceptedAt)
  deliveriesPerHour: number; // productivity
  earnings: number;
  initials: string;
  rawDeliveries: RawDelivery[];
}

export interface ChannelStats {
  name: string;
  orders: number;
  revenue: number;
  ticketMedio: number;
}

export interface StoreStats {
  name: string;
  channels: ChannelStats[];
  totalOrders: number;
  totalRevenue: number;
  ticketMedio: number;
}

export interface MarketingStats {
  repediuRevenue: number;
  repediuOrders: number;
}

export interface MonthlyStats {
  month: string;
  year: number;
  deliveries: number;
  revenue: number;
  uniqueDays: number;
  dailyAvgRevenue: number;
  dailyAvgDeliveries: number;
  avgPrepTime: number;
  avgDeliveryTime: number;
  couriers: CourierMetric[];
  stores: StoreStats[];
  marketing: MarketingStats;
  topDishes: { name: string, sales: number }[];
  topDesserts: { name: string, sales: number }[];
  topDishesMilanesas: { name: string, sales: number }[];
  topDessertsMilanesas: { name: string, sales: number }[];
  topNeighborhoods: { name: string, sales: number }[];
  monthDeliveryFees: number;
}

export interface GlobalDashboardData {
  monthlyStats: MonthlyStats[];
  last30DaysCouriers: Last30DaysCourier[];
  rawVendas: any[];
}

export const parseDate = (dateStr: string) => {
  if (!dateStr || dateStr === 'Não Registrado') return null;
  
  // Clean string
  const str = dateStr.trim();

  // Handle ISO-ish YYYY-MM-DD formats (common from DB)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [datePart, timePart] = str.split(/[ T]/);
    const [y, m, d] = datePart.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    
    if (timePart) {
      const [hh, mm, ss] = timePart.split(':').map(Number);
      date.setHours(hh || 12, mm || 0, ss || 0);
    }
    return isNaN(date.getTime()) ? null : date;
  }

  // Handle DD/MM/YYYY or DD/MM/YY formats
  if (str.includes('/')) {
    const [datePart, timePart] = str.split(' ');
    const parts = datePart.split('/');
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      
      if (y < 100) y += 2000;
      
      const date = new Date(y, m - 1, d, 12, 0, 0);
      
      if (timePart) {
        const [hh, mm, ss] = timePart.split(':').map(Number);
        date.setHours(hh || 12, mm || 0, ss || 0);
      }
      
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Fallback for any other valid format that new Date() handles consistently (like words)
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

export function processCSVData(csvContent: string): MonthlyStats[] {
  const lines = csvContent.trim().split('\n');
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  
  const rawData: RawDelivery[] = lines.slice(1).map(line => {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuotes = !inQuotes;
      else if (line[i] === separator && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += line[i];
      }
    }
    parts.push(current);

    if (separator === ';') {
      // New format: Id;Data;Hora;Cliente;Origem;NomeFantasia;Telefone;StatusNome;ValorFInal;ValorFinalSemTaxa;TaxaEntrega;Logradouro;NumeroEntrega;Bairro;Entregador;...
      const valorFinal = parseFloat(parts[8]?.replace(',', '.')) || 0;
      const taxaEntrega = parseFloat(parts[10]?.replace(',', '.')) || 0;
      return {
        orderId: parts[0],
        requester: parts[4], // Origem
        created: `${parts[1]} ${parts[2]}`,
        customer: parts[3],
        destination: `${parts[11]}, ${parts[12]} - ${parts[13]}`,
        distance: 0,
        status: parts[7],
        acceptedAt: `${parts[1]} ${parts[2]}`, // Mocking acceptance as same as creation if not available
        finishedAt: `${parts[1]} ${parts[2]}`, // Mocking finish
        totalTime: '00:00:00',
        courier: parts[14] || 'Não informado',
        price: valorFinal,
        dynamicPrice: 0,
        totalPrice: valorFinal,
        taxaEntrega: taxaEntrega
      };
    }

    return {
      orderId: parts[0],
      requester: parts[1],
      created: parts[2],
      customer: parts[3],
      destination: parts[4],
      distance: parseFloat(parts[5]) || 0,
      status: parts[6],
      acceptedAt: parts[7],
      finishedAt: parts[8],
      totalTime: parts[9],
      courier: parts[10],
      price: parseFloat(parts[11]) || 0,
      dynamicPrice: parseFloat(parts[12]) || 0,
      totalPrice: parseFloat(parts[13]) || 0,
    };
  }).filter(d => d.status === 'Finalizado');

  const monthlyGroups: Record<string, RawDelivery[]> = {};
  rawData.forEach(d => {
    const date = parseDate(d.created);
    if (!date) return;
    const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
    if (!monthlyGroups[key]) monthlyGroups[key] = [];
    monthlyGroups[key].push(d);
  });

  return Object.entries(monthlyGroups).map(([key, allDeliveries]) => {
    const [month, year] = key.split('-').map(Number);
    
    // Separate REPEDIU (Marketing) from actual sales
    const deliveries = allDeliveries.filter(d => !d.requester.toUpperCase().includes('REPEDIU'));
    const repediuDeliveries = allDeliveries.filter(d => d.requester.toUpperCase().includes('REPEDIU'));

    const courierGroups: Record<string, RawDelivery[]> = {};
    deliveries.forEach(d => {
      if (!courierGroups[d.courier]) courierGroups[d.courier] = [];
      courierGroups[d.courier].push(d);
    });

    const courierMetrics: CourierMetric[] = Object.entries(courierGroups).map(([name, courierDeliveries]) => {
      let totalDeliveryTime = 0;
      let totalPrepTime = 0;
      let validDeliveryCount = 0;
      let validPrepCount = 0;

      const dailyGroups: Record<string, RawDelivery[]> = {};
      courierDeliveries.forEach(d => {
        const created = parseDate(d.created);
        const accept = parseDate(d.acceptedAt);
        const finish = parseDate(d.finishedAt);
        
        // Delivery Time: Accepted to Finished
        if (accept && finish) {
          const diff = (finish.getTime() - accept.getTime()) / (1000 * 60);
          if (diff > 0 && diff < 300) { // Filter outliers > 5h
            totalDeliveryTime += diff;
            validDeliveryCount++;
          }
        }

        // Prep Time: Created to Accepted
        if (created && accept) {
          const diff = (accept.getTime() - created.getTime()) / (1000 * 60);
          if (diff > 0 && diff < 300) {
            totalPrepTime += diff;
            validPrepCount++;
          }
        }

        if (created) {
          const dayKey = created.toDateString();
          if (!dailyGroups[dayKey]) dailyGroups[dayKey] = [];
          dailyGroups[dayKey].push(d);
        }
      });

      let totalWorkHours = 0;
      Object.values(dailyGroups).forEach(dayDeliveries => {
        const times = dayDeliveries
          .map(d => ({ accept: parseDate(d.acceptedAt), finish: parseDate(d.finishedAt) }))
          .filter(t => t.accept && t.finish);
        
        if (times.length > 0) {
          const firstAccept = Math.min(...times.map(t => t.accept!.getTime()));
          const lastFinish = Math.max(...times.map(t => t.finish!.getTime()));
          const hours = (lastFinish - firstAccept) / (1000 * 60 * 60);
          totalWorkHours += hours > 0 ? hours : 0.5; // Min 30 min if same time
        }
      });

      return {
        name,
        totalDeliveries: courierDeliveries.length,
        avgDeliveryTime: validDeliveryCount > 0 ? totalDeliveryTime / validDeliveryCount : 0,
        avgPrepTime: validPrepCount > 0 ? totalPrepTime / validPrepCount : 0,
        deliveriesPerHour: totalWorkHours > 0 ? courierDeliveries.length / totalWorkHours : 0,
        earnings: courierDeliveries.reduce((sum, d) => sum + d.totalPrice, 0),
        initials: name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        rawDeliveries: courierDeliveries
      };
    });

    const totalRevenue = deliveries.reduce((sum, d) => sum + d.totalPrice, 0);
    const uniqueDays = new Set(deliveries.map(d => parseDate(d.created)?.toDateString())).size || 1;
    const avgPrepTime = courierMetrics.reduce((acc, c) => acc + (c.avgPrepTime * c.totalDeliveries), 0) / (deliveries.length || 1);

    // --- Sales Breakdown by Channel (Joaquina) ---
    const channelMap: Record<string, { orders: number, revenue: number }> = {
      'IFOOD': { orders: 0, revenue: 0 },
      'JOTA JÁ': { orders: 0, revenue: 0 },
      'TELEFONE': { orders: 0, revenue: 0 },
    };

    deliveries.forEach(d => {
      let c = 'IFOOD';
      const origin = d.requester.toUpperCase();
      
      if (origin.includes('IFOOD')) c = 'IFOOD';
      else if (origin.includes('APP - JOTA')) c = 'JOTA JÁ';
      else if (origin.includes('PAINEL - JOTA')) c = 'TELEFONE';
      else if (d.orderId.startsWith('IF')) c = 'IFOOD';
      
      if (channelMap[c]) {
        channelMap[c].orders++;
        channelMap[c].revenue += d.totalPrice;
      }
    });

    const joaquinaChannels: ChannelStats[] = Object.entries(channelMap).map(([name, stats]) => ({
      name,
      orders: stats.orders,
      revenue: stats.revenue,
      ticketMedio: stats.orders > 0 ? stats.revenue / stats.orders : 0
    }));

    const joaquinaStore: StoreStats = {
      name: 'Joaquina',
      channels: joaquinaChannels,
      totalOrders: deliveries.length,
      totalRevenue: totalRevenue,
      ticketMedio: deliveries.length > 0 ? totalRevenue / deliveries.length : 0
    };

    // --- Mock Milanesas Store ---
    const milanesaStore: StoreStats = {
      name: 'Joaquina Milanesas',
      channels: [
        { name: 'IFOOD', orders: 0, revenue: 0, ticketMedio: 0 }
      ],
      totalOrders: 0,
      totalRevenue: 0,
      ticketMedio: 0
    };

    return {
      month: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1)),
      year,
      deliveries: deliveries.length,
      revenue: totalRevenue,
      uniqueDays: 1,
      dailyAvgRevenue: totalRevenue / uniqueDays,
      dailyAvgDeliveries: deliveries.length / uniqueDays,
      avgPrepTime: avgPrepTime || 0,
      avgDeliveryTime: 0,
      couriers: courierMetrics,
      stores: [joaquinaStore, milanesaStore],
      marketing: {
        repediuRevenue: repediuDeliveries.reduce((sum, d) => sum + d.totalPrice, 0),
        repediuOrders: repediuDeliveries.length
      },
      topDishes: [],
      topDesserts: [],
      topDishesMilanesas: [],
      topDessertsMilanesas: [],
      topNeighborhoods: [],
      monthDeliveryFees: 0
    };
  }).sort((a, b) => {
    const monthMap: Record<string, number> = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };
    if (a.year !== b.year) return b.year - a.year;
    return monthMap[b.month.toLowerCase()] - monthMap[a.month.toLowerCase()];
  });
}

export async function getCachedDashboardData(): Promise<GlobalDashboardData | undefined> {
  try {
    const data = await get('dashboardData');
    if (data) return data as GlobalDashboardData;
  } catch (err) {
    console.error('Error reading cache', err);
  }
  return undefined;
}

export async function setCachedDashboardData(data: GlobalDashboardData): Promise<void> {
  try {
    await set('dashboardData', data);
  } catch (err) {
    console.error('Error saving cache', err);
  }
}

// Supabase fetching logic (Parallelized in chunks)
const fetchAllData = async (table: string) => {
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  const BATCH_SIZE = 1000;
  const CONCURRENT_REQUESTS = 5;

  try {
    while (hasMore) {
      const batchPromises = [];
      for (let j = 0; j < CONCURRENT_REQUESTS; j++) {
        const start = from + (j * BATCH_SIZE);
        batchPromises.push(supabase.from(table).select('*').range(start, start + BATCH_SIZE - 1));
      }
      
      const results = await Promise.all(batchPromises);
      
      for (const res of results) {
        if (res.error) {
          console.error(`Error fetching batch for ${table}:`, res.error);
        }
        if (res.data && res.data.length > 0) {
          allData = allData.concat(res.data);
          if (res.data.length < BATCH_SIZE) {
            hasMore = false; // We hit the end of the table
          }
        } else {
           // Empty response means no more data in this or subsequent batches
           hasMore = false;
        }
      }
      from += (BATCH_SIZE * CONCURRENT_REQUESTS);
    }
  } catch (err) {
    console.error(`Chunked parallel fetch failed for ${table}`, err);
  }

  return allData;
};

export async function fetchMonthlyStatsFromDB(): Promise<GlobalDashboardData> {
  let [entregas, vendas, produtos, sobremesas, produtosMilanesa, sobremesasMilanesa, faturamentoMilanesa] = await Promise.all([
    fetchAllData('entregas'),
    fetchAllData('vendas_consolidadas'),
    fetchAllData('vendas_produtos'),
    fetchAllData('vendas_sobremesas'),
    fetchAllData('vendas_produtos_milanesas'),
    fetchAllData('vendas_sobremesas_milanesas'),
    fetchAllData('milanesas_faturamento')
  ]);

  entregas = entregas.map((e: any) => ({
    ...e,
    pedido: e['Nº Pedido'] || e.n_pedido || e['nº_pedido'] || e.pedido,
    cliente: e.Requerente || e.requerente || e.cliente, // O campo antigo 'cliente' virou 'Requerente'
    cliente_novo: e.Cliente || e.cliente_novo, // A nova coluna se chama 'Cliente'
    hora_pedido: e['Criação'] || e.criacao || e.criação || e.hora_pedido,
    destino: e.Destino || e.destino,
    distancia: e['Distância (km)'] || e.distancia || e.distancia_km,
    status: e.Status || e.status,
    aceito_entregador: e['Aceito pelo entregador'] || e.aceito_pelo_entregador || e.aceito_entregador,
    finalizado: e['Finalização'] || e.finalizacao || e.finalização || e.finalizado,
    tempo_total: e['Tempo total da entrega'] || e.tempo_total_da_entrega || e.tempo_total,
    entregador: e.Entregador || e.entregador,
    valor_precificado: e['Valor precificado'] || e.valor_precificado,
    valor_dinamica: e['Valor dinâmica'] || e.valor_dinamica || e.valor_dinâmica,
    valor_total: e['Valor total'] || e.valor_total
  }));

  const monthlyGroups: Record<string, { 
    entregas: any[], 
    vendas: any[], 
    produtos: any[], 
    sobremesas: any[], 
    produtosMilanesa: any[], 
    sobremesasMilanesa: any[],
    faturamentoMilanesa: any[]
  }> = {};

  // Group Vendas
  vendas.forEach(v => {
     const date = parseDate(v.Data || v.data);
     if (!date) return;
     
     const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
     if (!monthlyGroups[key]) monthlyGroups[key] = { 
        entregas: [], vendas: [], produtos: [], sobremesas: [], 
        produtosMilanesa: [], sobremesasMilanesa: [], faturamentoMilanesa: [] 
      };
     monthlyGroups[key].vendas.push(v);
  });

  // Group Entregas
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const last30DaysDeliveries: any[] = [];

  entregas.forEach(e => {
     const date = parseDate(e.hora_pedido);
     if (!date) return;
     
     if (date >= thirtyDaysAgo) {
       last30DaysDeliveries.push(e);
     }

     const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
     if (!monthlyGroups[key]) monthlyGroups[key] = { 
        entregas: [], vendas: [], produtos: [], sobremesas: [], 
        produtosMilanesa: [], sobremesasMilanesa: [], faturamentoMilanesa: [] 
      };
     monthlyGroups[key].entregas.push(e);
  });

  // Group Produtos
  produtos.forEach(p => {
     const date = parseDate(p.data_venda);
     if (!date) return;

     const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
     if (!monthlyGroups[key]) monthlyGroups[key] = { 
        entregas: [], vendas: [], produtos: [], sobremesas: [], 
        produtosMilanesa: [], sobremesasMilanesa: [], faturamentoMilanesa: [] 
      };
     monthlyGroups[key].produtos.push(p);
  });

  // Group Sobremesas
  sobremesas.forEach(s => {
     const date = parseDate(s.data_venda);
     if (!date) return;

     const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
     if (!monthlyGroups[key]) monthlyGroups[key] = { 
        entregas: [], vendas: [], produtos: [], sobremesas: [], 
        produtosMilanesa: [], sobremesasMilanesa: [], faturamentoMilanesa: [] 
      };
     monthlyGroups[key].sobremesas.push(s);
  });

  // Group Produtos Milanesa
  produtosMilanesa.forEach(p => {
     const date = parseDate(p.data_venda);
     if (!date) return;

     const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
     if (!monthlyGroups[key]) monthlyGroups[key] = { 
        entregas: [], vendas: [], produtos: [], sobremesas: [], 
        produtosMilanesa: [], sobremesasMilanesa: [], faturamentoMilanesa: [] 
      };
     monthlyGroups[key].produtosMilanesa.push(p);
  });

  // Group Sobremesas Milanesa
  sobremesasMilanesa.forEach(s => {
     const date = parseDate(s.data_venda);
     if (!date) return;

     const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
     if (!monthlyGroups[key]) monthlyGroups[key] = { 
        entregas: [], vendas: [], produtos: [], sobremesas: [], 
        produtosMilanesa: [], sobremesasMilanesa: [], faturamentoMilanesa: [] 
      };
     monthlyGroups[key].sobremesasMilanesa.push(s);
  });

  // Group Faturamento Milanesa
  faturamentoMilanesa.forEach(f => {
    const date = parseDate(f.data);
    if (!date) return;

    const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
    if (!monthlyGroups[key]) monthlyGroups[key] = { 
      entregas: [], vendas: [], produtos: [], sobremesas: [], 
      produtosMilanesa: [], sobremesasMilanesa: [], faturamentoMilanesa: [] 
    };
    monthlyGroups[key].faturamentoMilanesa.push(f);
  });

  // Calculate Last 30 Days Couriers
  const l30Groups: Record<string, any[]> = {};
  last30DaysDeliveries.forEach(e => {
    if (!e.entregador) return;
    const rawName = e.entregador.trim();
    const name = rawName.includes('-') ? rawName.substring(rawName.indexOf('-') + 1).trim() : rawName;
    if (!l30Groups[name]) l30Groups[name] = [];
    l30Groups[name].push(e);
  });

  let last30DaysCouriers: Last30DaysCourier[] = Object.entries(l30Groups).map(([name, deliveries]) => {
     let totalPrepTime = 0;
     let validCount = 0;
     const dailyGroups: Record<string, any[]> = {};

     deliveries.forEach(d => {
        const created = parseDate(d.hora_pedido);
        const accept = parseDate(d.aceito_entregador);
        const finish = parseDate(d.finalizado);
        
        if (created && accept) {
          const diff = (accept.getTime() - created.getTime()) / (1000 * 60);
          if (diff >= 0 && diff < 300) { totalPrepTime += diff; validCount++; }
        }

        if (accept) {
          const dayKey = accept.toDateString();
          if (!dailyGroups[dayKey]) dailyGroups[dayKey] = [];
          dailyGroups[dayKey].push({ accept, finish });
        }
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

     return {
       name,
       initials: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
       totalDeliveries: deliveries.length,
       avgPrepTime: validCount > 0 ? totalPrepTime / validCount : 0,
       deliveriesPerHour: totalWorkHours > 0 ? deliveries.length / totalWorkHours : 0
     };
  });
  last30DaysCouriers.sort((a, b) => b.totalDeliveries - a.totalDeliveries);

  const monthlyStats: MonthlyStats[] = Object.entries(monthlyGroups).map(([key, monthData]) => {
    const [month, year] = key.split('-').map(Number);

    const courierGroups: Record<string, any[]> = {};
    const safeEntregasForCourier = monthData.entregas || [];
    safeEntregasForCourier.forEach(e => {
      if (!e.entregador) return;
      const rawName = e.entregador.trim();
      const name = rawName.includes('-') ? rawName.substring(rawName.indexOf('-') + 1).trim() : rawName;
      if (!courierGroups[name]) courierGroups[name] = [];
      courierGroups[name].push(e);
    });

    const courierMetrics: CourierMetric[] = Object.entries(courierGroups).map(([name, deliveries]) => {
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

         if (accept) { // using accept since it's the anchor for productivity
            const dayKey = accept.toDateString();
            if (!dailyGroups[dayKey]) dailyGroups[dayKey] = [];
            dailyGroups[dayKey].push({ accept, finish });
         }

         return {
            orderId: d.pedido,
            requester: '',
            created: d.hora_pedido,
            customer: d.cliente || '',
            destination: d.destino || '',
            distance: 0,
            status: d.finalizado ? 'Finalizado' : 'Em Andamento',
            acceptedAt: d.aceito_entregador,
            finishedAt: d.finalizado,
            totalTime: '',
            courier: name,
            price: 0, 
            dynamicPrice: 0,
            totalPrice: 0
         };
      });

      let totalWorkHours = 0;
      Object.values(dailyGroups).forEach(dayTimes => {
         const times = dayTimes.filter(t => t.accept && t.finish);
         if (times.length > 0) {
            const firstAccept = Math.min(...times.map(t => t.accept!.getTime()));
            const lastFinish = Math.max(...times.map(t => t.finish!.getTime()));
            const hours = (lastFinish - firstAccept) / (1000 * 60 * 60);
            totalWorkHours += hours > 0.1 ? hours : 0.5; // Avoid div by zero
         }
      });

      return {
        name,
        totalDeliveries: deliveries.length,
        avgDeliveryTime: 0, 
        avgPrepTime: validPrepCount > 0 ? totalPrepTime / validPrepCount : 0,
        deliveriesPerHour: totalWorkHours > 0 ? deliveries.length / totalWorkHours : 0,
        earnings: 0, // No specific earnings column for couriers based on `entregas`
        initials: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        rawDeliveries: mappedRaw
      };
    });

    const safeVendas = monthData.vendas || [];
    const totalRevenue = safeVendas.reduce((sum, v) => sum + Number((v.ValorFInal !== undefined ? v.ValorFInal : v.valor_final) || 0), 0);
    const totalOrders = safeVendas.length;
    const uniqueDays = new Set(safeVendas.map((v: any) => v.Data || v.data)).size || 1;

    const repediuSales = safeVendas.filter((v: any) => (v.Origem || v.origem || '').toUpperCase().includes('REPEDIU'));

    const channelMap: Record<string, { orders: number, revenue: number }> = {
      'IFOOD': { orders: 0, revenue: 0 },
      'JOTA JÁ': { orders: 0, revenue: 0 },
      'TELEFONE': { orders: 0, revenue: 0 },
    };

    let monthDeliveryFees = 0;
    const bairroCount: Record<string, number> = {};

    safeVendas.forEach(v => {
      let c = 'IFOOD';
      const origin = (v.Origem || v.origem || '').toUpperCase();
      if (origin.includes('IFOOD')) c = 'IFOOD';
      else if (origin.includes('APP - JOTA')) c = 'JOTA JÁ';
      else if (origin.includes('PAINEL - JOTA')) c = 'TELEFONE';
      
      if (channelMap[c]) {
        channelMap[c].orders++;
        channelMap[c].revenue += Number((v.ValorFInal !== undefined ? v.ValorFInal : v.valor_final) || 0);
      }

      const statusNome = v.StatusNome || v.status_nome;
      if (!statusNome || statusNome.toLowerCase() !== 'cancelado') {
         const taxaEntrega = v.TaxaEntrega !== undefined ? v.TaxaEntrega : v.taxa_entrega;
         const taxaRaw = typeof taxaEntrega === 'string' ? taxaEntrega.replace(',', '.') : (taxaEntrega || 0);
         const taxa = Number(taxaRaw);
         if (!isNaN(taxa) && taxa > 0) {
            if (taxa.toFixed(2).endsWith('.90')) {
               monthDeliveryFees += taxa;
            }
         }
         
         const bairro = v.Bairro || v.bairro;
         if (bairro && typeof bairro === 'string' && bairro.trim() !== '') {
            const b = bairro.trim().toUpperCase();
            bairroCount[b] = (bairroCount[b] || 0) + 1;
         }
      }
    });

    const monthTopNeighborhoods = Object.entries(bairroCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, sales]) => ({ name, sales }));

    const joaquinaChannels = Object.entries(channelMap).map(([name, stats]) => ({
      name,
      orders: stats.orders,
      revenue: stats.revenue,
      ticketMedio: stats.orders > 0 ? stats.revenue / stats.orders : 0
    }));

    const joaquinaStore = {
      name: 'Joaquina',
      channels: joaquinaChannels,
      totalOrders,
      totalRevenue,
      ticketMedio: totalOrders > 0 ? totalRevenue / totalOrders : 0
    };

    const safeProdutosMilanesa = monthData.produtosMilanesa || [];
    const safeSobremesasMilanesa = monthData.sobremesasMilanesa || [];
    
    const safeFaturamentoMilanesa = monthData.faturamentoMilanesa || [];
    
    // Revenue from milanesas_faturamento table
    const milanesasRevenue = safeFaturamentoMilanesa.reduce((sum, f) => sum + Number(f.faturamento || 0), 0); 
    // Order count from milanesas_faturamento table (new column added by user)
    const milanesasOrders = safeFaturamentoMilanesa.reduce((sum, f) => sum + Number(f.pedidos || 0), 0);

    const milanesaStore = {
      name: 'Joaquina Milanesas',
      channels: [
        { name: 'IFOOD', orders: milanesasOrders, revenue: milanesasRevenue, ticketMedio: milanesasOrders > 0 ? milanesasRevenue / milanesasOrders : 0 }
      ],
      totalOrders: milanesasOrders,
      totalRevenue: milanesasRevenue,
      ticketMedio: milanesasOrders > 0 ? milanesasRevenue / milanesasOrders : 0
    };

    const avgPrepGlobal = courierMetrics.reduce((acc, c) => acc + (c.avgPrepTime * c.totalDeliveries), 0) / (safeEntregasForCourier.length || 1);

    let totalDeliveryTime = 0;
    let validDeliveryCount = 0;
    safeEntregasForCourier.forEach(e => {
        const accept = parseDate(e.aceito_entregador);
        const finish = parseDate(e.finalizado);
        if (accept && finish && !isNaN(accept.getTime()) && !isNaN(finish.getTime())) {
            const diff = (finish.getTime() - accept.getTime()) / (1000 * 60);
            if (diff >= 5 && diff <= 120) {
                totalDeliveryTime += diff;
                validDeliveryCount++;
            }
        }
    });
    const avgDeliveryGlobal = validDeliveryCount > 0 ? (totalDeliveryTime / validDeliveryCount) : 0;

    const productSales: Record<string, number> = {};
    const safeProdutos = monthData.produtos || [];
    safeProdutos.forEach(p => {
      if (!p.produto || !p.qtd) return;
      const numQtd = Number(p.qtd);
      if (isNaN(numQtd)) return;
      productSales[p.produto] = (productSales[p.produto] || 0) + numQtd;
    });

    const monthTopDishes = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sales]) => ({ name, sales }));

    const dessertSales: Record<string, number> = {};
    const safeSobremesas = monthData.sobremesas || [];
    safeSobremesas.forEach(s => {
      if (!s.produto || !s.qtd) return;
      const amount = Number(s.qtd);
      if (isNaN(amount)) return;
      dessertSales[s.produto] = (dessertSales[s.produto] || 0) + amount;
    });

    const monthTopDesserts = Object.entries(dessertSales)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sales]) => ({ name, sales }));

    const productSalesMilanesa: Record<string, number> = {};
    safeProdutosMilanesa.forEach(p => {
      if (!p.produto || !p.qtd) return;
      const numQtd = Number(p.qtd);
      if (isNaN(numQtd)) return;
      productSalesMilanesa[p.produto] = (productSalesMilanesa[p.produto] || 0) + numQtd;
    });

    const monthTopDishesMilanesa = Object.entries(productSalesMilanesa)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sales]) => ({ name, sales }));

    const dessertSalesMilanesa: Record<string, number> = {};
    safeSobremesasMilanesa.forEach(s => {
      if (!s.produto || !s.qtd) return;
      const amount = Number(s.qtd);
      if (isNaN(amount)) return;
      dessertSalesMilanesa[s.produto] = (dessertSalesMilanesa[s.produto] || 0) + amount;
    });

    const monthTopDessertsMilanesa = Object.entries(dessertSalesMilanesa)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sales]) => ({ name, sales }));

    return {
      month: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1)),
      year,
      deliveries: monthData.entregas?.length || 0,
      revenue: totalRevenue,
      uniqueDays,
      dailyAvgRevenue: totalRevenue / uniqueDays,
      dailyAvgDeliveries: (monthData.entregas?.length || 0) / uniqueDays,
      avgPrepTime: avgPrepGlobal,
      avgDeliveryTime: avgDeliveryGlobal,
      couriers: courierMetrics,
      stores: [joaquinaStore, milanesaStore],
      marketing: { repediuRevenue: repediuSales.reduce((sum, v) => sum + Number((v.ValorFInal !== undefined ? v.ValorFInal : v.valor_final) || 0), 0), repediuOrders: repediuSales.length },
      topDishes: monthTopDishes,
      topDesserts: monthTopDesserts,
      topDishesMilanesas: monthTopDishesMilanesa,
      topDessertsMilanesas: monthTopDessertsMilanesa,
      topNeighborhoods: monthTopNeighborhoods,
      monthDeliveryFees
    };
  });

  monthlyStats.sort((a, b) => {
    const monthMap: Record<string, number> = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };
    if (a.year !== b.year) return b.year - a.year;
    return monthMap[b.month.toLowerCase()] - monthMap[a.month.toLowerCase()];
  });

  return {
    monthlyStats,
    last30DaysCouriers,
    rawVendas: vendas
  };
}

export async function fetchInputManualFromDB(monthYear: string): Promise<any> {
  const { data, error } = await supabase
    .from('input_manual')
    .select('data_json')
    .eq('mes_ano', monthYear)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data.data_json;
}

export async function saveInputManualToDB(monthYear: string, jsonData: any): Promise<boolean> {
  const { error } = await supabase
    .from('input_manual')
    .upsert({ 
      mes_ano: monthYear, 
      data_json: jsonData 
    }, {
      onConflict: 'mes_ano'
    });

  if (error) {
    console.error('Error saving input manual:', error);
    return false;
  }
  return true;
}
