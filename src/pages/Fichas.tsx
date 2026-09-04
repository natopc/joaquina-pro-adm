import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Edit2, 
  Download, 
  Trash2, 
  FileText,
  X,
  Calculator,
  Image as ImageIcon
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Modal } from '../components/Modal';

type RecipeItem = { name: string, quantity: string, unit: string, cost: string, isManualCost: boolean };

export function Fichas() {
    const cardsRef = useRef<{[key: string]: HTMLDivElement | null}>({});
  const [fichas, setFichas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [estoque, setEstoque] = useState<any[]>([]);
  
  const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
  const [editFicha, setEditFicha] = useState<any>(null);
  const [fichaToDelete, setFichaToDelete] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({ name: '', category: '', cost: '', prep_method: '', sellPrice: '', photo_url: '', desiredCmv: '' });
  const [ingredientes, setIngredientes] = useState<RecipeItem[]>([]);
  const [insumos, setInsumos] = useState<RecipeItem[]>([]);
  const [outros, setOutros] = useState<RecipeItem[]>([]);

  const getCategoryColor = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('insumo')) return { bg: '#fef3c7', text: '#d97706' };
    if (cat.includes('burg')) return { bg: '#e0e7ff', text: '#4338ca' };
    if (cat.includes('bebida')) return { bg: '#dcfce7', text: '#15803d' };
    if (cat.includes('sobremesa')) return { bg: '#fce7f3', text: '#be185d' };
    return { bg: '#f3f4f6', text: '#4b5563' };
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [fichasRes, categoriasRes, estoqueRes] = await Promise.all([
      supabase.from('fichas').select('*, fichas_ingredientes(*), fichas_insumos(*)').order('name', { ascending: true }),
      supabase.from('categorias_ficha').select('*').order('name', { ascending: true }),
      supabase.from('estoque').select('*')
    ]);
    
    if (fichasRes.data) setFichas(fichasRes.data);
    if (categoriasRes.data) setCategorias(categoriasRes.data);
    if (estoqueRes.data) setEstoque(estoqueRes.data);
    setLoading(false);
  };

  
  const updateFichaMargin = async (id: string, newMargin: string) => {
    setFichas(prev => prev.map(f => f.id === id ? { ...f, margin: newMargin } : f));
    await supabase.from('fichas').update({ margin: newMargin }).eq('id', id);
  };

  const handleQuickMarginChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    val = (parseInt(val || '0') / 100).toFixed(2) + '';
    val = val.replace('.', ',');
    val = val.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    const formatted = val === '0,00' ? '' : `R$ ${val}`;
    setFichas(prev => prev.map(f => f.id === id ? { ...f, margin: formatted } : f));
  };

  const parseCurrency = (val: string | number) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let cleanVal = String(val).replace('R$', '').replace(/\s/g, '');
    if (cleanVal.includes(',') && cleanVal.includes('.')) {
      cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
    } else if (cleanVal.includes(',')) {
      cleanVal = cleanVal.replace(',', '.');
    }
    const num = parseFloat(cleanVal);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const calculateItemCost = (item: RecipeItem) => {
    return parseCurrency(item.cost);
  };

  useEffect(() => {
    let total = 0;
    ingredientes.forEach(ing => total += calculateItemCost(ing));
    insumos.forEach(ins => total += calculateItemCost(ins));
    outros.forEach(out => total += calculateItemCost(out));
    setFormData(prev => ({ ...prev, cost: formatCurrency(total) }));
  }, [ingredientes, insumos, outros, estoque, fichas]);

  const parseRecipeItem = (i: any): RecipeItem => {
    const parts = (i.quantity || '').split('|');
    if (parts.length >= 4) {
      return { name: i.name, quantity: parts[0], unit: parts[1], cost: parts[2], isManualCost: parts[3] === 'true' };
    }

    const num = parseFloat(i.quantity);
    const unitMatch = (i.quantity || '').replace(/[\d\.\,\s]/g, '').toLowerCase();
    const unit = ['g','ml','un'].includes(unitMatch) ? unitMatch : 'un';
    return { name: i.name, quantity: isNaN(num) ? '0' : num.toString(), unit, cost: '', isManualCost: true };
  };
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setFormData(prev => ({ ...prev, photo_url: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveFicha = async () => {
    if (editFicha) {
      const { error: fichaError } = await supabase
        .from('fichas')
        .update({
          name: formData.name,
          category: formData.category,
          cost: formData.cost,
          margin: formData.sellPrice,
          prep_method: formData.prep_method,
          photo_url: formData.photo_url
        })
        .eq('id', editFicha.id);
      
      if (!fichaError) {
        await Promise.all([
          supabase.from('fichas_ingredientes').delete().eq('ficha_id', editFicha.id),
          supabase.from('fichas_insumos').delete().eq('ficha_id', editFicha.id)
        ]);
        
        const allIngData = [];
        if (ingredientes.length > 0) {
          allIngData.push(...ingredientes.map(ing => ({ ficha_id: editFicha.id, name: ing.name, quantity: `${ing.quantity}|${ing.unit}|${ing.cost}|${ing.isManualCost}` })));
        }
        if (outros.length > 0) {
          allIngData.push(...outros.map(out => ({ ficha_id: editFicha.id, name: `[OUTRO] ${out.name}`, quantity: `${out.quantity}|${out.unit}|${out.cost}|${out.isManualCost}` })));
        }
        if (allIngData.length > 0) {
          await supabase.from('fichas_ingredientes').insert(allIngData);
        }
        
        if (insumos.length > 0) {
          const insData = insumos.map(ins => ({ ficha_id: editFicha.id, name: ins.name, quantity: `${ins.quantity}|${ins.unit}|${ins.cost}|${ins.isManualCost}` }));
          await supabase.from('fichas_insumos').insert(insData);
        }
        
      }
    } else {
      const { data: newFicha, error: fichaError } = await supabase
        .from('fichas')
        .insert([{
          name: formData.name,
          category: formData.category,
          cost: formData.cost,
          margin: formData.sellPrice,
          prep_method: formData.prep_method,
          photo_url: formData.photo_url
        }])
        .select()
        .single();
      
      if (!fichaError && newFicha) {
        const allIngData = [];
        if (ingredientes.length > 0) {
          allIngData.push(...ingredientes.map(ing => ({ ficha_id: newFicha.id, name: ing.name, quantity: `${ing.quantity}|${ing.unit}|${ing.cost}|${ing.isManualCost}` })));
        }
        if (outros.length > 0) {
          allIngData.push(...outros.map(out => ({ ficha_id: newFicha.id, name: `[OUTRO] ${out.name}`, quantity: `${out.quantity}|${out.unit}|${out.cost}|${out.isManualCost}` })));
        }
        if (allIngData.length > 0) {
          await supabase.from('fichas_ingredientes').insert(allIngData);
        }
        if (insumos.length > 0) {
          const insData = insumos.map(ins => ({ ficha_id: newFicha.id, name: ins.name, quantity: `${ins.quantity}|${ins.unit}|${ins.cost}|${ins.isManualCost}` }));
          await supabase.from('fichas_insumos').insert(insData);
        }
      }
    }
    
    setIsFichaModalOpen(false);
    setEditFicha(null);
    fetchData();
  };

  const promptDelete = (id: string, name: string) => {
    setFichaToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!fichaToDelete) return;
    await supabase.from('fichas').delete().eq('id', fichaToDelete.id);
    setFichaToDelete(null);
    fetchData();
  };

  const openNewModal = () => {
    setFormData({ name: '', category: categorias.length > 0 ? categorias[0].name : '', cost: '', prep_method: '', sellPrice: '', photo_url: '', desiredCmv: '' });
    setIngredientes([]);
    setInsumos([]);
    setOutros([]);
    setEditFicha(null);
    setIsFichaModalOpen(true);
  };

  const openEditModal = (ficha: any) => {

    
    setFormData({ 
      name: ficha.name, 
      category: ficha.category, 
      cost: ficha.cost || '', 
      prep_method: ficha.prep_method || '',
      sellPrice: ficha.margin || '',
      photo_url: ficha.photo_url || ''
    });
    const allIng = ficha.fichas_ingredientes?.map(parseRecipeItem) || [];
    const justIng = allIng.filter((i: RecipeItem) => !i.name.startsWith('[OUTRO] '));
    const justOutros = allIng.filter((i: RecipeItem) => i.name.startsWith('[OUTRO] ')).map((i: RecipeItem) => ({...i, name: i.name.replace('[OUTRO] ', '')}));

    setIngredientes(justIng);
    setOutros(justOutros);
    setInsumos(ficha.fichas_insumos?.map(parseRecipeItem) || []);
    setEditFicha(ficha);
  };



  const renderItemRow = (list: 'ingredientes'|'insumos'|'outros', item: RecipeItem, idx: number) => {
    const updateItem = (f: keyof RecipeItem, v: any) => {
      let targetList;
      if (list === 'ingredientes') targetList = [...ingredientes];
      else if (list === 'insumos') targetList = [...insumos];
      else targetList = [...outros];

      targetList[idx] = { ...targetList[idx], [f]: v };
      
      if (list === 'ingredientes') setIngredientes(targetList);
      else if (list === 'insumos') setInsumos(targetList);
      else setOutros(targetList);
    };
    
    const removeItem = () => {
      let targetList;
      if (list === 'ingredientes') targetList = [...ingredientes];
      else if (list === 'insumos') targetList = [...insumos];
      else targetList = [...outros];

      targetList.splice(idx, 1);
      
      if (list === 'ingredientes') setIngredientes(targetList);
      else if (list === 'insumos') setInsumos(targetList);
      else setOutros(targetList);
    };

    const calculatedCost = calculateItemCost(item);

    return (
      <div key={idx} className="grid grid-cols-[2fr_1fr_1.5fr_1fr_auto] gap-2">
        <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" placeholder="Nome do item" list="estoque-datalist"
          value={item.name} onChange={e => updateItem('name', e.target.value)} />
        
        <input type="number" className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" placeholder="Qtd" 
          value={item.quantity} onChange={e => updateItem('quantity', e.target.value)} />

        <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium" placeholder="Valor Unitário (R$)"
          value={item.cost} onChange={e => updateItem('cost', e.target.value)} />

        <div className="flex items-center px-3 py-2 bg-slate-100 border border-transparent text-slate-500 rounded-lg text-sm font-bold min-w-[100px]" title="Custo Total do Item">
          {formatCurrency(calculatedCost)}
        </div>

        <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent" onClick={removeItem}>
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const formatLegacyQuantity = (itemStr: string) => {
    const parts = (itemStr || '').split('|');
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    return itemStr;
  };

  const downloadPDF = async (id: string, name: string) => {
    const element = cardsRef.current[id];
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Ficha_Tecnica_${name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
    }
  };


  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Fichas Técnicas</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Gerencie os custos e processos das suas receitas automáticas.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity" onClick={openNewModal}>
          <Plus size={18} />
          CRIAR NOVA FICHA
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {fichas.map((recipe) => (
          <div key={recipe.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col" ref={el => { cardsRef.current[recipe.id] = el; }}>
            <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md" style={{ backgroundColor: getCategoryColor(recipe.category).bg, color: getCategoryColor(recipe.category).text }}>
                {recipe.category}
              </span>
              <div className="flex gap-2" data-html2canvas-ignore>
                <button className="p-2 text-slate-400 hover:text-primary transition-colors bg-white hover:bg-slate-50 rounded-lg shadow-sm border border-slate-100" title="Editar" onClick={() => openEditModal(recipe)}>
                  <Edit2 size={16} />
                </button>
                <button className="p-2 text-slate-400 hover:text-primary transition-colors bg-white hover:bg-slate-50 rounded-lg shadow-sm border border-slate-100" title="Baixar PDF" onClick={() => downloadPDF(recipe.id, recipe.name)}>
                  <Download size={16} />
                </button>
                <button className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-white hover:bg-red-50 rounded-lg shadow-sm border border-slate-100" title="Excluir" onClick={() => promptDelete(recipe.id, recipe.name)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              {recipe.photo_url && (
                <div className="w-full h-40 rounded-xl overflow-hidden mb-4 border border-slate-100 bg-slate-50">
                  <img src={recipe.photo_url} alt={recipe.name} className="w-full h-full object-cover" />
                </div>
              )}
              
              <h3 className="text-lg font-black text-slate-900 mb-4">{recipe.name}</h3>
              


              <div className="mb-4">
                <span className="block text-xs font-bold text-slate-400 mb-2">INGREDIENTES</span>
                <div className="flex flex-wrap gap-2">
                  {(recipe.fichas_ingredientes || []).filter((i:any) => i.name && !i.name.startsWith('[OUTRO] ')).map((ing: any) => (
                    <span key={ing.id} className="px-2 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-md">{ing.name} <small>({formatLegacyQuantity(ing.quantity)})</small></span>
                  ))}
                  {(!recipe.fichas_ingredientes || (recipe.fichas_ingredientes || []).filter((i:any) => i.name && !i.name.startsWith('[OUTRO] ')).length === 0) && (
                    <span className="text-slate-400 text-xs font-medium">Sem ingredientes cadastrados</span>
                  )}
                </div>
              </div>

              {((recipe.fichas_ingredientes || []).filter((i:any) => i.name && i.name.startsWith('[OUTRO] ')).length) > 0 && (
                <div className="mb-4">
                  <span className="block text-xs font-bold text-slate-400 mb-2">OUTROS (EMBALAGENS ETC)</span>
                  <div className="flex flex-wrap gap-2">
                    {(recipe.fichas_ingredientes || []).filter((i:any) => i.name && i.name.startsWith('[OUTRO] ')).map((ing: any) => (
                      <span key={ing.id} className="px-2 py-1 text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200 rounded-md">{ing.name.replace('[OUTRO] ', '')} <small>({formatLegacyQuantity(ing.quantity)})</small></span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Preço Venda</span>
                <input
                  type="text"
                  className="w-24 text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={recipe.margin || ''}
                  onChange={(e) => handleQuickMarginChange(recipe.id, e)}
                  onBlur={(e) => updateFichaMargin(recipe.id, recipe.margin)}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Custo Total</span>
                <span className="block text-sm font-black text-green-600">{recipe.cost || '-'}</span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CMV</span>
                <span className="block text-sm font-black text-blue-600">
                  {(() => {
                    const c = parseCurrency(recipe.cost);
                    const p = parseCurrency(recipe.margin);
                    return p ? ((c / p) * 100).toFixed(1) + '%' : '-';
                  })()}
                </span>
              </div>
            </div>
          </div>
        ))}
        {fichas.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 font-medium bg-white rounded-3xl border border-slate-100 border-dashed">
            Nenhuma ficha técnica cadastrada.
          </div>
        )}
      </div>

      <datalist id="estoque-datalist">
        {Array.from(new Set(estoque.map(e => e.name))).map(name => (
          <option key={name as string} value={name as string} />
        ))}
      </datalist>



      {(isFichaModalOpen || editFicha) && (
        <Modal
          isOpen={isFichaModalOpen || !!editFicha}
          onClose={() => { setIsFichaModalOpen(false); setEditFicha(null); }}
          title={editFicha ? 'Editar Ficha Técnica' : 'Criar Nova Ficha Técnica'}
        >
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left Side: Fields and Calculators */}
              <div className="space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <div>
                    <label className="block mb-1 text-sm font-bold text-slate-700">Nome da Receita</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium" placeholder="Ex: Burger Artesanal" 
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-bold text-slate-700">Categoria</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium" placeholder="Ex: Bebidas" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} list="categorias-datalist" />
                    <datalist id="categorias-datalist">
                      {categorias.map(c => <option key={c.id} value={c.name} />)}
                    </datalist>
                  </div>
                </div>

                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 flex justify-between items-center">
                    <label className="block text-sm font-bold text-green-800">Custo Total</label>
                    <div className="text-lg font-black text-green-600">{formData.cost || 'R$ 0,00'}</div>
                  </div>
              </div>

              {/* Right Side: Photo */}
              <div className="lg:col-span-1">
                <div className="flex flex-col h-full">
                  <label className="block mb-2 text-sm font-bold text-slate-700">Foto do Produto</label>
                  <div className="w-full flex-1 min-h-[220px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center overflow-hidden relative cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => document.getElementById('photo-upload')?.click()}>
                  {formData.photo_url ? (
                    <img src={formData.photo_url} alt="Produto" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <span className="text-sm font-bold">Adicionar foto</span>
                    </div>
                  )}
                  <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </div>
              </div>
            </div>
            </div>

            <div className="space-y-6">
              <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-bold text-slate-700">Ingredientes</label>
                  <button className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setIngredientes([...ingredientes, {name:'', quantity:'', unit:'un', cost:'', isManualCost:true}])}>
                    + Ingrediente
                  </button>
                </div>
                <div className="space-y-2">
                  {ingredientes.map((ing, idx) => renderItemRow('ingredientes', ing, idx))}
                  {ingredientes.length === 0 && <p className="text-slate-400 text-sm font-medium text-center py-4">Nenhum ingrediente adicionado.</p>}
                </div>
              </div>

              <div className="p-5 bg-slate-100/50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-bold text-slate-600">Outros (Embalagens e etc)</label>
                  <button className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" onClick={() => setOutros([...outros, {name:'', quantity:'', unit:'un', cost:'', isManualCost:true}])}>
                    + Item
                  </button>
                </div>
                <div className="space-y-2">
                  {outros.map((out, idx) => renderItemRow('outros', out, idx))}
                  {outros.length === 0 && <p className="text-slate-400 text-sm font-medium text-center py-4">Nenhum item adicionado.</p>}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm" onClick={() => { setIsFichaModalOpen(false); setEditFicha(null); }}>Cancelar</button>
              <button className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-sm" onClick={saveFicha}>Salvar Receita</button>
            </div>
          </div>
        </Modal>
      )}

      {fichaToDelete && (
        <Modal
          isOpen={!!fichaToDelete}
          onClose={() => setFichaToDelete(null)}
          title="Excluir Receita"
        >
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Excluir Receita</h2>
            <p className="text-slate-500 font-medium">
              Tem certeza que deseja excluir a ficha técnica de <strong className="text-slate-800">{fichaToDelete.name}</strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <button className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm" onClick={() => setFichaToDelete(null)}>Cancelar</button>
            <button className="px-6 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-sm" onClick={confirmDelete}>Sim, excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
