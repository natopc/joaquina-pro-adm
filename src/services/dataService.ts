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
  workedDays?: number;
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
  rawEntregas: any[];
  rawMilanesasFaturamento?: any[];
  lastUpdatedAt?: string;
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
        date.setHours(!isNaN(hh) ? hh : 12, !isNaN(mm) ? mm : 0, !isNaN(ss) ? ss : 0);
      }
      
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Fallback for any other valid format that new Date() handles consistently (like words)
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

export function parseDurationToMinutes(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    // Se for fração de dia do Excel (ex: 0.02 * 24 * 60 = ~28.8 min)
    if (val < 1) return val * 24 * 60;
    return val;
  }

  const str = String(val).trim();
  if (!str || str === '-' || str === '0') return null;

  // Formato HH:MM:SS ou HH:MM ou MM:SS
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseFloat(p.trim()));
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return (h * 60) + m + (s / 60);
    } else if (parts.length === 2) {
      const [p1, p2] = parts;
      if (p1 > 10) {
        return p1 + (p2 / 60);
      } else {
        return (p1 * 60) + p2;
      }
    }
  }

  // Formato textual como "25 min", "25min", "25 minutos", "25.5"
  const clean = str.replace(',', '.');
  const match = clean.match(/^([\d.]+)/);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num) && num > 0) return num;
  }

  return null;
}

export function cleanIfoodCourierName(raw: string | null | undefined): string {
  if (!raw) return '';
  let name = String(raw).trim();

  // 1. Excluir o termo "Entregador iFood" (case-insensitive)
  name = name.replace(/entregador\s*ifood/gi, '').trim();

  // 2. Desconsiderar tudo que vier após um "ponto"
  const dotIndex = name.indexOf('.');
  if (dotIndex !== -1) {
    name = name.substring(0, dotIndex + 1).trim();
  }

  // 3. Limpar pontuações ou traços residuais nas extremidades
  name = name.replace(/^[-–—/,\s]+|[-–—/,\s]+$/g, '').trim();

  return name;
}

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
        courier: (parts[14] || 'Não informado').toUpperCase(),
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
      courier: (parts[10] || '').toUpperCase(),
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

export async function fetchRemoteLastUpdatedAt(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('updated_at')
      .eq('key', 'global_data')
      .maybeSingle();

    if (error || !data) {
      console.warn('Could not fetch sync_metadata', error);
      return null;
    }
    return data.updated_at;
  } catch (err) {
    console.error('Error fetching sync_metadata:', err);
    return null;
  }
}

export interface AvailableMonth {
  ano: number;
  mes_num: number;
  ano_mes: string;
}

export async function fetchAvailableMonthsFromDB(): Promise<AvailableMonth[]> {
  try {
    const { data, error } = await supabase
      .from('v_meses_disponiveis')
      .select('*')
      .order('ano', { ascending: false })
      .order('mes_num', { ascending: false });

    if (error || !data) {
      console.warn('Could not fetch v_meses_disponiveis', error);
      return [];
    }
    return data;
  } catch (err) {
    console.error('Error fetching available months:', err);
    return [];
  }
}

