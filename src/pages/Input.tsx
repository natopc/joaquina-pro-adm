import React from 'react';
import { motion } from 'framer-motion';
import { Save, Plus, X, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface InputProps {
  availableMonths: string[];
  selectedInputMonth: string;
  setSelectedInputMonth: (val: string) => void;
  draftManualData: any;
  setDraftManualData: (val: any) => void;
  currentInput: any;
  updateManual: (field: string, value: any) => void;
  saveManualData: () => void;
  showSaveSuccess: boolean;
  setIsAddMonthModalOpen: (val: boolean) => void;
}

export const InputPage: React.FC<InputProps> = ({
  availableMonths,
  selectedInputMonth,
  setSelectedInputMonth,
  draftManualData,
  setDraftManualData,
  currentInput,
  updateManual,
  saveManualData,
  showSaveSuccess,
  setIsAddMonthModalOpen
}) => {

  const addCategory = (store: 'joaquinaCategories') => {
    const newCat = { 
      id: Date.now().toString(), 
      name: `Nova Categoria ${currentInput[store].length + 1}`, 
      items: [],
      showOnDashboard: true
    };
    updateManual(store, [...currentInput[store], newCat]);
  };

  const removeCategory = (store: 'joaquinaCategories', id: string) => {
    updateManual(store, currentInput[store].filter((c: any) => c.id !== id));
  };

  const updateCategory = (store: 'joaquinaCategories', id: string, field: string, value: any) => {
    updateManual(store, currentInput[store].map((c: any) => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const addItemToCategory = (store: 'joaquinaCategories', catId: string) => {
    updateManual(store, currentInput[store].map((c: any) => 
      c.id === catId ? { ...c, items: [...c.items, { name: '', sales: 0 }] } : c
    ));
  };

  const removeItemFromCategory = (store: 'joaquinaCategories', catId: string, idx: number) => {
    updateManual(store, currentInput[store].map((c: any) => 
      c.id === catId ? { ...c, items: c.items.filter((_: any, i: number) => i !== idx) } : c
    ));
  };

  const updateItemInCategory = (store: 'joaquinaCategories', catId: string, idx: number, field: 'name' | 'sales', value: any) => {
    updateManual(store, currentInput[store].map((c: any) => 
      c.id === catId ? { 
        ...c, 
        items: c.items.map((item: any, i: number) => i === idx ? { ...item, [field]: value } : item) 
      } : c
    ));
  };

  const renderCategoryList = (storeName: string, storeKey: 'joaquinaCategories') => (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mt-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="font-black uppercase text-sm tracking-tight mb-2">Ranking do Cardápio: {storeName}</h4>
          <p className="text-xs text-slate-400 font-bold">Gerencie as categorias e os itens mais vendidos</p>
        </div>
        <button 
          onClick={() => addCategory(storeKey)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      <div className="space-y-6">
        {currentInput[storeKey].map((cat: any) => (
          <div key={cat.id} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex justify-between items-center bg-slate-50 -mx-6 -mt-6 p-4 rounded-t-2xl border-b border-slate-200 mb-4">
              <div className="flex flex-1 items-center gap-4">
                <input 
                  type="text"
                  value={cat.name}
                  onChange={e => updateCategory(storeKey, cat.id, 'name', e.target.value)}
                  className="bg-transparent border-none p-0 text-lg font-bold text-slate-800 focus:ring-0 placeholder:text-slate-300 min-w-[200px]"
                  placeholder="Nome da Categoria..."
                />
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={cat.showOnDashboard}
                    onChange={e => updateCategory(storeKey, cat.id, 'showOnDashboard', e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  Destacar no Dashboard
                </label>
              </div>
              <button onClick={() => removeCategory(storeKey, cat.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {cat.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="flex-1 flex gap-4">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={item.name}
                        onChange={e => updateItemInCategory(storeKey, cat.id, idx, 'name', e.target.value)}
                        placeholder="Nome do produto"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="w-32">
                      <input 
                        type="number" 
                        value={item.sales || ''}
                        onChange={e => updateItemInCategory(storeKey, cat.id, idx, 'sales', Number(e.target.value))}
                        placeholder="Vendas"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeItemFromCategory(storeKey, cat.id, idx)} className="text-slate-400 hover:text-red-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => addItemToCategory(storeKey, cat.id)}
                className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 mt-2"
              >
                <Plus className="w-4 h-4" /> Adicionar Produto
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <select
              value={selectedInputMonth}
              onChange={(e) => setSelectedInputMonth(e.target.value)}
              className="bg-transparent border-none py-2 px-4 text-sm font-bold focus:ring-0 text-slate-700 cursor-pointer appearance-none pl-4 pr-8 max-w-[200px]"
              style={{ background: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 0.5rem center/1.5rem 1.5rem' }}
            >
              {availableMonths.map(month => (
                <option key={month} value={month} className="font-sans font-medium">{month}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setIsAddMonthModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo
          </button>
        </div>
        
        <button
          onClick={saveManualData}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 min-w-[140px] justify-center"
        >
          {showSaveSuccess ? (
            <span className="text-green-400 flex items-center gap-2">✔ Salvo!</span>
          ) : (
            <><Save className="w-5 h-5" /> Salvar</>
          )}
        </button>
      </div>

      <div className="flex justify-end pr-2">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-primary/50 transition-colors">
          Atualizado em:
          <input 
            type="date" 
            value={currentInput.lastUpdatedAt || ''}
            onChange={e => updateManual('lastUpdatedAt', e.target.value)}
            className="border-none bg-transparent text-slate-900 font-black p-0 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[100px] -z-10" />
          <h4 className="font-black uppercase text-sm tracking-tight mb-2 text-orange-600">Marketing (Repediu)</h4>
          <p className="text-xs text-slate-400 font-bold mb-6">Preencha os resultados das campanhas</p>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Faturamento (R$)</label>
              <input 
                type="number" 
                value={currentInput.repediuRevenue || ''}
                onChange={e => updateManual('repediuRevenue', Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-slate-700"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Qtd de Pedidos</label>
              <input 
                type="number" 
                value={currentInput.repediuOrders || ''}
                onChange={e => updateManual('repediuOrders', Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-slate-700"
                placeholder="0"
              />
            </div>
          </div>
        </div>


      </div>
    </motion.div>
  );
};
