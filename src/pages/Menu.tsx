import React from 'react';
import { motion } from 'framer-motion';
import { Utensils, ListOrdered, ArrowDownUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface MenuProps {
  currentMenuCategories: {
    joaquina: any[];
    milanesas: any[];
  };
  setActiveTab: (tab: any) => void;
}

export const Menu: React.FC<MenuProps> = ({
  currentMenuCategories,
  setActiveTab
}) => {
  const [activeStore, setActiveStore] = React.useState<'joaquina' | 'milanesas'>('joaquina');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  const activeCategoriesToRender = currentMenuCategories[activeStore] || [];

  const getSortedItems = React.useCallback((items: any[]) => {
    if (!items) return [];
    return [...items].sort((a: any, b: any) => {
      const salesA = Number(a.sales) || 0;
      const salesB = Number(b.sales) || 0;
      return sortOrder === 'desc' ? salesB - salesA : salesA - salesB;
    });
  }, [sortOrder]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
        <div className="p-8 border-b border-slate-50 flex flex-col gap-6 bg-slate-50/30">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black uppercase tracking-tight">Performance dos Produtos</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveStore('joaquina')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                  activeStore === 'joaquina'
                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                Joaquina
              </button>
              <button
                onClick={() => setActiveStore('milanesas')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                  activeStore === 'milanesas'
                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                Joaquina Milanesas
              </button>
            </div>
          </div>
          
        </div>
        
        <div className="flex-1 p-8 bg-slate-50/10">
          <div className="flex justify-end mb-6">
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <ArrowDownUp className="w-4 h-4" />
              {sortOrder === 'desc' ? 'Maior para Menor' : 'Menor para Maior'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {activeCategoriesToRender.map((cat: any) => {
              const items = getSortedItems(cat.items);
              
              return (
                <div key={cat.id} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                    <h3 className="text-xl font-bold text-slate-800">{cat.name}</h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{items.length} itens</span>
                  </div>
                  
                  {items.length > 0 ? (
                    items.map((item: any, idx: number) => {
                      // Calculate the actual rank based on sort order 
                      const rank = sortOrder === 'desc' ? idx + 1 : items.length - idx;
                      return (
                        <div key={item.name} className="flex items-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                          
                          <div className="flex items-center gap-6 w-full px-2">
                            <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 border border-slate-100 text-sm shrink-0">
                              {rank}º
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-md text-slate-800 truncate" title={item.name}>{item.name}</h4>
                              {rank === 1 && sortOrder === 'desc' && (
                                <div className="inline-block mt-1 px-3 py-0.5 rounded-full bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-wider">
                                  Mais Vendido
                                </div>
                              )}
                            </div>
                            
                            <div className="text-right shrink-0">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">QTD</p>
                              <p className="text-xl font-black text-primary">{item.sales}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 py-12 bg-white rounded-2xl border border-slate-100 border-dashed">
                      <ListOrdered className="w-10 h-10 mb-4 opacity-20" />
                      <p className="text-sm font-bold">Nenhum produto cadastrado</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
