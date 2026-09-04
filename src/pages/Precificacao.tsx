import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Edit2,
  X,
  Plus,
  DollarSign,
  Settings,
  Trash2,
  ListOrdered
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';

const logActivity = (msg: string) => console.log(msg);

export function Precificacao() {
  const [precificacao, setPrecificacao] = useState<any[]>([]);
  const [fichas, setFichas] = useState<any[]>([]);
  const [estoque, setEstoque] = useState<any[]>([]);
  const [isComboMode, setIsComboMode] = useState(false);
  const [comboItems, setComboItems] = useState<any[]>([]);
  const [editPriceItem, setEditPriceItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configData, setConfigData] = useState({
    card_tax: localStorage.getItem('precificacao_default_card_tax') || '0,00',
    platform_tax: localStorage.getItem('precificacao_default_platform_tax') || '0,00',
    advance_tax: localStorage.getItem('precificacao_default_advance_tax') || '0,00',
    target_margin: localStorage.getItem('precificacao_default_target_margin') || '0,00'
  });

  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    card_tax: '',
    platform_tax: '',
    advance_tax: '',
    target_margin: '',
    sale_price: ''
  });

  useEffect(() => {
    fetchPrecificacao();
  }, []);

  const fetchPrecificacao = async () => {
    setLoading(true);
    const [precData, fichasData, estoqueData] = await Promise.all([
      supabase.from('precificacao').select('*').order('name', { ascending: true }),
      supabase.from('fichas').select('*').order('name', { ascending: true }),
      supabase.from('estoque').select('*').order('name', { ascending: true })
    ]);
    
    if (precData.data) setPrecificacao(precData.data);
    if (fichasData.data) setFichas(fichasData.data);
    if (estoqueData.data) {
      const directItems = estoqueData.data.filter((e: any) => e.unit && e.unit.includes('direto'));
      const uniqueDirect = Array.from(new Map(directItems.map(item => [item.name, item])).values());
      setEstoque(uniqueDirect);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isComboMode) {
      const totalComboCost = comboItems.reduce((acc, curr) => acc + curr.cost, 0);
      setFormData(prev => ({ ...prev, cost: totalComboCost.toFixed(2).replace('.', ',') }));
    }
  }, [comboItems, isComboMode]);

  const parseNumber = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(val.toString().replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
  };

  const availableItems = [
    ...fichas.map(f => ({ name: f.name, cost: parseNumber(f.cost) })),
    ...estoque.map(e => ({ name: e.name, cost: parseNumber(e.last_purchase_price) }))
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val: number) => {
    return val.toFixed(1) + '%';
  };

  const currencyMask = (value: string) => {
    let v = value.replace(/\D/g, '');
    v = (parseInt(v) / 100).toFixed(2) + '';
    v = v.replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return v === 'NaN' || v === '0,00' ? '' : v;
  };

  const handleCurrencyChange = (field: string, val: string) => {
    setFormData({ ...formData, [field]: currencyMask(val) });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const found = availableItems.find(a => a.name.toUpperCase() === val.toUpperCase());
    
    if (found && !isComboMode) {
      setFormData(prev => ({ 
        ...prev, 
        name: val, 
        cost: found.cost.toFixed(2).replace('.', ',') 
      }));
    } else {
      setFormData(prev => ({ ...prev, name: val }));
    }
  };

  const calcularSugerido = (cost: number, card: number, platform: number, advance: number, margin: number) => {
    const totalTaxesAndMargin = (card + platform + advance + margin) / 100;
    if (totalTaxesAndMargin >= 1) return cost * 2;
    return cost / (1 - totalTaxesAndMargin);
  };

  const calcularMargemAtual = (salePrice: number, cost: number, card: number, platform: number, advance: number) => {
    if (salePrice <= 0) return 0;
    const totalTaxes = (card + platform + advance) / 100;
    const netRevenue = salePrice * (1 - totalTaxes);
    const profit = netRevenue - cost;
    return (profit / salePrice) * 100;
  };

  const avgMargin = precificacao.length > 0 
    ? precificacao.reduce((acc, curr) => acc + calcularMargemAtual(curr.sale_price, curr.cost, curr.card_tax, curr.platform_tax, curr.advance_tax), 0) / precificacao.length
    : 0;

  const itemsAbaixoMargin = precificacao.filter(item => {
    const atual = calcularMargemAtual(item.sale_price, item.cost, item.card_tax, item.platform_tax, item.advance_tax);
    return atual < item.target_margin;
  }).length;

  const totalCost = precificacao.reduce((acc, curr) => acc + Number(curr.cost), 0);

  const savePrecificacao = async () => {
    const cost = parseNumber(formData.cost);
    const card_tax = parseNumber(formData.card_tax);
    const platform_tax = parseNumber(formData.platform_tax);
    const advance_tax = parseNumber(formData.advance_tax);
    const target_margin = parseNumber(formData.target_margin);
    const sale_price = parseNumber(formData.sale_price);

    const combo_items = isComboMode ? comboItems : [];

    if (editPriceItem) {
      const { error } = await supabase
        .from('precificacao')
        .update({ name: formData.name, cost, card_tax, platform_tax, advance_tax, target_margin, sale_price, combo_items })
        .eq('id', editPriceItem.id);
      
      if (!error) {
        logActivity(`Precificação atualizada: ${formData.name}`);
        setEditPriceItem(null);
        setIsModalOpen(false);
        fetchPrecificacao();
      }
    } else {
      const { error } = await supabase
        .from('precificacao')
        .insert([{
          name: formData.name,
          cost, card_tax, platform_tax, advance_tax, target_margin, sale_price, combo_items
        }]);
      
      if (!error) {
        logActivity(`Nova regra de precificação criada: ${formData.name}`);
        setIsModalOpen(false);
        fetchPrecificacao();
      }
    }
  };

  const promptDelete = () => {
    if (!editPriceItem) return;
    setItemToDelete(editPriceItem);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    const { error } = await supabase
      .from('precificacao')
      .delete()
      .eq('id', itemToDelete.id);
    
    if (!error) {
      logActivity(`Precificação excluída: ${itemToDelete.name}`);
      setEditPriceItem(null);
      setItemToDelete(null);
      setIsModalOpen(false);
      fetchPrecificacao();
    }
  };

  const saveDefaultConfig = () => {
    localStorage.setItem('precificacao_default_card_tax', configData.card_tax);
    localStorage.setItem('precificacao_default_platform_tax', configData.platform_tax);
    localStorage.setItem('precificacao_default_advance_tax', configData.advance_tax);
    localStorage.setItem('precificacao_default_target_margin', configData.target_margin);
    setIsConfigModalOpen(false);
    logActivity('Taxas padrão de marketplace atualizadas');
  };

  const openNewModal = () => {
    const defaultCard = localStorage.getItem('precificacao_default_card_tax') || '0,00';
    const defaultPlatform = localStorage.getItem('precificacao_default_platform_tax') || '0,00';
    const defaultAdvance = localStorage.getItem('precificacao_default_advance_tax') || '0,00';
    const defaultMargin = localStorage.getItem('precificacao_default_target_margin') || '0,00';

    setFormData({ 
      name: '', 
      cost: '', 
      card_tax: defaultCard, 
      platform_tax: defaultPlatform, 
      advance_tax: defaultAdvance, 
      target_margin: defaultMargin, 
      sale_price: '' 
    });
    setEditPriceItem(null);
    setIsComboMode(false);
    setComboItems([]);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    const isCombo = item.combo_items && Array.isArray(item.combo_items) && item.combo_items.length > 0;

    setFormData({ 
      name: item.name, 
      cost: item.cost.toFixed(2).replace('.', ','), 
      card_tax: item.card_tax.toString().replace('.', ','), 
      platform_tax: item.platform_tax.toString().replace('.', ','), 
      advance_tax: item.advance_tax.toString().replace('.', ','), 
      target_margin: item.target_margin.toString().replace('.', ','), 
      sale_price: item.sale_price > 0 ? item.sale_price.toFixed(2).replace('.', ',') : ''
    });
    setEditPriceItem(item);
    
    if (isCombo) {
      setIsComboMode(true);
      const initialComboItems = item.combo_items.map((cItem: any) => {
        const found = availableItems.find(a => a.name.toUpperCase() === cItem.name.toUpperCase());
        return { name: cItem.name, cost: found ? found.cost : 0 };
      });
      setComboItems(initialComboItems);
    } else {
      setIsComboMode(false);
      setComboItems([]);
    }
    setIsModalOpen(true);
  };

  const formCost = parseNumber(formData.cost);
  const formCard = parseNumber(formData.card_tax);
  const formPlatform = parseNumber(formData.platform_tax);
  const formAdvance = parseNumber(formData.advance_tax);
  const formMargin = parseNumber(formData.target_margin);
  const formSalePrice = parseNumber(formData.sale_price);

  const suggestedPriceModal = calcularSugerido(formCost, formCard, formPlatform, formAdvance, formMargin);
  const baseCalculoTaxas = formSalePrice > 0 ? formSalePrice : suggestedPriceModal;

  const cardAbs = baseCalculoTaxas * (formCard / 100);
  const platformAbs = baseCalculoTaxas * (formPlatform / 100);
  const advanceAbs = baseCalculoTaxas * (formAdvance / 100);

  const totalTaxesPercent = (formCard + formPlatform + formAdvance) / 100;
  
  const expectedProfitSuggested = suggestedPriceModal - formCost - (suggestedPriceModal * totalTaxesPercent);
  const expectedProfitPracticed = formSalePrice > 0 ? (formSalePrice - formCost - (formSalePrice * totalTaxesPercent)) : 0;

  const totalComboSalePrice = isComboMode ? comboItems.reduce((acc, item) => {
    const prec = precificacao.find(p => p.name.toUpperCase() === item.name.toUpperCase());
    return acc + (prec ? Number(prec.sale_price) : 0);
  }, 0) : 0;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Precificação Inteligente</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Otimização de margem com cálculo de taxas (Markup).</p>
        </div>
        <div className="flex gap-3 items-center">
          <button 
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors" 
            onClick={() => setIsConfigModalOpen(true)}
            title="Configurar Taxas Padrão"
          >
            <Settings size={20} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity" onClick={openNewModal}>
            <Plus size={18} />
            Nova Precificação
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Itens"
          value={precificacao.length.toString()}
          icon={ListOrdered}
          colorClass="text-slate-700"
        />
        <StatCard 
          title="Margem Média"
          value={formatPercent(avgMargin)}
          icon={TrendingUp}
          colorClass="text-green-500"
        />
        <StatCard 
          title="Abaixo da Margem"
          value={itemsAbaixoMargin.toString()}
          icon={TrendingDown}
          colorClass={itemsAbaixoMargin > 0 ? "text-red-500" : "text-green-500"}
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
          <h3 className="text-lg font-black tracking-tight">Análise Comparativa de Preços</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Produto / Custo</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Margem Desejada</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Margem Atual</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">CMV</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Preço Atual</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Preço Sugerido</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {precificacao.map((item) => {
                const currentMargin = calcularMargemAtual(item.sale_price, item.cost, item.card_tax, item.platform_tax, item.advance_tax);
                const isNegative = currentMargin < item.target_margin;
                const marginDiff = currentMargin - item.target_margin;
                const suggestedPrice = calcularSugerido(item.cost, item.card_tax, item.platform_tax, item.advance_tax, item.target_margin);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Custo: {formatCurrency(item.cost)}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-sm text-slate-700">{formatPercent(item.target_margin)}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold text-sm ${isNegative ? 'text-red-500' : 'text-green-500'}`}>{formatPercent(currentMargin)}</span>
                        <span className={`text-[10px] font-bold ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
                          {marginDiff > 0 ? '+' : ''}{formatPercent(marginDiff)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-black text-sm text-blue-600">
                        {item.sale_price > 0 ? ((item.cost / item.sale_price) * 100).toFixed(1) + '%' : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.sale_price > 0 ? (
                        <span className="font-black text-sm text-slate-900">{formatCurrency(item.sale_price)}</span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Não definido</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-700">
                        {formatCurrency(suggestedPrice)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-primary transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg" onClick={() => openEditModal(item)}>
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {precificacao.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-400 font-medium text-sm py-8">Nenhum produto precificado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <datalist id="fichas-datalist">
        {availableItems.map(f => (
          <option key={f.name} value={f.name} />
        ))}
      </datalist>

            {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editPriceItem ? 'Ajustar Precificação' : 'Nova Precificação'}
        >
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-slate-700">Nome do Produto</label>
                <button 
                  className="px-2 py-1 text-xs font-bold text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors" 
                  onClick={() => setIsComboMode(!isComboMode)}
                >
                  {isComboMode ? 'Desativar Combo' : '+ COMBO'}
                </button>
              </div>
              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium" placeholder="Ex: Burger Clássico" list="fichas-datalist"
                value={formData.name} onChange={handleNameChange} />
              
              {isComboMode && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-slate-700">Itens do Combo</label>
                    <button className="px-2 py-1 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setComboItems([...comboItems, { name: '', cost: 0 }])}>
                      + Item
                    </button>
                  </div>
                  {comboItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 mb-2">
                      <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" placeholder="Nome do item" list="fichas-datalist"
                        value={item.name} onChange={e => {
                          const val = e.target.value;
                          const found = availableItems.find(a => a.name.toUpperCase() === val.toUpperCase());
                          const newItems = [...comboItems];
                          newItems[idx].name = val;
                          if (found) newItems[idx].cost = found.cost;
                          setComboItems(newItems);
                        }} />
                      <div className="flex items-center px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold min-w-[100px]">
                        {formatCurrency(item.cost)}
                      </div>
                      <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent" onClick={() => {
                        const newItems = [...comboItems];
                        newItems.splice(idx, 1);
                        setComboItems(newItems);
                      }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {comboItems.length === 0 && <p className="text-slate-400 text-sm text-center font-medium">Nenhum item no combo.</p>}
                  <p className="text-xs text-slate-500 mt-2 font-medium">O custo base do combo será calculado automaticamente somando os itens conhecidos.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-bold text-slate-700">Custo do Produto (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">R$</span>
                  <input type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium" placeholder="0,00"
                    value={formData.cost} onChange={e => handleCurrencyChange('cost', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-bold text-slate-700">Margem Desejada (%)</label>
                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium" placeholder="0,00"
                  value={formData.target_margin} onChange={e => setFormData({...formData, target_margin: e.target.value})} />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Taxas e descontos Marketplace (Ifood, 99, Keeta)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-600">Taxa Cartão (%)</label>
                  <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" placeholder="0,00"
                    value={formData.card_tax} onChange={e => setFormData({...formData, card_tax: e.target.value})} />
                  <div className="text-xs text-slate-400 mt-1 font-medium">{formatCurrency(cardAbs)}</div>
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-600">Plataforma (%)</label>
                  <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" placeholder="0,00"
                    value={formData.platform_tax} onChange={e => setFormData({...formData, platform_tax: e.target.value})} />
                  <div className="text-xs text-slate-400 mt-1 font-medium">{formatCurrency(platformAbs)}</div>
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-600">Adiantamento (%)</label>
                  <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" placeholder="0,00"
                    value={formData.advance_tax} onChange={e => setFormData({...formData, advance_tax: e.target.value})} />
                  <div className="text-xs text-slate-400 mt-1 font-medium">{formatCurrency(advanceAbs)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="p-4 bg-green-50/50 rounded-xl border border-green-100">
                <label className="block mb-2 text-sm font-bold text-green-900">Preço Sugerido (Ideal)</label>
                <div className="text-2xl font-black text-green-700">{formatCurrency(suggestedPriceModal)}</div>
                <div className="mt-3 p-3 bg-white rounded-lg border border-green-200/60 shadow-sm">
                  <span className="block text-xs font-bold text-slate-500 mb-1">Lucro Esperado:</span>
                  <span className="block text-sm font-black text-green-600">{formatCurrency(expectedProfitSuggested)}</span>
                </div>
              </div>
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <label className="block mb-2 text-sm font-bold text-blue-900">Preço Praticado</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">R$</span>
                  <input type="text" className="w-full pl-10 pr-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-bold" placeholder="0,00"
                    value={formData.sale_price} onChange={e => handleCurrencyChange('sale_price', e.target.value)} />
                </div>
                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200/60 shadow-sm">
                  <span className="block text-xs font-bold text-slate-500 mb-1">Lucro Esperado:</span>
                  <span className={`block text-sm font-black ${formSalePrice > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                    {formSalePrice > 0 ? formatCurrency(expectedProfitPracticed) : 'R$ 0,00'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              {editPriceItem ? (
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors" onClick={promptDelete}>
                  <Trash2 size={18} />
                  Excluir
                </button>
              ) : <div></div>}
              <div className="flex gap-3">
                <button className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-sm" onClick={savePrecificacao}>Salvar Precificação</button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {itemToDelete && (
        <Modal
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          title="Excluir Precificação"
        >
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Excluir Precificação</h2>
            <p className="text-slate-500 font-medium">
              Tem certeza que deseja excluir a precificação de <strong className="text-slate-800">{itemToDelete.name}</strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <button className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm" onClick={() => setItemToDelete(null)}>Cancelar</button>
            <button className="px-6 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-sm" onClick={confirmDelete}>Sim, excluir</button>
          </div>
        </Modal>
      )}

      {isConfigModalOpen && (
        <Modal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          title="Taxas Padrão Marketplace"
        >
          <div className="space-y-6">
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Defina os valores padrão de taxas e margens que serão preenchidos automaticamente ao criar novas regras de precificação.
            </p>

            <div>
              <label className="block mb-2 text-sm font-bold text-slate-700">Margem Desejada Padrão (%)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium" 
                placeholder="0,00"
                value={configData.target_margin} 
                onChange={e => setConfigData({...configData, target_margin: e.target.value})} 
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Taxas e Descontos Marketplace</h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-600">Taxa Cartão Padrão (%)</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" 
                    placeholder="0,00"
                    value={configData.card_tax} 
                    onChange={e => setConfigData({...configData, card_tax: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-600">Taxa Plataforma Padrão (%)</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" 
                    placeholder="0,00"
                    value={configData.platform_tax} 
                    onChange={e => setConfigData({...configData, platform_tax: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-600">Adiantamento Padrão (%)</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" 
                    placeholder="0,00"
                    value={configData.advance_tax} 
                    onChange={e => setConfigData({...configData, advance_tax: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm" onClick={() => setIsConfigModalOpen(false)}>Cancelar</button>
              <button className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-sm" onClick={saveDefaultConfig}>Salvar Configurações</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
