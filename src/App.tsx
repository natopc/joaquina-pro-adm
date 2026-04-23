import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Bike,
  ListOrdered,
  ShoppingBag,
  Users as UsersIcon,
  Search,
  LogOut,
  Loader2,
  Menu as MenuIcon,
  X,
  Star
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MonthlyStats,
  CourierMetric,
  Last30DaysCourier,
  fetchMonthlyStatsFromDB,
  fetchInputManualFromDB,
  saveInputManualToDB
} from './services/dataService';
import { useAuth } from './contexts/AuthContext';

// --- Extracted Components & Pages ---
import { Login } from './pages/Login';
import { Modal } from './components/Modal';
import { SidebarItem } from './components/SidebarItem';
import { Overview } from './pages/Overview';
import { Sales } from './pages/Sales';
import { Couriers } from './pages/Couriers';
import { Menu } from './pages/Menu';
import { InputPage } from './pages/Input';
import { UsersPage } from './pages/Users';
import { Customers } from './pages/Customers';
import { supabase } from './lib/supabase';

type Tab = 'overview' | 'sales' | 'couriers' | 'menu' | 'input' | 'users' | 'customers';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Gerente' | 'Operador';
  status: 'Ativo' | 'Inativo';
}

interface RankingItem {
  name: string;
  sales: number;
}

interface RankingCategory {
  id: string;
  name: string;
  items: RankingItem[];
  showOnDashboard: boolean;
}

interface ManualDataEntry {
  repediuRevenue: number;
  repediuOrders: number;
  joaquinaIfoodOrders: number;
  joaquinaIfoodRevenue: number;
  joaquinaJotaJaOrders: number;
  joaquinaJotaJaRevenue: number;
  joaquinaTelefoneOrders: number;
  joaquinaTelefoneRevenue: number;
  joaquinaCategories: RankingCategory[];
  lastUpdatedAt?: string;
}

interface ManualData {
  [key: string]: ManualDataEntry;
}