export function getLast60DaysRange(): { startDate: string; endDate: string } {
  const now = new Date();
  // Primeiro dia do mês anterior para garantir mês atual e anterior completos para MTD vs PMTD
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = now;

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

export function getMonthWithPriorRange(year: number, monthNum: number): { startDate: string; endDate: string } {
  let prevMonth = monthNum - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const start = new Date(prevYear, prevMonth - 1, 1);
  const end = new Date(year, monthNum, 0); // Último dia do mês

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

// Supabase period fetching logic with index on data_real
const fetchTableDataForPeriod = async (table: string, startDate?: string, endDate?: string) => {
  let allData: any[] = [];
  let from = 0;
  let to = 999;
  let hasMore = true;
  while(hasMore) {
    let query = supabase.from(table).select('*');
    if (startDate) {
      query = query.gte('data_real', startDate);
    }
    if (endDate) {
      query = query.lte('data_real', endDate);
    }
    const { data, error } = await query.range(from, to);
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += 1000;
      to += 1000;
      if (data.length < 1000) hasMore = false;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export async function fetchEntregasForPeriod(startDate: string, endDate: string): Promise<any[]> {
  const data = await fetchTableDataForPeriod('entregas', startDate, endDate);
  return data.map((e: any) => ({
    ...e,
    pedido: e['Nº Pedido'] || e.n_pedido || e['nº_pedido'] || e.pedido,
    cliente: e.Requerente || e.requerente || e.cliente,
    cliente_novo: e.Cliente || e.cliente_novo,
    hora_pedido: e['Criação'] || e.criacao || e.criação || e.hora_pedido,
    destino: e.Destino || e.destino,
    distancia: e['Distância (km)'] || e.distancia || e.distancia_km,
    status: e.Status || e.status,
    aceito_entregador: e['Aceito pelo entregador'] || e.aceito_pelo_entregador || e.aceito_entregador,
    finalizado: e['Finalização'] || e.finalizacao || e.finalização || e.finalizado,
    tempo_total: e['Tempo total da entrega'] || e.tempo_total_da_entrega || e.tempo_total,
    entregador: (e.Entregador || e.entregador || '').toUpperCase(),
    valor_precificado: e['Valor precificado'] || e.valor_precificado,
    valor_dinamica: e['Valor dinâmica'] || e.valor_dinamica || e.valor_dinâmica,
    valor_total: e['Valor total'] || e.valor_total,
    origem: 'R3'
  }));
}

export async function fetchEntregasIfoodForPeriod(startDate: string, endDate: string): Promise<any[]> {
  const data = await fetchTableDataForPeriod('entregas_ifood', startDate, endDate);
  return data.map((e: any) => {
    const rawData = (e['Data'] || '').trim();
    const rawRecebido = (e['Recebido'] || '').trim();
    const rawPronto = (e['Pronto'] || '').trim();
    const rawDespachado = (e['Despachado'] || '').trim();
    const rawFinalizado = (e['Finalizado'] || '').trim();

    const composeDateTime = (timeStr: string) => {
      if (!timeStr || timeStr === '-') return '';
      if (timeStr.includes('/') || timeStr.includes('-')) return timeStr;
      if (rawData && rawData !== '-') {
        return `${rawData} ${timeStr}`;
      }
      return timeStr;
    };

    const hora_pedido = composeDateTime(rawRecebido);
    const aceito_entregador = composeDateTime(rawDespachado);
    const finalizado = composeDateTime(rawFinalizado);
    const pronto = composeDateTime(rawPronto);

    let distancia = 0;
    const endStr = e['Endereços'] || '';
    const matchRota = endStr.match(/Rota:\s*([\d.]+)km/i);
    const matchRaio = endStr.match(/Raio:\s*([\d.]+)km/i);
    if (matchRota) {
      distancia = parseFloat(matchRota[1]) || 0;
    } else if (matchRaio) {
      distancia = parseFloat(matchRaio[1]) || 0;
    }

    let valorTotal = 0;
    if (e['Valor']) {
      const cleanVal = String(e['Valor']).replace(/[^\d,-]/g, '').replace(',', '.');
      valorTotal = parseFloat(cleanVal) || 0;
    }

    return {
      ...e,
      id: e.id,
      pedido: e['Código'] || e.codigo || String(e.id),
      cliente: e['Cliente'] || '',
      cliente_novo: e['Cliente'] || '',
      hora_pedido,
      destino: endStr || e['Bairro'] || '',
      distancia,
      status: finalizado ? 'Finalizado' : (aceito_entregador ? 'Em Entrega' : 'Recebido'),
      aceito_entregador,
      finalizado,
      pronto,
      tempo_total: '',
      entregador: cleanIfoodCourierName(e['Entregador'] || e.entregador || ''),
      valor_precificado: 0,
      valor_dinamica: 0,
      valor_total: valorTotal,
      bairro: e['Bairro'] || '',
      origem: e['Origem'] || 'IFood'
    };
  });
}

export function mergeDashboardData(existing: GlobalDashboardData, incoming: GlobalDashboardData): GlobalDashboardData {
  const statsMap = new Map<string, MonthlyStats>();
  (existing.monthlyStats || []).forEach(m => statsMap.set(`${m.month}-${m.year}`, m));
  (incoming.monthlyStats || []).forEach(m => statsMap.set(`${m.month}-${m.year}`, m));

  const monthMap: Record<string, number> = {
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
  };

  const monthlyStats = Array.from(statsMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return monthMap[b.month.toLowerCase()] - monthMap[a.month.toLowerCase()];
  });

  const vendasMap = new Map<string | number, any>();
  (existing.rawVendas || []).forEach((v, idx) => vendasMap.set(v.Id || v.id || `${v.Data}-${idx}`, v));
  (incoming.rawVendas || []).forEach((v, idx) => vendasMap.set(v.Id || v.id || `${v.Data}-${idx}`, v));

  const entregasMap = new Map<string | number, any>();
  (existing.rawEntregas || []).forEach((e, idx) => entregasMap.set(e.pedido || e.id || `${e.hora_pedido}-${idx}`, e));
  (incoming.rawEntregas || []).forEach((e, idx) => entregasMap.set(e.pedido || e.id || `${e.hora_pedido}-${idx}`, e));

  const milanesasMap = new Map<string | number, any>();
  (existing.rawMilanesasFaturamento || []).forEach((m, idx) => milanesasMap.set(m.id || m.data || idx, m));
  (incoming.rawMilanesasFaturamento || []).forEach((m, idx) => milanesasMap.set(m.id || m.data || idx, m));

  return {
    monthlyStats,
    last30DaysCouriers: incoming.last30DaysCouriers?.length ? incoming.last30DaysCouriers : existing.last30DaysCouriers,
    rawVendas: Array.from(vendasMap.values()),
    rawEntregas: Array.from(entregasMap.values()),
    rawMilanesasFaturamento: Array.from(milanesasMap.values()),
    lastUpdatedAt: incoming.lastUpdatedAt || existing.lastUpdatedAt
  };
}

export async function fetchMonthlyStatsFromDB(options?: {
  startDate?: string;
  endDate?: string;
  lastUpdatedAt?: string;
}): Promise<GlobalDashboardData> {
  const { startDate, endDate, lastUpdatedAt } = options || {};

  let [entregas, vendas, produtos, sobremesas, produtosMilanesa, sobremesasMilanesa, faturamentoMilanesa] = await Promise.all([
    fetchTableDataForPeriod('entregas', startDate, endDate),
    fetchTableDataForPeriod('vendas_consolidadas', startDate, endDate),
    fetchTableDataForPeriod('vendas_produtos', startDate, endDate),
    fetchTableDataForPeriod('vendas_sobremesas', startDate, endDate),
    fetchTableDataForPeriod('vendas_produtos_milanesas', startDate, endDate),
    fetchTableDataForPeriod('vendas_sobremesas_milanesas', startDate, endDate),
    fetchTableDataForPeriod('milanesas_faturamento', startDate, endDate)
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
    entregador: (e.Entregador || e.entregador || '').toUpperCase(),
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
    rawVendas: vendas,
    rawEntregas: entregas,
    rawMilanesasFaturamento: faturamentoMilanesa,
    lastUpdatedAt
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
