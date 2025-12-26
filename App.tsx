
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
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Loader2,
  Key,
  ShieldCheck,
  AlertCircle,
  Zap,
  ChevronRight
} from 'lucide-react';
import { InventoryItem, ViewState } from './types.ts';
import { Scanner } from './components/Scanner.tsx';
import { PhotoEditor } from './components/PhotoEditor.tsx';
import { VisualSearch } from './components/VisualSearch.tsx';
import { generateAIProductImage } from './services/geminiService.ts';
import { loadInventoryFromDB, saveInventoryToDB } from './services/storageService.ts';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'fridge' | 'freezer' | 'dispensa'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryLabels: Record<string, string> = {
    fridge: 'Frigo',
    freezer: 'Freezer',
    dispensa: 'Dispensa'
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
            { id: '1', name: 'Latte Fresco', barcode: '800123', expiryDate: today, quantity: 1, category: 'fridge', dateAdded: today }
          ];
          setInventory(demo);
          await saveInventoryToDB(demo);
        }

        // Verifica API KEY (Vercel injected o Session Key)
        if (process.env.API_KEY && process.env.API_KEY.length > 5) {
          setHasApiKey(true);
        } else if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        }
      } catch (e) {
        console.error("Inizializzazione fallita:", e);
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
        // Ricarichiamo la pagina per assicurarci che process.env.API_KEY sia aggiornato se necessario
        // ma tecnicamente il bridge gestisce la cosa.
      } catch (e) {
        console.error("Errore selezione chiave:", e);
      }
    } else {
      alert("Ambiente non supportato. Aggiungi API_KEY nelle variabili d'ambiente di Vercel.");
    }
  };

  const clearInventory = async () => {
    if (confirm("⚠️ ATTENZIONE: Vuoi davvero cancellare TUTTO l'inventario?")) {
      if (confirm("CONFERMA DEFINITIVA: Questa azione non si può annullare.")) {
        setInventory([]);
        await saveInventoryToDB([]);
        setActiveView('dashboard');
        alert("Inventario svuotato.");
      }
    }
  };

  useEffect(() => {
    if (!isInitialLoad) saveInventoryToDB(inventory);
  }, [inventory, isInitialLoad]);

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const in3Days = new Date(now.getTime() + 86400000 * 3);
    return {
      total: inventory.reduce((acc, i) => acc + i.quantity, 0),
      expired: inventory.filter(i => new Date(i.expiryDate) < now).length,
      nearExpiry: inventory.filter(i => {
        const d = new Date(i.expiryDate);
        return d >= now && d <= in3Days;
      }).length
    };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.barcode.includes(searchQuery)) &&
      (selectedCategory === 'all' || item.category === selectedCategory)
    );
  }, [inventory, searchQuery, selectedCategory]);

  const handleAddItem = (item: Partial<InventoryItem>) => {
    const newItem: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: item.name || 'Prodotto',
      barcode: item.barcode || '',
      expiryDate: item.expiryDate || new Date().toISOString().split('T')[0],
      quantity: item.quantity || 1,
      category: item.category || 'fridge',
      image: item.image,
      dateAdded: new Date().toISOString().split('T')[0]
    };
    setInventory(prev => [newItem, ...prev]);
    setShowAddModal(false);
    setEditingItem(null);
    setActiveView('inventory');
  };

  const removeItem = (id: string) => {
    if (confirm("Eliminare questo prodotto?")) {
      setInventory(prev => prev.filter(i => i.id !== id));
    }
  };

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleGenerateAIImage = async () => {
    if (!editingItem?.name) return;
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateAIProductImage(editingItem.name);
      if (imageUrl) setEditingItem(prev => ({ ...prev, image: imageUrl }));
    } catch (err) {
      alert("Errore generazione immagine. Verifica la chiave API.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-50 flex flex-col font-sans">
      <main className="flex-1 px-6 pt-8 pb-32 overflow-y-auto">
        {isInitialLoad ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
             <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inizializzazione...</p>
          </div>
        ) : (
          <>
            {activeView === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {!hasApiKey && (
                  <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-[2rem] text-white shadow-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md"><Zap className="w-6 h-6" /></div>
                      <div>
                        <p className="font-black text-sm uppercase">AI non attiva</p>
                        <p className="text-[10px] opacity-70 font-bold">Configura la chiave per lo scanner</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveView('settings')} className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase">Attiva</button>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-black text-gray-900">FrigoMaster</h1>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Gestione intelligente</p>
                  </div>
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 font-black shadow-sm border border-gray-100">AI</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between h-40">
                    <AlertTriangle className="text-red-500 w-8 h-8" />
                    <div>
                      <span className="text-4xl font-black text-gray-900 leading-none">{stats.expired}</span>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Scaduti</p>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between h-40">
                    <Calendar className="text-orange-500 w-8 h-8" />
                    <div>
                      <span className="text-4xl font-black text-gray-900 leading-none">{stats.nearExpiry}</span>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">In Scadenza</p>
                    </div>
                  </div>
                </div>

                <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100">
                   <h2 className="text-lg font-black text-gray-900 mb-6">Azioni Rapide</h2>
                   <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setActiveView('scanner')} className="flex items-center gap-4 p-5 bg-blue-50 rounded-2xl text-blue-600 transition-all active:scale-95">
                         <ScanLine className="w-6 h-6" />
                         <span className="text-xs font-black uppercase">Scanner</span>
                      </button>
                      <button onClick={() => { setEditingItem({ quantity: 1, category: 'fridge' }); setShowAddModal(true); }} className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl text-gray-600 transition-all active:scale-95">
                         <Plus className="w-6 h-6" />
                         <span className="text-xs font-black uppercase">Manuale</span>
                      </button>
                   </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-gray-900">Prodotti Recenti</h2>
                    <button onClick={() => setActiveView('inventory')} className="text-blue-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">Vedi tutto <ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-3">
                    {inventory.slice(0, 3).map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-50 flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100">
                          {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="text-gray-200" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{item.name}</h3>
                          <p className="text-[9px] text-gray-400 font-black uppercase">{categoryLabels[item.category]}</p>
                        </div>
                        <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase ${new Date(item.expiryDate) < new Date(new Date().setHours(0,0,0,0)) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>{item.expiryDate}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeView === 'inventory' && renderInventory()}
            
            {activeView === 'settings' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <h1 className="text-3xl font-black text-gray-900">Setup AI & Opzioni</h1>
                
                <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${hasApiKey ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      <Key className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-lg">Chiave API Gemini</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Stato: {hasApiKey ? 'ATTIVA' : 'MANCANTE'}</p>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-blue-50 rounded-2xl text-[11px] text-blue-900/70 font-medium leading-relaxed">
                    Per abilitare lo scanner AI su Vercel, clicca il pulsante sotto per attivare una chiave di sessione sicura tramite Google AI Studio.
                  </div>

                  <button 
                    onClick={handleOpenApiKeySelector} 
                    className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${
                      hasApiKey ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                    {hasApiKey ? 'Chiave Configurata' : 'Configura Chiave Sessione'}
                  </button>
                </section>

                <section className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 space-y-4">
                  <h2 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Zona Pericolo</h2>
                  <button onClick={clearInventory} className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all">Svuota Tutto l'Inventario</button>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white/80 backdrop-blur-xl border-t border-gray-100 px-8 py-5 flex items-center justify-between z-40 rounded-t-[2.5rem] shadow-2xl">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center gap-1 ${activeView === 'dashboard' ? 'text-blue-600' : 'text-gray-300'}`}><LayoutDashboard className="w-6 h-6" /><span className="text-[9px] font-black uppercase">Home</span></button>
        <button onClick={() => setActiveView('inventory')} className={`flex flex-col items-center gap-1 ${activeView === 'inventory' ? 'text-blue-600' : 'text-gray-300'}`}><Package className="w-6 h-6" /><span className="text-[9px] font-black uppercase">Scorte</span></button>
        <button onClick={() => setActiveView('scanner')} className="w-16 h-16 bg-blue-600 text-white rounded-3xl shadow-2xl flex items-center justify-center -translate-y-6 active:scale-90 transition-all"><ScanLine className="w-8 h-8" /></button>
        <button onClick={() => setActiveView('editor')} className={`flex flex-col items-center gap-1 ${activeView === 'editor' ? 'text-blue-600' : 'text-gray-300'}`}><ImageIcon className="w-6 h-6" /><span className="text-[9px] font-black uppercase">AI Edit</span></button>
        <button onClick={() => setActiveView('settings')} className={`flex flex-col items-center gap-1 ${activeView === 'settings' ? 'text-blue-600' : 'text-gray-300'}`}><Settings className="w-6 h-6" /><span className="text-[9px] font-black uppercase">Setup</span></button>
      </nav>

      {showAddModal && renderAddModal()}
      {activeView === 'scanner' && <Scanner onScanComplete={(data) => { setEditingItem({ name: data.name, barcode: data.barcode, category: data.category as any || 'fridge' }); setShowAddModal(true); }} onCancel={() => setActiveView('dashboard')} />}
      {showVisualSearch && <VisualSearch inventoryNames={inventory.map(i => i.name)} onMatch={(name) => { setSearchQuery(name); setShowVisualSearch(false); setActiveView('inventory'); }} onClose={() => setShowVisualSearch(false)} />}
    </div>
  );

  function renderInventory() {
    return (
      <div className="space-y-6 pb-24 animate-in fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-gray-900">Scorte ({filteredInventory.length})</h1>
          <button onClick={() => { setEditingItem({ quantity: 1, category: 'fridge' }); setShowAddModal(true); }} className="p-3 bg-blue-600 text-white rounded-2xl"><Plus /></button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cerca prodotto..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl outline-none shadow-sm" 
          />
        </div>

        <div className="space-y-3">
          {filteredInventory.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center justify-between group">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center border border-gray-100">
                  {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="text-gray-200" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-gray-900 truncate">{item.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-blue-500 uppercase bg-blue-50 px-2 py-0.5 rounded">{categoryLabels[item.category]}</span>
                    <span className="text-[9px] font-black text-gray-400">Scad: {item.expiryDate}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-50 rounded-xl px-2 py-1">
                  <button onClick={() => updateItem(item.id, { quantity: Math.max(0, item.quantity - 1) })} className="p-1 font-black text-gray-400">-</button>
                  <span className="mx-2 font-black text-xs">{item.quantity}</span>
                  <button onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })} className="p-1 font-black text-gray-400">+</button>
                </div>
                <button onClick={() => removeItem(item.id)} className="p-2 text-red-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderAddModal() {
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
        <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-bottom duration-500">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Nuovo Prodotto</h2>
            <button onClick={() => setShowAddModal(false)} className="p-3 bg-gray-50 rounded-full"><X /></button>
          </div>
          
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-6">
              <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-gray-50 shadow-xl bg-gray-50 flex items-center justify-center relative">
                {editingItem?.image ? <img src={editingItem.image} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 opacity-10" />}
                {isGeneratingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={handleGenerateAIImage} disabled={isGeneratingImage || !editingItem?.name} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><Sparkles className="w-4 h-4" /> AI Foto</button>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-white border border-gray-100 text-gray-600 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Camera className="w-4 h-4" /> Foto</button>
              </div>
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
              <input type="text" placeholder="Nome prodotto" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => ({...prev, name: e.target.value}))} className="w-full p-5 bg-gray-50 rounded-3xl font-bold outline-none border border-transparent focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-4">
                <select value={editingItem?.category || 'fridge'} onChange={(e) => setEditingItem(prev => ({...prev, category: e.target.value as any}))} className="p-5 bg-gray-50 rounded-3xl font-bold outline-none border border-transparent focus:border-blue-500 appearance-none text-center">
                  <option value="fridge">Frigo</option>
                  <option value="freezer">Freezer</option>
                  <option value="dispensa">Dispensa</option>
                </select>
                <input type="date" value={editingItem?.expiryDate || ''} onChange={(e) => setEditingItem(prev => ({...prev, expiryDate: e.target.value}))} className="p-5 bg-gray-50 rounded-3xl font-bold outline-none border border-transparent focus:border-blue-500" />
              </div>
            </div>
          </div>
          <button onClick={() => handleAddItem(editingItem || {})} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">Conferma & Salva</button>
        </div>
      </div>
    );
  }
};

export default App;
