
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ScanLine, 
  Settings, 
  Plus, 
  AlertTriangle, 
  Search,
  Calendar,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Camera,
  X,
  Sparkles,
  Loader2,
  Key,
  ShieldCheck,
  Zap,
  ChevronRight,
  Barcode,
  ChevronDown,
  ArrowUpRight,
  PieChart,
  Clock,
  ShoppingCart,
  Share2,
  CheckCircle,
  Eye,
  ChevronLeft,
  ArrowRight
} from 'lucide-react';
import { InventoryItem, ViewState } from './types.ts';
import { Scanner } from './components/Scanner.tsx';
import { PhotoEditor } from './components/PhotoEditor.tsx';
import { generateAIProductImage } from './services/geminiService.ts';
import { loadInventoryFromDB, saveInventoryToDB } from './services/storageService.ts';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'fridge' | 'freezer' | 'dispensa'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryLabels: Record<string, string> = {
    fridge: 'Frigo',
    freezer: 'Freezer',
    dispensa: 'Dispensa'
  };

  const categoryColors: Record<string, string> = {
    fridge: 'bg-blue-100 text-blue-700',
    freezer: 'bg-cyan-100 text-cyan-700',
    dispensa: 'bg-amber-100 text-amber-700'
  };

  useEffect(() => {
    const init = async () => {
      try {
        const savedInventory = await loadInventoryFromDB();
        if (savedInventory && savedInventory.length > 0) {
          setInventory(savedInventory);
        } else {
          const today = new Date().toISOString().split('T')[0];
          const demo: InventoryItem[] = [
            { id: '1', name: 'Latte Intero', barcode: '800123', expiryDate: today, quantity: 1, category: 'fridge', dateAdded: today, onShoppingList: true }
          ];
          setInventory(demo);
          await saveInventoryToDB(demo);
        }

        if (process.env.API_KEY && process.env.API_KEY.length > 5) {
          setHasApiKey(true);
        } else if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        }
      } catch (e) {
        console.error("Init Error:", e);
      } finally {
        setIsInitialLoad(false);
      }
    };
    init();
  }, []);

  const handleOpenApiKeySelector = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Key Selection Error:", e);
      }
    }
  };

  useEffect(() => {
    if (!isInitialLoad) saveInventoryToDB(inventory);
  }, [inventory, isInitialLoad]);

  const shoppingListItems = useMemo(() => {
    return inventory.filter(item => item.onShoppingList || item.quantity <= 2);
  }, [inventory]);

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const in3Days = new Date(now.getTime() + 86400000 * 3);
    const criticalItems = inventory.filter(i => {
      const d = new Date(i.expiryDate);
      return d >= now && d <= in3Days;
    });
    return {
      expired: inventory.filter(i => new Date(i.expiryDate) < now).length,
      nearExpiry: criticalItems.length,
      criticalItems: criticalItems.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()),
      total: inventory.length,
      shoppingCount: shoppingListItems.length
    };
  }, [inventory, shoppingListItems]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.barcode && item.barcode.includes(searchQuery))) &&
      (selectedCategory === 'all' || item.category === selectedCategory)
    );
  }, [inventory, searchQuery, selectedCategory]);

  const handleSaveItem = (item: Partial<InventoryItem>) => {
    if (item.id) {
      setInventory(prev => prev.map(i => i.id === item.id ? { ...i, ...item } as InventoryItem : i));
    } else {
      const newItem: InventoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: item.name || 'Prodotto',
        barcode: item.barcode || '',
        expiryDate: item.expiryDate || new Date().toISOString().split('T')[0],
        quantity: item.quantity || 1,
        category: item.category || 'fridge',
        image: item.image,
        dateAdded: new Date().toISOString().split('T')[0],
        onShoppingList: item.onShoppingList || false
      };
      setInventory(prev => [newItem, ...prev]);
    }
    setShowItemModal(false);
    setPreviewItem(null);
    setEditingItem(null);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setShowItemModal(true);
    setPreviewItem(null);
  };

  const markAsBought = (id: string) => {
    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(item.quantity, 3), onShoppingList: false };
      }
      return item;
    }));
  };

  const handleGenerateAIImage = async (nameOverride?: string) => {
    const name = nameOverride || editingItem?.name;
    if (!name) return;
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateAIProductImage(name);
      if (imageUrl) {
        setEditingItem(prev => prev ? ({ ...prev, image: imageUrl }) : null);
      }
    } catch (e) {
      console.error("AI Image error:", e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const removeItem = (id: string) => {
    if (window.confirm("Rimuovere prodotto?")) {
      setInventory(prev => prev.filter(item => item.id !== id));
      setShowItemModal(false);
      setEditingItem(null);
    }
  };

  const handleScannedData = async (data: any) => {
    const initialItem = { 
      name: data.name, 
      barcode: data.barcode, 
      category: data.category as any || 'fridge', 
      quantity: 1 
    };
    setEditingItem(initialItem);
    setShowItemModal(true);
    setActiveView('inventory');
    
    if (data.name) {
      handleGenerateAIImage(data.name);
    }
  };

  // Helper per formattare la data DD/MM
  const formatDateCompact = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
  };

  // Helper per determinare se la data è vicina alla scadenza (3 giorni)
  const isNearExpiry = (dateStr: string) => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const expiry = new Date(dateStr);
    const diff = expiry.getTime() - now.getTime();
    return diff <= (86400000 * 3);
  };

  const Dashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <h1 className="text-2xl font-[850] text-slate-900 tracking-tighter">KitchenAI</h1>
        </div>
        <button onClick={() => setActiveView('settings')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 active:scale-90 transition-all">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {stats.criticalItems.length > 0 && (
        <section className={`p-4 bg-white rounded-[2rem] shadow-sm border border-slate-100 transition-all ${stats.nearExpiry > 0 ? 'pulse-critical' : ''}`}>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" />
              <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Sott'occhio</h2>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {stats.criticalItems.map(item => (
              <button key={item.id} onClick={() => setPreviewItem(item)} className="flex-shrink-0 w-32 bg-slate-50 p-3 rounded-2xl flex flex-col items-center text-center gap-2 border border-slate-100 active:scale-95 transition-all">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-200">
                  {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Barcode className="w-6 h-6 text-slate-200 m-5" />}
                </div>
                <p className="text-[10px] font-bold text-slate-900 truncate w-full">{item.name}</p>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[8px] font-black text-rose-500 uppercase">{formatDateCompact(item.expiryDate)}</span>
                  <span className="text-[8px] font-black text-slate-400">x{item.quantity}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setActiveView('scanner')} className="bg-slate-900 text-white p-5 rounded-[2rem] flex flex-col items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
          <ScanLine className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Scanner AI</span>
        </button>
        <button onClick={() => setActiveView('shopping')} className="bg-indigo-600 text-white p-5 rounded-[2rem] flex flex-col items-center justify-center gap-3 shadow-xl active:scale-95 transition-all relative">
          <ShoppingCart className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Lista Spesa</span>
          {stats.shoppingCount > 0 && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-white text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">{stats.shoppingCount}</div>
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-4 rounded-3xl border border-slate-50 flex flex-col items-center text-center gap-1">
          <span className="text-lg font-black text-slate-900">{stats.total}</span>
          <p className="text-[8px] font-black text-slate-400 uppercase">Totale</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-50 flex flex-col items-center text-center gap-1">
          <span className="text-lg font-black text-rose-500">{stats.expired}</span>
          <p className="text-[8px] font-black text-slate-400 uppercase">Scaduti</p>
        </div>
        <button onClick={() => { setEditingItem({ quantity: 1, category: 'fridge' }); setShowItemModal(true); }} className="bg-slate-100 p-4 rounded-3xl flex flex-col items-center text-center gap-1">
          <Plus className="w-5 h-5 text-slate-600" />
          <p className="text-[8px] font-black text-slate-400 uppercase">Nuovo</p>
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recenti</h2>
          <button onClick={() => setActiveView('inventory')} className="text-[9px] font-black text-indigo-500 flex items-center gap-1">Tutto <ArrowRight className="w-3 h-3" /></button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
          {inventory.slice(0, 5).map(item => (
            <button key={item.id} onClick={() => setPreviewItem(item)} className="flex-shrink-0 w-44 bg-white p-3 rounded-[1.75rem] border border-slate-50 shadow-sm flex items-center gap-3 active:scale-95 transition-all text-left group">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-100">
                {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-200 m-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-slate-900 truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] font-black text-slate-400">x{item.quantity}</span>
                  <span className={`text-[8px] font-black ${isNearExpiry(item.expiryDate) ? 'text-rose-500' : 'text-slate-300'}`}>{formatDateCompact(item.expiryDate)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-[#F8FAFC]">
      <main className="px-6 pt-10 pb-40">
        {isInitialLoad ? (
          <div className="flex flex-col items-center justify-center min-h-[75vh] space-y-4">
             <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avvio...</p>
          </div>
        ) : (
          <>
            {activeView === 'dashboard' && <Dashboard />}
            {activeView === 'inventory' && (
              <div className="space-y-6 pb-36 animate-in fade-in duration-500">
                <div className="flex items-center justify-between px-2">
                  <h1 className="text-2xl font-[850] text-slate-900 tracking-tighter">Scorte</h1>
                  <div className="px-3 py-1 bg-white rounded-lg border border-slate-100 text-[10px] font-black text-indigo-600">{filteredInventory.length}</div>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                  <input type="text" placeholder="Cerca..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold text-slate-800" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['all', 'fridge', 'freezer', 'dispensa'].map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat as any)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat === 'all' ? 'Tutti' : categoryLabels[cat]}</button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {filteredInventory.map(item => (
                    <button key={item.id} onClick={() => setPreviewItem(item)} className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all text-left">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100">
                          {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="text-slate-200 w-6 h-6 m-4" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-slate-900 text-sm truncate">{item.name}</h3>
                          <div className="flex items-center gap-3 mt-1">
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${categoryColors[item.category]}`}>{categoryLabels[item.category]}</span>
                             <div className="flex items-center gap-1">
                               <Clock className={`w-3 h-3 ${isNearExpiry(item.expiryDate) ? 'text-rose-500' : 'text-slate-300'}`} />
                               <span className={`text-[9px] font-bold ${isNearExpiry(item.expiryDate) ? 'text-rose-500' : 'text-slate-400'}`}>{item.expiryDate}</span>
                             </div>
                          </div>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-xl font-black text-xs ${item.quantity <= 2 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-900'}`}>x{item.quantity}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeView === 'shopping' && (
               <div className="space-y-6 pb-36 animate-in fade-in duration-500">
                <div className="flex items-center justify-between px-2">
                  <h1 className="text-2xl font-[850] text-slate-900 tracking-tighter">Shopping</h1>
                  <button className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg"><Share2 className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  {shoppingListItems.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-[2rem] border border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
                          {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-200" />}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">Giacenza: {item.quantity}</p>
                        </div>
                      </div>
                      <button onClick={() => markAsBought(item.id)} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeView === 'settings' && (
              <div className="space-y-8 animate-in fade-in duration-500 text-center">
                <h1 className="text-2xl font-[850] text-slate-900 tracking-tighter">Setup</h1>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-4">
                  <Key className="w-10 h-10 text-indigo-600 mx-auto" />
                  <p className="font-black text-slate-900 uppercase text-xs">Gemini AI Status</p>
                  <button onClick={handleOpenApiKeySelector} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Cambia Chiave</button>
                </div>
                <button onClick={() => setInventory([])} className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl font-black text-[10px] uppercase">Svuota Dispensa</button>
              </div>
            )}
            {activeView === 'editor' && <PhotoEditor onSave={(img) => { setEditingItem({ image: img, quantity: 1, category: 'fridge' }); setShowItemModal(true); }} onClose={() => setActiveView('dashboard')} />}
          </>
        )}
      </main>

      {previewItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in" onClick={() => setPreviewItem(null)} />
          <div className="relative bg-white w-full max-w-xs rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-32 h-32 rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 mx-auto">
              {previewItem.image ? <img src={previewItem.image} className="w-full h-full object-cover" /> : <Barcode className="w-10 h-10 text-slate-200 m-11" />}
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-black text-slate-900 truncate">{previewItem.name}</h2>
              <div className="flex items-center justify-center gap-2">
                 <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg inline-block ${categoryColors[previewItem.category]}`}>{categoryLabels[previewItem.category]}</span>
                 <span className="text-[9px] font-black text-slate-400">x{previewItem.quantity}</span>
              </div>
              <p className={`text-[10px] font-black uppercase mt-1 ${isNearExpiry(previewItem.expiryDate) ? 'text-rose-500' : 'text-slate-400'}`}>Scade: {previewItem.expiryDate}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPreviewItem(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase">Chiudi</button>
              <button onClick={() => openEditModal(previewItem)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Modifica</button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg glass px-6 py-4 flex items-center justify-between z-[100] rounded-[2.5rem] shadow-premium">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center gap-1 ${activeView === 'dashboard' ? 'text-indigo-600' : 'text-slate-300'}`}><LayoutDashboard className="w-5 h-5" /><span className="text-[8px] font-black uppercase">Home</span></button>
        <button onClick={() => setActiveView('inventory')} className={`flex flex-col items-center gap-1 ${activeView === 'inventory' ? 'text-indigo-600' : 'text-slate-300'}`}><Package className="w-5 h-5" /><span className="text-[8px] font-black uppercase">Scorte</span></button>
        <button onClick={() => setActiveView('scanner')} className="w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all ring-4 ring-white"><ScanLine className="w-6 h-6" /></button>
        <button onClick={() => setActiveView('shopping')} className={`flex flex-col items-center gap-1 ${activeView === 'shopping' ? 'text-indigo-600' : 'text-slate-300'}`}><ShoppingCart className="w-5 h-5" /><span className="text-[8px] font-black uppercase">Lista</span></button>
        <button onClick={() => setActiveView('editor')} className={`flex flex-col items-center gap-1 ${activeView === 'editor' ? 'text-indigo-600' : 'text-slate-300'}`}><ImageIcon className="w-5 h-5" /><span className="text-[8px] font-black uppercase">Lab</span></button>
      </nav>

      {showItemModal && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center p-0">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => { setShowItemModal(false); setEditingItem(null); }} />
          <div className="relative bg-white w-full max-w-2xl rounded-t-[3rem] p-8 space-y-8 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{editingItem?.id ? 'Modifica' : 'Nuovo'}</h2>
              <button onClick={() => { setShowItemModal(false); setEditingItem(null); }} className="p-2 bg-slate-50 rounded-full text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 rounded-3xl overflow-hidden bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center relative cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                >
                  {editingItem?.image ? <img src={editingItem.image} className="w-full h-full object-cover" /> : <Barcode className="w-8 h-8 text-slate-200" />}
                  {isGeneratingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>}
                  <div className="absolute bottom-2 right-2 bg-white/90 p-1.5 rounded-lg shadow-sm border border-slate-100">
                    <Camera className="w-3 h-3 text-indigo-600" />
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tocca l'immagine per cambiarla</p>
              </div>

              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const r = new FileReader();
                  r.onloadend = () => setEditingItem(prev => ({ ...prev, image: r.result as string }));
                  r.readAsDataURL(file);
                }
              }} />

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                  <input type="text" placeholder="Nome..." value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => ({...prev, name: e.target.value}))} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantità</label>
                    <div className="flex items-center bg-slate-50 rounded-2xl p-1 h-12">
                      <button onClick={() => setEditingItem(prev => ({...prev, quantity: Math.max(0, (prev?.quantity || 1) - 1)}))} className="flex-1 font-black text-slate-300">-</button>
                      <span className="w-10 text-center font-black text-slate-900">{editingItem?.quantity || 1}</span>
                      <button onClick={() => setEditingItem(prev => ({...prev, quantity: (prev?.quantity || 1) + 1}))} className="flex-1 font-black text-slate-300">+</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Scadenza</label>
                    <input type="date" value={editingItem?.expiryDate || ''} onChange={(e) => setEditingItem(prev => ({...prev, expiryDate: e.target.value}))} className="w-full p-3 bg-slate-50 rounded-2xl font-bold h-12 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                    <select value={editingItem?.category || 'fridge'} onChange={(e) => setEditingItem(prev => ({...prev, category: e.target.value as any}))} className="w-full p-4 bg-slate-50 rounded-2xl font-bold appearance-none outline-none">
                      <option value="fridge">Frigo</option>
                      <option value="freezer">Freezer</option>
                      <option value="dispensa">Dispensa</option>
                    </select>
                  </div>
                   <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Codice</label>
                    <input type="text" placeholder="Barcode" value={editingItem?.barcode || ''} onChange={(e) => setEditingItem(prev => ({...prev, barcode: e.target.value}))} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              {editingItem?.id && (
                <button onClick={() => removeItem(editingItem.id!)} className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5" /></button>
              )}
              <button onClick={() => handleSaveItem(editingItem || {})} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Salva</button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'scanner' && (
        <Scanner 
          onScanComplete={handleScannedData} 
          onCancel={() => setActiveView('dashboard')} 
        />
      )}
    </div>
  );
};

export default App;
