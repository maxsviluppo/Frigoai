
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ScanLine, 
  Settings, 
  Plus, 
  AlertTriangle, 
  ChevronRight,
  Search,
  Calendar,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Bell,
  BellOff,
  Camera,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  X,
  Sparkles,
  Loader2,
  MapPin,
  CalendarDays,
  Filter,
  Key,
  ExternalLink,
  ShieldCheck,
  Info,
  Wand2,
  AlertCircle,
  ArrowRight,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { InventoryItem, ViewState } from './types.ts';
import { Scanner } from './components/Scanner.tsx';
import { PhotoEditor } from './components/PhotoEditor.tsx';
import { VisualSearch } from './components/VisualSearch.tsx';
import { generateAIProductImage } from './services/geminiService.ts';
import { loadInventoryFromDB, saveInventoryToDB, savePreference, getPreference } from './services/storageService.ts';

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'fridge' | 'freezer' | 'dispensa'>('all');
  const [selectedExpiry, setSelectedExpiry] = useState<'all' | 'expired' | 'today' | 'near'>('all');

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
        const savedNotif = getPreference('fridgemaster_notif_pref');
        
        if (savedInventory && savedInventory.length > 0) {
          setInventory(savedInventory);
        } else {
          // Dati demo iniziali solo se il DB è vuoto
          const today = new Date().toISOString().split('T')[0];
          const initial: InventoryItem[] = [
            { id: '1', name: 'Latte Intero', barcode: '8001234567890', expiryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], quantity: 1, category: 'fridge', dateAdded: today, notes: 'Fresco di giornata' },
            { id: '2', name: 'Piselli Surgelati', barcode: '8009876543210', expiryDate: '2025-12-30', quantity: 2, category: 'freezer', dateAdded: today },
            { id: '3', name: 'Yogurt Greco', barcode: '8004567890123', expiryDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], quantity: 1, category: 'fridge', dateAdded: today },
          ];
          setInventory(initial);
          await saveInventoryToDB(initial);
        }

        if (savedNotif === 'true' && 'Notification' in window && Notification.permission === 'granted') {
          setNotificationsEnabled(true);
        }

        // Verifica chiave API
        if (process.env.API_KEY && process.env.API_KEY.length > 5) {
          setHasApiKey(true);
        } else if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        }
      } catch (e) {
        console.error("Errore inizializzazione:", e);
      } finally {
        setIsInitialLoad(false);
      }
    };
    init();
  }, []);

  const handleOpenApiKeySelector = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Errore selettore API:", e);
      }
    } else {
      alert("Il selettore di chiavi non è disponibile in questo ambiente. Assicurati di aver impostato API_KEY nelle variabili d'ambiente di Vercel.");
    }
  };

  const clearInventory = async () => {
    const confirm1 = window.confirm("⚠️ ATTENZIONE: Sei sicuro di voler svuotare tutto l'inventario? Questa azione cancellerà definitivamente TUTTI i prodotti salvati.");
    if (!confirm1) return;
    
    const confirm2 = window.confirm("CONFERMA FINALE: L'azione non è reversibile. Procedere?");
    if (confirm2) {
      setInventory([]);
      await saveInventoryToDB([]);
      alert("Inventario svuotato con successo.");
      setActiveView('dashboard');
    }
  };

  useEffect(() => {
    if (!isInitialLoad) {
      saveInventoryToDB(inventory).catch(err => console.error("Errore salvataggio DB:", err));
    }
  }, [inventory, isInitialLoad]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("Il tuo browser non supporta le notifiche.");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        savePreference('fridgemaster_notif_pref', 'true');
        new Notification("FrigoMaster AI", { body: "Notifiche attivate correttamente!" });
      }
    } catch (err) {
      console.error("Errore notifiche:", err);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const threeDaysFromNow = new Date(now.getTime() + (86400000 * 3));
    return {
      total: inventory.reduce((acc, item) => acc + item.quantity, 0),
      expired: inventory.filter(i => new Date(i.expiryDate) < now).length,
      nearExpiry: inventory.filter(i => {
        const d = new Date(i.expiryDate);
        return d >= now && d <= threeDaysFromNow;
      }).length,
      categories: {
        fridge: inventory.filter(i => i.category === 'fridge').length,
        freezer: inventory.filter(i => i.category === 'freezer').length,
        dispensa: inventory.filter(i => i.category === 'dispensa').length,
      }
    };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const todayStr = now.toISOString().split('T')[0];
    const threeDaysFromNow = new Date(now.getTime() + (86400000 * 3));

    return inventory.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.barcode.includes(searchQuery);
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      
      const itemDate = new Date(item.expiryDate);
      itemDate.setHours(0,0,0,0);
      
      let matchesExpiry = true;
      if (selectedExpiry === 'expired') {
        matchesExpiry = itemDate < now;
      } else if (selectedExpiry === 'today') {
        matchesExpiry = item.expiryDate === todayStr;
      } else if (selectedExpiry === 'near') {
        matchesExpiry = itemDate >= now && itemDate <= threeDaysFromNow;
      }
      
      return matchesSearch && matchesCategory && matchesExpiry;
    });
  }, [inventory, searchQuery, selectedCategory, selectedExpiry]);

  const handleAddItem = (item: Partial<InventoryItem>) => {
    const newItem: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: item.name || 'Prodotto sconosciuto',
      barcode: item.barcode || '',
      expiryDate: item.expiryDate || new Date().toISOString().split('T')[0],
      quantity: item.quantity || 1,
      category: item.category || 'fridge',
      image: item.image,
      dateAdded: new Date().toISOString().split('T')[0],
      notes: item.notes || ''
    };
    setInventory(prev => [...prev, newItem]);
    setShowAddModal(false);
    setEditingItem(null);
  };

  const removeItem = (id: string) => {
    if(confirm("Vuoi eliminare questo prodotto?")) {
      setInventory(prev => prev.filter(i => i.id !== id));
      if (expandedItemId === id) setExpandedItemId(null);
    }
  };

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleGenerateAIImage = async () => {
    if (!editingItem?.name) return;
    setIsGeneratingImage(true);
    setErrorMessage(null);
    try {
      const imageUrl = await generateAIProductImage(editingItem.name);
      if (imageUrl && confirm("Vuoi usare questa immagine generata dall'AI?")) {
        setEditingItem(prev => ({ ...prev, image: imageUrl }));
      }
    } catch (err: any) {
      console.error("Errore generazione immagine:", err);
      setErrorMessage("Impossibile generare l'immagine. Verifica la chiave API.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const renderInventory = () => (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inventario</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{filteredInventory.length} Prodotti filtrati</p>
        </div>
        <button 
          onClick={() => { setEditingItem({ quantity: 1, category: 'fridge' }); setShowAddModal(true); setErrorMessage(null); }}
          className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="flex space-x-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
          <input 
            type="text"
            placeholder="Cerca prodotto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
          />
        </div>
        <button onClick={() => setShowVisualSearch(true)} className="p-4 bg-white border border-gray-100 rounded-2xl text-blue-600 shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
          <Camera className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {filteredInventory.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nessun prodotto trovato</p>
          </div>
        ) : (
          filteredInventory.map(item => {
            const isExpanded = expandedItemId === item.id;
            const isExpired = new Date(item.expiryDate) < new Date(new Date().setHours(0,0,0,0));
            return (
              <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-gray-200" />}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-lg leading-tight">{item.name}</h3>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{categoryLabels[item.category]} • Q.tà: {item.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${isExpired ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>{item.expiryDate}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-gray-50 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => setEditingItem(item)} className="p-4 bg-gray-50 rounded-2xl text-xs font-black uppercase text-gray-600 flex items-center justify-center gap-2"><Edit2 className="w-4 h-4" /> Modifica</button>
                       <button onClick={() => removeItem(item.id)} className="p-4 bg-red-50 rounded-2xl text-xs font-black uppercase text-red-600 flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Elimina</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto min-h-screen relative bg-gray-50 selection:bg-blue-100">
      <main className="px-6 pt-8 pb-32">
        {isInitialLoad ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
             <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
             <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Caricamento Database...</p>
          </div>
        ) : (
          <>
            {activeView === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                {!hasApiKey && (
                  <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl flex items-center justify-between gap-4 animate-bounce-slow">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-2xl"><Key className="w-6 h-6" /></div>
                      <div>
                        <p className="font-black text-sm uppercase">AI non configurata</p>
                        <p className="text-[10px] opacity-80 font-bold">Configura la chiave per abilitare l'AI</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveView('settings')} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase shadow-lg">Configura</button>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div><h1 className="text-2xl font-black text-gray-900 tracking-tight">Cucina AI</h1><p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Statistiche Real-Time</p></div>
                  <button onClick={() => setActiveView('scanner')} className="p-3 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-all"><ScanLine className="w-6 h-6" /></button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 h-32 flex flex-col justify-between">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <div><span className="text-3xl font-black text-gray-900">{stats.expired}</span><p className="text-xs font-bold text-gray-400 uppercase">Scaduti</p></div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 h-32 flex flex-col justify-between">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <div><span className="text-3xl font-black text-gray-900">{stats.nearExpiry}</span><p className="text-xs font-bold text-gray-400 uppercase">In Scadenza</p></div>
                  </div>
                </div>

                <section className="space-y-4">
                  <h2 className="text-lg font-black tracking-tight text-gray-800">Recenti</h2>
                  <div className="space-y-3">
                    {inventory.slice(0, 3).map(item => (
                      <div key={item.id} onClick={() => { setActiveView('inventory'); setExpandedItemId(item.id); }} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100">{item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-300" />}</div>
                        <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-900 truncate">{item.name}</h3><p className="text-[9px] text-gray-400 font-black uppercase">{categoryLabels[item.category]}</p></div>
                        <span className={`text-[9px] px-2 py-1 rounded-full font-black uppercase ${new Date(item.expiryDate) < new Date(new Date().setHours(0,0,0,0)) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>{item.expiryDate}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeView === 'inventory' && renderInventory()}

            {activeView === 'editor' && (
              <div className="pb-24 animate-in fade-in duration-500">
                <PhotoEditor 
                  onSave={(img) => {
                    setEditingItem({ image: img, quantity: 1, category: 'fridge' });
                    setShowAddModal(true);
                  }} 
                  onClose={() => setActiveView('dashboard')} 
                />
              </div>
            )}

            {activeView === 'settings' && (
              <div className="space-y-10 pb-24 animate-in fade-in duration-500">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Setup AI</h1>
                
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Configurazione</h2>
                    {hasApiKey && <span className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-widest"><ShieldCheck className="w-3 h-3" /> Attiva</span>}
                  </div>
                  <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-6">
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                      Per utilizzare le funzioni AI su Vercel, devi impostare una variabile d'ambiente chiamata <b>API_KEY</b> nel pannello di controllo del tuo progetto.
                    </p>
                    <button 
                      onClick={handleOpenApiKeySelector} 
                      className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                        hasApiKey ? 'bg-gray-900 text-white' : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <Key className="w-5 h-5" />
                      {hasApiKey ? 'Aggiorna Chiave' : 'Seleziona Chiave'}
                    </button>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-[10px] font-black text-red-400 uppercase tracking-widest">Zona Pericolo</h2>
                  <div className="bg-red-50 rounded-[2.5rem] p-8 border border-red-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-900 text-lg">Svuota Inventario</p>
                      <p className="text-xs text-gray-500 font-medium italic">Cancella tutti i dati salvati</p>
                    </div>
                    <button 
                      onClick={clearInventory}
                      className="px-6 py-4 bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all"
                    >
                      Svuota Ora
                    </button>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white/95 backdrop-blur-2xl border-t border-gray-100 px-8 py-5 flex items-center justify-between z-40 rounded-t-[2.5rem] shadow-xl">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center space-y-1.5 ${activeView === 'dashboard' ? 'text-blue-600' : 'text-gray-300'}`}><LayoutDashboard className="w-6 h-6" /><span className="text-[9px] font-black uppercase">Home</span></button>
        <button onClick={() => setActiveView('inventory')} className={`flex flex-col items-center space-y-1.5 ${activeView === 'inventory' ? 'text-blue-600' : 'text-gray-300'}`}><Package className="w-6 h-6" /><span className="text-[9px] font-black uppercase">Scorte</span></button>
        <div className="relative -top-10"><button onClick={() => setActiveView('scanner')} className="w-16 h-16 bg-blue-600 text-white rounded-3xl shadow-2xl flex items-center justify-center active:scale-90 transition-all"><ScanLine className="w-8 h-8" /></button></div>
        <button onClick={() => setActiveView('editor')} className={`flex flex-col items-center space-y-1.5 ${activeView === 'editor' ? 'text-blue-600' : 'text-gray-300'}`}><ImageIcon className="w-6 h-6" /><span className="text-[9px] font-black uppercase">AI Edit</span></button>
        <button onClick={() => setActiveView('settings')} className={`flex flex-col items-center space-y-1.5 ${activeView === 'settings' ? 'text-blue-600' : 'text-gray-300'}`}><Settings className="w-6 h-6" /><span className="text-[9px] font-black uppercase">Setup</span></button>
      </nav>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 space-y-8 shadow-2xl max-h-[95vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <div><h2 className="text-2xl font-black text-gray-900">{editingItem?.id ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</h2><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dati Prodotto</p></div>
              <button onClick={() => setShowAddModal(false)} className="p-2.5 bg-gray-50 rounded-full text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-6">
                <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-gray-50 shadow-xl bg-gray-50 flex items-center justify-center relative">
                  {editingItem?.image ? <img src={editingItem.image} alt="Anteprima" className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 opacity-30" />}
                  {isGeneratingImage && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={handleGenerateAIImage} disabled={isGeneratingImage || !editingItem?.name} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"><Sparkles className="w-4 h-4" /> AI Foto</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-white border border-gray-100 text-gray-600 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Camera className="w-4 h-4" /> Upload</button>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onloadend = () => setEditingItem(prev => ({ ...prev, image: r.result as string })); r.readAsDataURL(file); } }} />
              <div className="space-y-4">
                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Nome Prodotto</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="Es: Latte Fresco" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Zona</label><select value={editingItem?.category || 'fridge'} onChange={(e) => setEditingItem(prev => ({ ...prev, category: e.target.value as any }))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"><option value="fridge">Frigo</option><option value="freezer">Freezer</option><option value="dispensa">Dispensa</option></select></div>
                  <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Scadenza</label><input type="date" value={editingItem?.expiryDate || ''} onChange={(e) => setEditingItem(prev => ({ ...prev, expiryDate: e.target.value }))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" /></div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 bg-gray-50 text-gray-400 rounded-[2rem] font-black text-xs uppercase">Annulla</button>
              <button onClick={() => editingItem?.id ? updateItem(editingItem.id, editingItem) : handleAddItem(editingItem || {})} className="flex-[2] py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase shadow-xl">{editingItem?.id ? 'Salva' : 'Aggiungi'}</button>
            </div>
          </div>
        </div>
      )}

      {showVisualSearch && <VisualSearch inventoryNames={inventory.map(i => i.name)} onMatch={(name) => { setSearchQuery(name); setShowVisualSearch(false); setActiveView('inventory'); const m = inventory.find(i => i.name === name); if (m) setExpandedItemId(m.id); }} onClose={() => setShowVisualSearch(false)} />}
      {activeView === 'scanner' && <Scanner onScanComplete={(data) => { setEditingItem({ name: data.name, barcode: data.barcode, category: data.category as any || 'fridge', quantity: 1 }); setShowAddModal(true); setActiveView('inventory'); }} onCancel={() => setActiveView('dashboard')} />}
    </div>
  );
};

export default App;