// Removed RAW_CSV

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = React.useState<Tab>('overview');
  const [dbData, setDbData] = React.useState<MonthlyStats[]>([]);
  const [rawVendas, setRawVendas] = React.useState<any[]>([]);
  const [rawMilanesasFaturamento, setRawMilanesasFaturamento] = React.useState<any[]>([]);
  const [last30DaysCouriers, setLast30DaysCouriers] = React.useState<Last30DaysCourier[]>([]);
  const [totalDeliveryFees, setTotalDeliveryFees] = React.useState<number>(0);
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  
  // Couriers 
  const [courierSort, setCourierSort] = React.useState<{ key: 'name' | 'deliveries' | 'time' | 'productivity', dir: 'asc' | 'desc' }>({ key: 'deliveries', dir: 'desc' });
  const [selectedCourier, setSelectedCourier] = React.useState<CourierMetric | null>(null);
  const [overviewCourierSort, setOverviewCourierSort] = React.useState<{ key: 'name' | 'time' | 'productivity', dir: 'asc' | 'desc' }>({ key: 'productivity', dir: 'desc' });
  
  // Input logic
  const [availableMonths, setAvailableMonths] = React.useState<string[]>([]);
  const [selectedInputMonth, setSelectedInputMonth] = React.useState<string>('');
  const [isAddMonthModalOpen, setIsAddMonthModalOpen] = React.useState(false);
  const [newMonthName, setNewMonthName] = React.useState('');
  const [newMonthYear, setNewMonthYear] = React.useState(new Date().getFullYear().toString());

  // Clean initialization
  const [manualData, setManualData] = React.useState<ManualData>({});
  const [draftManualData, setDraftManualData] = React.useState<ManualData>({});

  // Clean initialization
  const [users, setUsers] = React.useState<User[]>([]);
  const { user: authUser } = useAuth();
  
  // Fetch users from database
  React.useEffect(() => {
    const fetchUsers = async () => {
      if (!authUser) return;
      
      const { data, error } = await supabase.from('usuarios').select('*');
      if (error) {
        console.error('Error fetching users:', error);
        return;
      }
      
      if (data) {
        setUsers(data.map(d => ({
          id: d.id,
          name: d.nome,
          email: d.email,
          role: d.cargo as any,
          status: d.status as any
        })));
      }
    };
    
    fetchUsers();
  }, [authUser]);

  const [currentUser, setCurrentUser] = React.useState<User>({ id: '1', name: 'Admin', email: 'admin@local.com', role: 'Admin', status: 'Ativo' });
  
  // Update currentUser when authUser or users change
  React.useEffect(() => {
    if (authUser && users.length > 0) {
      const found = users.find(u => u.email === authUser.email);
      if (found) {
        setCurrentUser(found);
      }
    }
  }, [authUser, users]);

  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = React.useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState<string | null>(null);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [userFormData, setUserFormData] = React.useState<any>({
    name: '',
    email: '',
    password: '',
    role: 'Operador',
    status: 'Ativo'
  });
  const [isSavingUser, setIsSavingUser] = React.useState(false);

  const getEmptyManualData = (): ManualDataEntry => ({
    repediuRevenue: 0,
    repediuOrders: 0,
    joaquinaIfoodOrders: 0,
    joaquinaIfoodRevenue: 0,
    joaquinaJotaJaOrders: 0,
    joaquinaJotaJaRevenue: 0,
    joaquinaTelefoneOrders: 0,
    joaquinaTelefoneRevenue: 0,
    joaquinaCategories: [
      { id: 'j-1', name: 'Pratos', items: [], showOnDashboard: true },
      { id: 'j-2', name: 'Sobremesas', items: [], showOnDashboard: true }
    ],
    lastUpdatedAt: ''
  });

  // Calculate generic available keys
  const allAvailableMonthKeys = React.useMemo(() => {
    const dbKeys = dbData.map(d => `${d.month}-${d.year}`);
    const manualKeys = Object.keys(manualData);
    const keys = Array.from(new Set([...dbKeys, ...manualKeys]));
    // Provide a default if absolutely empty
    if (keys.length === 0) {
      const defaultMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
      const defaultKey = `${defaultMonth.charAt(0).toUpperCase() + defaultMonth.slice(1)}-${new Date().getFullYear()}`;
      return [defaultKey];
    }
    return keys;
  }, [dbData, manualData]);

  const availableYears = React.useMemo(() => {
    const years = allAvailableMonthKeys.map(key => parseInt(key.split('-')[1]));
    return (Array.from(new Set(years)) as number[]).sort((a, b) => b - a);
  }, [allAvailableMonthKeys]);

  const getMonthsForYear = (year: number) => {
    const months = allAvailableMonthKeys
      .filter(key => key.endsWith(`-${year}`))
      .map(key => key.split('-')[0]);
    
    // Order months correctly
    const monthOrder = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return (Array.from(new Set(months)) as string[]).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
  };

  const [isLoadingDB, setIsLoadingDB] = React.useState(true);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoadingDB(false);
      return;
    }

    const loadDBStats = async () => {
      try {
        setIsLoadingDB(true);
        const payload = await fetchMonthlyStatsFromDB();
        setDbData(payload.monthlyStats);
        setRawVendas(payload.rawVendas);
        setRawMilanesasFaturamento(payload.rawMilanesasFaturamento);
        setLast30DaysCouriers(payload.last30DaysCouriers);
        
        if (payload.monthlyStats.length > 0) {
          setSelectedMonth(payload.monthlyStats[0].month);
          setSelectedYear(payload.monthlyStats[0].year);
        } else {
          const currentMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
          setSelectedMonth(currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1));
        }

        // Setup manual input dropdowns based on available keys
        if (availableMonths.length === 0) {
          const keys = payload.monthlyStats.map((d: any) => `${d.month}-${d.year}`);
          if (keys.length > 0) {
            setAvailableMonths(keys);
            setSelectedInputMonth(keys[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load db data', err);
      } finally {
        setIsLoadingDB(false);
      }
    };

    loadDBStats();
  }, [user, authLoading, availableMonths.length]);

  // Fetch Manual Data when Input Month relative changes
  React.useEffect(() => {
    const loadManual = async () => {
      if (!selectedInputMonth) return;
      const data = await fetchInputManualFromDB(selectedInputMonth);
      if (data) {
        setManualData(prev => ({ ...prev, [selectedInputMonth]: data }));
        setDraftManualData(prev => ({ ...prev, [selectedInputMonth]: data }));
      }
    };
    loadManual();
  }, [selectedInputMonth]);

  // Sync Overview manual data
  React.useEffect(() => {
    const key = `${selectedMonth}-${selectedYear}`;
    const loadManual = async () => {
      if (!key || manualData[key]) return; // already loaded
      const data = await fetchInputManualFromDB(key);
      if (data) {
        setManualData(prev => ({ ...prev, [key]: data }));
      }
    };
    loadManual();
  }, [selectedMonth, selectedYear, manualData]);

  const currentManual = manualData[`${selectedMonth}-${selectedYear}`] || getEmptyManualData();
  const currentMonthData = dbData.find(d => d.month.toLowerCase().trim() === selectedMonth.toLowerCase().trim() && d.year === selectedYear);

  const joaquinaMenuCategoriesWithDB = [
    {
      id: 'joaquina-pratos-db',
      name: 'Pratos',
      items: currentMonthData?.topDishes || [],
      showOnDashboard: true
    },
    {
      id: 'joaquina-sobremesas-db',
      name: 'Sobremesas',
      items: currentMonthData?.topDesserts || [],
      showOnDashboard: true
    },
    ...currentManual.joaquinaCategories.filter(cat => 
      !cat.name.toLowerCase().includes('pratos') && 
      !cat.name.toLowerCase().includes('sobremesa')
    )
  ];

  const milanesasMenuCategoriesWithDB = [
    {
      id: 'milanesas-pratos-db',
      name: 'Pratos',
      items: currentMonthData?.topDishesMilanesas || [],
      showOnDashboard: true
    },
    {
      id: 'milanesas-sobremesas-db',
      name: 'Sobremesas',
      items: currentMonthData?.topDessertsMilanesas || [],
      showOnDashboard: true
    }
  ];

  const dashboardCategoriesJoaquina = joaquinaMenuCategoriesWithDB.filter(c => c.showOnDashboard).map(c => ({...c, storeName: 'Joaquina'}));
  const dashboardCategoriesMilanesas = milanesasMenuCategoriesWithDB.filter(c => c.showOnDashboard).map(c => ({...c, storeName: 'Joaquina Milanesas'}));
  const dashboardCategories = [...dashboardCategoriesJoaquina, ...dashboardCategoriesMilanesas];

  const [activeDashboardCat, setActiveDashboardCat] = React.useState(dashboardCategories[0]?.id || '');

  React.useEffect(() => {
    if (!dashboardCategories.find(c => c.id === activeDashboardCat)) {
      setActiveDashboardCat(dashboardCategories[0]?.id || '');
    }
  }, [currentManual, activeDashboardCat, dashboardCategories]);



  // Derived Data for Sales
  const currentManualSales = currentManual;
  const storesWithManual = currentMonthData?.stores.map(store => {
    if (store.name === 'Joaquina') {
      const ifoodOrders = currentManualSales.joaquinaIfoodOrders || store.channels.find(c => c.name === 'IFOOD')?.orders || 0;
      const ifoodRevenue = currentManualSales.joaquinaIfoodRevenue || store.channels.find(c => c.name === 'IFOOD')?.revenue || 0;
      const jotajaOrders = currentManualSales.joaquinaJotaJaOrders || store.channels.find(c => c.name === 'JOTA JÁ')?.orders || 0;
      const jotajaRevenue = currentManualSales.joaquinaJotaJaRevenue || store.channels.find(c => c.name === 'JOTA JÁ')?.revenue || 0;
      const telefoneOrders = currentManualSales.joaquinaTelefoneOrders || store.channels.find(c => c.name === 'TELEFONE')?.orders || 0;
      const telefoneRevenue = currentManualSales.joaquinaTelefoneRevenue || store.channels.find(c => c.name === 'TELEFONE')?.revenue || 0;

      const totalOrders = ifoodOrders + jotajaOrders + telefoneOrders;
      const totalRevenue = ifoodRevenue + jotajaRevenue + telefoneRevenue;

      return {
        ...store,
        totalOrders,
        totalRevenue,
        ticketMedio: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        channels: store.channels.map(c => {
          if (c.name === 'IFOOD') return { ...c, orders: ifoodOrders, revenue: ifoodRevenue, ticketMedio: ifoodOrders > 0 ? ifoodRevenue / ifoodOrders : 0 };
          if (c.name === 'JOTA JÁ') return { ...c, orders: jotajaOrders, revenue: jotajaRevenue, ticketMedio: jotajaOrders > 0 ? jotajaRevenue / jotajaOrders : 0 };
          if (c.name === 'TELEFONE') return { ...c, orders: telefoneOrders, revenue: telefoneRevenue, ticketMedio: telefoneOrders > 0 ? telefoneRevenue / telefoneOrders : 0 };
          return c;
        })
      };
    }
    if (store.name === 'Joaquina Milanesas') {
      return store;
    }
    return store;
  }) || [];

  const totalRevenueWithManual = storesWithManual.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalOrdersWithManual = storesWithManual.reduce((sum, s) => sum + s.totalOrders, 0);

  // Fallback to overview if non-admin tries to access admin tabs
  React.useEffect(() => {
    if (currentUser.role !== 'ADMIN' && (activeTab === 'input' || activeTab === 'users')) {
      setActiveTab('overview');
    }
  }, [activeTab, currentUser.role]);

  // --- User CRUD Handlers ---
  const fetchUsers = async () => {
    if (!authUser) return;
    const { data, error } = await supabase.from('usuarios').select('*');
    if (!error && data) {
      setUsers(data.map(d => ({
        id: d.id,
        name: d.nome,
        email: d.email,
        role: d.cargo as any,
        status: d.status as any
      })));
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUser(true);
    
    try {
      if (editingUser) {
        // Update existing user public record
        const { error } = await supabase.from('usuarios')
          .update({
            nome: userFormData.name,
            cargo: userFormData.role,
            status: userFormData.status
          })
          .eq('id', editingUser.id);
        
        if (error) throw error;
        
      } else {
        // Create new auth user
        if (!userFormData.password || userFormData.password.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }

        const { error } = await supabase.auth.signUp({
          email: userFormData.email,
          password: userFormData.password,
          options: {
            data: {
              nome: userFormData.name,
              cargo: userFormData.role
            }
          }
        });

        if (error) throw error;
        
        // Let the trigger handle the public.usuarios insert, we just need to update auth user metadata role
        // However, we wait a moment for the trigger to fire, then update the explicit role/status if it differs from default
        setTimeout(async () => {
           await supabase.from('usuarios').update({ cargo: userFormData.role, status: userFormData.status }).eq('email', userFormData.email);
           fetchUsers();
        }, 1000);
      }
      
      await fetchUsers();
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsSavingUser(true);
    try {
       // Since only Admins can delete Auth users via Admin API we just inactivate them in the public table
       const { error } = await supabase.from('usuarios').update({ status: 'INATIVO' }).eq('id', userToDelete);
       if (error) throw error;
       
       await fetchUsers();
       setIsConfirmModalOpen(false);
       setUserToDelete(null);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSavingUser(false);
    }
  };

  // Helpers passed to Input
  const currentInput = draftManualData[selectedInputMonth] || getEmptyManualData();
  const updateManualField = (field: string, value: any) => {
    setDraftManualData(prev => ({
      ...prev,
      [selectedInputMonth]: {
        ...currentInput,
        [field]: value
      }
    }));
  };
  const saveManualData = async () => {
    const dataToSave = draftManualData[selectedInputMonth] || getEmptyManualData();
    const success = await saveInputManualToDB(selectedInputMonth, dataToSave);
    if (success) {
      setManualData(prev => ({ ...prev, [selectedInputMonth]: dataToSave }));
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } else {
      alert("Erro ao salvar dados manuais no servidor.");
    }
  };

  if (authLoading || isLoadingDB) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-primary/20 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          x: isSidebarOpen ? 0 : -300 
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-100 flex flex-col z-40 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]"
        )}
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">
              Joaquina<span className="text-primary">.PRO</span>
            </h1>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mt-1">Admin Dashboard</p>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarItem icon={LayoutDashboard} label="Visão Geral" active={activeTab === 'overview'} onClick={() => { setActiveTab('overview'); }} />
          <SidebarItem icon={TrendingUp} label="Faturamento" active={activeTab === 'sales'} onClick={() => { setActiveTab('sales'); }} />
          <SidebarItem icon={Bike} label="Entregadores" active={activeTab === 'couriers'} onClick={() => { setActiveTab('couriers'); }} />
          <SidebarItem icon={ListOrdered} label="Cardápio" active={activeTab === 'menu'} onClick={() => { setActiveTab('menu'); }} />
          <SidebarItem icon={Star} label="Top Clientes" active={activeTab === 'customers'} onClick={() => { setActiveTab('customers'); }} />
          
          {currentUser.role === 'ADMIN' && (
            <>
              <div className="pt-8 pb-4">
                <p className="px-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sistema</p>
              </div>
              <SidebarItem icon={ListOrdered} label="Input Manual" active={activeTab === 'input'} onClick={() => {
                setDraftManualData(manualData);
                setActiveTab('input');
              }} />
              <SidebarItem icon={UsersIcon} label="Usuários" active={activeTab === 'users'} onClick={() => { setActiveTab('users'); }} />
            </>
          )}
        </nav>

        <div className="mt-auto px-10 py-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Atualizado em</span>
          <span className="font-black text-slate-700">{currentManual.lastUpdatedAt ? new Date(currentManual.lastUpdatedAt).toLocaleDateString('pt-BR') : '---'}</span>
        </div>

        <div className="p-4 m-4 mt-0 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-slate-600 border border-slate-100">
              {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentUser.role}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="w-full py-2 px-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden bg-[#f8fafc] transition-all duration-300",
        isSidebarOpen && "lg:ml-72"
      )}>
        {/* Header */}
        <header className="h-20 lg:h-24 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 hover:bg-slate-50 rounded-xl text-slate-600"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight flex items-center gap-3">
              {activeTab === 'overview' && 'Visão Geral'}
              {activeTab === 'sales' && 'Faturamento'}
              {activeTab === 'couriers' && 'Performance Entregadores'}
              {activeTab === 'menu' && 'Cardápio'}
              {activeTab === 'customers' && 'Top Clientes'}
              {activeTab === 'input' && 'Inserção de Dados'}
              {activeTab === 'users' && 'Gestão de Usuários'}
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Acompanhamento e gestão em tempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
            <div className="relative group hidden md:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar pedidos, entregadores..." 
                className="pl-11 pr-4 py-2.5 bg-slate-50 border-transparent rounded-full text-sm font-medium focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all w-64 text-slate-700"
              />
            </div>

            {/* Global Date Selector (Visible except on Input/Users tabs) */}
            {activeTab !== 'input' && activeTab !== 'users' && availableYears.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none py-2 px-4 text-sm font-bold focus:ring-0 text-slate-700 cursor-pointer appearance-none pl-4 pr-8"
                  style={{ background: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 0.5rem center/1.5rem 1.5rem' }}
                >
                  {getMonthsForYear(selectedYear).map(m => (
                    <option key={m} value={m} className="font-sans font-medium">{m}</option>
                  ))}
                </select>
                <div className="w-px h-6 bg-slate-200" />
                <select 
                  value={selectedYear}
                  onChange={(e) => {
                    const year = Number(e.target.value);
                    setSelectedYear(year);
                    const months = getMonthsForYear(year);
                    if (!months.includes(selectedMonth)) {
                      setSelectedMonth(months[0]);
                    }
                  }}
                  className="bg-transparent border-none py-2 px-4 text-sm font-bold focus:ring-0 text-slate-700 cursor-pointer appearance-none pl-4 pr-8"
                  style={{ background: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 0.5rem center/1.5rem 1.5rem' }}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y} className="font-sans font-medium">{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 pb-24">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <Overview 
                currentMonthData={currentMonthData}
                overviewCourierSort={overviewCourierSort}
                toggleOverviewSort={(key) => setOverviewCourierSort(prev => ({
                  key,
                  dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc'
                }))}
                dashboardCategories={dashboardCategories}
                activeDashboardCat={activeDashboardCat}
                setActiveDashboardCat={setActiveDashboardCat}
                setActiveTab={setActiveTab}
                storesWithManual={storesWithManual}
                totalRevenueWithManual={totalRevenueWithManual}
                totalOrdersWithManual={totalOrdersWithManual}
                last30DaysCouriers={last30DaysCouriers}
                topNeighborhoods={currentMonthData?.topNeighborhoods || []}
                lastUpdatedAt={currentManual.lastUpdatedAt}
                dbData={dbData}
                manualData={manualData}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            )}
            
            {activeTab === 'sales' && (
              <Sales 
                currentMonthData={currentMonthData}
                storesWithManual={storesWithManual}
                totalRevenueWithManual={totalRevenueWithManual}
                totalOrdersWithManual={totalOrdersWithManual}
                currentManualSales={currentManualSales}
                dbData={dbData}
                manualData={manualData}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                rawVendas={rawVendas}
                rawMilanesasFaturamento={rawMilanesasFaturamento}
              />
            )}

            {activeTab === 'couriers' && (
              <Couriers 
                currentMonthData={currentMonthData}
                courierSort={courierSort}
                setCourierSort={setCourierSort}
                setSelectedCourier={setSelectedCourier}
                last30DaysCouriers={last30DaysCouriers}
              />
            )}

            {activeTab === 'menu' && (
              <Menu 
                currentMenuCategories={{
                  joaquina: joaquinaMenuCategoriesWithDB,
                  milanesas: milanesasMenuCategoriesWithDB
                }}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'input' && (
              <InputPage 
                availableMonths={availableMonths}
                selectedInputMonth={selectedInputMonth}
                setSelectedInputMonth={setSelectedInputMonth}
                draftManualData={draftManualData}
                setDraftManualData={setDraftManualData}
                currentInput={currentInput}
                updateManual={updateManualField}
                saveManualData={saveManualData}
                showSaveSuccess={showSaveSuccess}
                setIsAddMonthModalOpen={setIsAddMonthModalOpen}
              />
            )}

            {activeTab === 'users' && (
              <UsersPage 
                users={users}
                currentUser={currentUser}
                setIsUserModalOpen={setIsUserModalOpen}
                setEditingUser={setEditingUser}
                setUserFormData={setUserFormData}
                setUserToDelete={setUserToDelete}
                setIsConfirmModalOpen={setIsConfirmModalOpen}
              />
            )}

            {activeTab === 'customers' && (
              <Customers rawVendas={rawVendas} />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Specific Modals (Left intact for now - can be pulled out if needed later) */}
      <Modal 
        isOpen={selectedCourier !== null} 
        onClose={() => setSelectedCourier(null)}
        title={selectedCourier ? `Detalhes: ${selectedCourier.name}` : ''}
      >
        {selectedCourier && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-sm font-bold text-slate-500 mb-1">Entregas no Período</p>
                <p className="text-2xl font-black">{selectedCourier.totalDeliveries}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-sm font-bold text-slate-500 mb-1">Faturamento Gerado</p>
                <p className="text-2xl font-black text-primary">R$ {selectedCourier.earnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 uppercase text-sm tracking-tight text-slate-500">Histórico de Entregas</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {selectedCourier.rawDeliveries.map((delivery, idx) => (
                  <div key={idx} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{delivery.created}</span>
                        <p className="font-bold text-sm mt-0.5">{delivery.customer}</p>
                      </div>
                      <span className="font-black text-primary text-sm">R$ {delivery.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5"><Bike className="w-3.5 h-3.5" /> {delivery.destination}</p>
                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-50">
                      <span className="text-xs font-medium text-slate-500"><b className="text-slate-700">Canal:</b> {delivery.requester}</span>
                      <span className="text-xs font-medium text-slate-500"><b className="text-slate-700">Origem:</b> {delivery.orderId.startsWith('IF') ? 'IFOOD' : 'JOTA JÁ'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nome</label>
            <input 
              type="text" 
              required
              value={userFormData.name}
              onChange={e => setUserFormData({...userFormData, name: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              placeholder="Nome do usuário"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              disabled={!!editingUser}
              value={userFormData.email}
              onChange={e => setUserFormData({...userFormData, email: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm disabled:opacity-50"
              placeholder="email@exemplo.com"
            />
          </div>

          {!editingUser && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Senha provisória</label>
              <input 
                type="text" 
                required
                minLength={6}
                value={userFormData.password || ''}
                onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                placeholder="No mínimo 6 caracteres"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Cargo</label>
              <select 
                value={userFormData.role}
                onChange={e => setUserFormData({...userFormData, role: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              >
                <option value="ADMIN">Administrador (Acesso Total)</option>
                <option value="GERENTE">Gerente de Loja</option>
                <option value="CAIXA">Operador / Caixa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
              <select 
                value={userFormData.status}
                onChange={e => setUserFormData({...userFormData, status: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Bloqueado</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingUser}
              className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isSavingUser && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingUser ? 'Salvar Edição' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Inativar Usuário"
      >
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">
            Tem certeza que deseja desativar este usuário? Ele perderá acesso ao sistema imediatamente, mas o histórico dele será mantido.
          </p>
          <div className="pt-4 flex gap-3">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteUser}
              disabled={isSavingUser}
              className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isSavingUser && <Loader2 className="w-4 h-4 animate-spin" />}
              Desativar
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
