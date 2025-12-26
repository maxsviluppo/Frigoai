
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
  Info
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
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  
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
          const today = new Date().toISOString().split('T')[0];
          const initial: InventoryItem[] = [
            { id: '1', name: 'Latte Intero', barcode: '8001234567890', expiryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], quantity: 1, category: 'fridge', dateAdded: today, notes: 'Fresco di giornata' },
            { id: '2', name: 'Piselli Surgelati', barcode: '8009876543210', expiryDate: '2025-12-30', quantity: 2, category: 'freezer', dateAdded: today },
            { id: '3', name: 'Yogurt Greco', barcode: '8004567890123', expiryDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], quantity: 1, category: 'fridge', dateAdded: today },
          ];
          setInventory(initial);
          await saveInventoryToDB(initial);
        }

        // Check notification status
        if (savedNotif === 'true' && 'Notification' in window && Notification.permission === 'granted') {
          setNotificationsEnabled(true);
        }

        // Controllo API Key su Vercel e ambiente AI Studio
        const envKey = process.env.API_KEY;
        if (envKey && envKey.length > 5) {
          setHasApiKey(true);
        } else if (window.aistudio?.hasSelectedApiKey) {
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
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Linee guida: assumere successo dopo l'apertura per mitigare race conditions
      setHasApiKey(true);
    } else {
      alert("Il selettore nativo non è disponibile in questo browser. Se sei su Vercel, imposta la variabile d'ambiente API_KEY nel pannello di controllo del progetto.");
    }
  };

  useEffect(() => {
    if (!isInitialLoad) {
      saveInventoryToDB(inventory).catch(err => console.error("Errore salvataggio DB:", err));
    }
  }, [inventory, isInitialLoad]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("Il tuo browser non supporta le notifiche push.");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        savePreference('fridgemaster_notif_pref', 'true');
        new Notification("FrigoMaster AI", { body: "Notifiche attivate con successo!" });
      } else {
        alert("Permesso negato. Abilita le notifiche nelle impostazioni del browser.");
      }
    } catch (err) {
      console.error("Errore richiesta notifiche:", err);
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
    try {
      const imageUrl = await generateAIProductImage(editingItem.name);
      if (imageUrl && confirm("Vuoi usare questa immagine generata dall'AI?")) {
        setEditingItem(prev => ({ ...prev, image: imageUrl }));
      }
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
          onClick={() => { setEditingItem({ quantity: 1, category: 'fridge' }); setShowAddModal(true); }}
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
            placeholder="Cerca per nome o barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
          />
        </div>
        <button onClick={() => setShowVisualSearch(true)} className="p-4 bg-white border border-gray-100 rounded-2xl text-blue-600 shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
          <Camera className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex-shrink-0 flex items-center p-2 rounded-xl bg-gray-100 text-gray-500">
            <Filter className="w-4 h-4" />
          </div>
          {[
            { id: 'all', label: 'Tutti' },
            { id: 'fridge', label: 'Frigo' },
            { id: 'freezer', label: 'Freezer' },
            { id: 'dispensa', label: 'Dispensa' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedCategory === cat.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex-shrink-0 flex items-center p-2 rounded-xl bg-gray-100 text-gray-500">
            <Calendar className="w-4 h-4" />
          </div>
          {[
            { id: 'all', label: 'Ogni Scadenza' },
            { id: 'expired', label: 'Scaduti', color: 'text-red-500' },
            { id: 'today', label: 'Oggi', color: 'text-orange-500' },
            { id: 'near', label: 'Prossimi 3gg', color: 'text-blue-500' }
          ].map(exp => (
            <button
              key={exp.id}
              onClick={() => setSelectedExpiry(exp.id as any)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedExpiry === exp.id 
                ? 'bg-gray-900 text-white shadow-lg' 
                : `bg-white ${exp.color || 'text-gray-400'} border border-gray-100 hover:bg-gray-50`
              }`}
            >
              {exp.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {filteredInventory.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-gray-200 space-y-4">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <Package className="w-10 h-10 text-gray-200" />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nessun prodotto trovato</p>
            <button 
              onClick={() => { setSelectedCategory('all'); setSelectedExpiry('all'); setSearchQuery(''); }}
              className="text-blue-600 text-xs font-black uppercase underline decoration-2 underline-offset-4"
            >
              Reset filtri
            </button>
          </div>
        ) : (
          filteredInventory.map(item => {
            const isExpanded = expandedItemId === item.id;
            const isExpired = new Date(item.expiryDate) < new Date(new Date().setHours(0,0,0,0));
            return (
              <div key={item.id} className={`bg-white rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 overflow-hidden ${isExpanded ? 'ring-2 ring-blue-500/10' : ''}`}>
                <div className="p-4 cursor-pointer flex items-center justify-between min-h-[88px]" onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                      {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 m-3 text-gray-200" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-gray-900 text-lg truncate h-7 flex items-center leading-none">{item.name}</h3>
                      <div className="flex items-center text-[9px] font-black text-gray-400 uppercase tracking-widest gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-md ${item.category === 'fridge' ? 'bg-blue-50 text-blue-600' : item.category === 'freezer' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>{categoryLabels[item.category]}</span>
                        <span className="bg-gray-50 px-2 py-0.5 rounded-md">Q.tà: {item.quantity}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 ml-2 flex-shrink-0">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${isExpired ? 'bg-red-50 text-red-600 shadow-sm shadow-red-100' : 'bg-gray-50 text-gray-500'}`}>{item.expiryDate}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-gray-50 animate-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Sposta in:</p>
                          <div className="flex gap-2">
                            {['fridge', 'freezer', 'dispensa'].map((loc) => (
                              <button key={loc} onClick={(e) => { e.stopPropagation(); updateItem(item.id, { category: loc as any }); }} className={`flex-1 py-3 px-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${item.category === loc ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}>{categoryLabels[loc]}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> Scadenza Rapida:</p>
                          <input 
                            type="date" 
                            value={item.expiryDate}
                            onChange={(e) => updateItem(item.id, { expiryDate: e.target.value })}
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-blue-50 rounded-lg"><Clock className="w-3.5 h-3.5 text-blue-600" /></div>
                            <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Aggiunto il</p><p className="text-xs font-bold text-gray-700">{item.dateAdded}</p></div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-50 rounded-lg"><FileText className="w-3.5 h-3.5 text-gray-400" /></div>
                            <div className="flex-1"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Note AI</p><p className="text-xs text-gray-500 italic leading-relaxed line-clamp-2">{item.notes || 'Nessuna nota.'}</p></div>
                          </div>
                        </div>
                        <div className="flex flex-col justify-end gap-3">
                          <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
                            <button onClick={(e) => { e.stopPropagation(); updateItem(item.id, { quantity: Math.max(0, item.quantity - 1) }); }} className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center bg-white hover:bg-gray-100 transition-all font-black text-gray-500">-</button>
                            <span className="font-black text-xl tabular-nums text-gray-900">{item.quantity}</span>
                            <button onClick={(e) => { e.stopPropagation(); updateItem(item.id, { quantity: item.quantity + 1 }); }} className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center bg-white hover:bg-gray-100 transition-all font-black text-gray-500">+</button>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); setShowAddModal(true); }} className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase text-gray-600 flex items-center justify-center space-x-2 hover:bg-gray-50 transition-all"><Edit2 className="w-3.5 h-3.5" /><span>Edit</span></button>
                            <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="flex-1 py-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black uppercase text-red-600 flex items-center justify-center space-x-2 hover:bg-red-100 transition-all"><Trash2 className="w-3.5 h-3.5" /><span>Elimina</span></button>
                          </div>
                        </div>
                      </div>
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
              <div className="space-y-6 pb-24 animate-in fade-in duration-500">
                {!hasApiKey && (
                  <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 flex items-center justify-between gap-4 animate-bounce-slow">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-2xl"><Key className="w-6 h-6" /></div>
                      <div>
                        <p className="font-black text-sm uppercase tracking-tight">AI non configurata</p>
                        <p className="text-[10px] opacity-80 font-bold">Abilita AI avanzata ora</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveView('settings')} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Configura</button>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-2">
                  <div><h1 className="text-2xl font-black text-gray-900 tracking-tight">La mia cucina</h1><p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Dashboard AI</p></div>
                  <button onClick={() => setActiveView('scanner')} className="p-3 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-all"><ScanLine className="w-6 h-6" /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="bg-red-50 w-10 h-10 rounded-full flex items-center justify-center z-10"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
                    <div className="z-10"><span className="text-3xl font-black text-gray-900">{stats.expired}</span><p className="text-sm font-bold text-gray-400 uppercase tracking-tighter">Scaduti</p></div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="bg-orange-50 w-10 h-10 rounded-full flex items-center justify-center z-10"><Calendar className="w-5 h-5 text-orange-500" /></div>
                    <div className="z-10"><span className="text-3xl font-black text-gray-900">{stats.nearExpiry}</span><p className="text-sm font-bold text-gray-400 uppercase tracking-tighter">In scadenza</p></div>
                  </div>
                </div>
                <section>
                  <h2 className="text-lg font-black tracking-tight text-gray-800 mb-4">Zone di Conservazione</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {['fridge', 'freezer', 'dispensa'].map(k => (
                      <div key={k} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className={`w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center text-white text-xs font-black shadow-lg ${k === 'fridge' ? 'bg-blue-500' : k === 'freezer' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                          {(stats.categories as any)[k]}
                        </div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{categoryLabels[k]}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-black tracking-tight text-gray-800">Recenti</h2><button onClick={() => setActiveView('inventory')} className="text-blue-600 text-[10px] font-black uppercase tracking-widest flex items-center">Vedi tutto <ChevronRight className="w-3 h-3 ml-1" /></button></div>
                  <div className="space-y-3">
                    {inventory.slice(0, 3).map(item => (
                      <div key={item.id} onClick={() => { setActiveView('inventory'); setExpandedItemId(item.id); }} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer h-20 group">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100">{item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-300" />}</div>
                        <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-900 truncate h-5">{item.name}</h3><p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{categoryLabels[item.category]}</p></div>
                        <span className={`text-[9px] px-2 py-1 rounded-full font-black uppercase ${new Date(item.expiryDate) < new Date(new Date().setHours(0,0,0,0)) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>{item.expiryDate}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
            {activeView === 'inventory' && renderInventory()}
            {activeView === 'settings' && (
              <div className="space-y-10 pb-24 animate-in fade-in duration-500">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Impostazioni</h1>
                
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Configurazione API</h2>
                    {hasApiKey && <span className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-widest"><ShieldCheck className="w-3 h-3" /> Attiva</span>}
                  </div>
                  <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-start space-x-6">
                      <div className={`p-5 rounded-3xl ${hasApiKey ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Key className={`w-8 h-8 ${!hasApiKey ? 'animate-pulse' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-gray-900 text-lg">Chiave API Google</p>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed mt-1">
                          {hasApiKey ? "Configurata correttamente. Utilizzabile per tutte le funzioni AI." : "Richiesta per la generazione di immagini Pro e l'analisi avanzata dei barcode."}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-2 flex flex-col gap-3">
                      <button 
                        onClick={handleOpenApiKeySelector} 
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                          hasApiKey ? 'bg-gray-900 text-white shadow-lg' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'
                        }`}
                      >
                        <Key className="w-5 h-5" />
                        {hasApiKey ? 'Aggiorna Chiave' : 'Seleziona Chiave API'}
                      </button>

                      {!window.aistudio && !hasApiKey && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 items-start">
                           <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                           <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                             Se sei su Vercel e non riesci a usare il pulsante, aggiungi <b>API_KEY</b> nelle impostazioni del tuo progetto.
                           </p>
                        </div>
                      )}
                      
                      <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3 text-[10px] font-black text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                      >
                        Info Fatturazione Google <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notifiche Smart</h2>
                  <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center space-x-6">
                      <div className={`p-5 rounded-3xl ${notificationsEnabled ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`}>{notificationsEnabled ? <Bell className="w-8 h-8" /> : <BellOff className="w-8 h-8" />}</div>
                      <div><p className="font-black text-gray-900 text-lg">Alert Scadenze</p><p className="text-sm text-gray-500 font-medium">Avviso 3 giorni prima</p></div>
                    </div>
                    <button 
                      onClick={requestNotificationPermission} 
                      className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${notificationsEnabled ? 'bg-green-600 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'}`}
                    >
                      {notificationsEnabled ? 'ATTIVE' : 'ATTIVA'}
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
        <button onClick={() => setShowPhotoEditor(true)} className="flex flex-col items-center space-y-1.5 text-gray-300"><ImageIcon className="w-6 h-6" /><span className="text-[9px] font-black uppercase">AI Edit</span></button>
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
                  {editingItem?.image ? <img src={editingItem.image} alt="Anteprima" className="w-full h-full object-cover" /> : <div className="text-center opacity-30"><ImageIcon className="w-10 h-10 mx-auto mb-2" /><span className="text-[8px] font-black uppercase">Anteprima</span></div>}
                  {isGeneratingImage && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /><span className="text-[8px] font-black uppercase mt-2">AI in corso...</span></div>}
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={handleGenerateAIImage} disabled={isGeneratingImage || !editingItem?.name} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"><Sparkles className="w-4 h-4" /> AI Foto</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-white border border-gray-100 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2"><Camera className="w-4 h-4" /> Manuale</button>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onloadend = () => setEditingItem(prev => ({ ...prev, image: r.result as string })); r.readAsDataURL(file); } }} />
              <div className="space-y-4">
                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Nome Prodotto</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner" placeholder="Es: Latte Fresco" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Zona</label><select value={editingItem?.category || 'fridge'} onChange={(e) => setEditingItem(prev => ({ ...prev, category: e.target.value as any }))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none"><option value="fridge">Frigo</option><option value="freezer">Freezer</option><option value="dispensa">Dispensa</option></select></div>
                  <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Scadenza</label><input type="date" value={editingItem?.expiryDate || ''} onChange={(e) => setEditingItem(prev => ({ ...prev, expiryDate: e.target.value }))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" /></div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 bg-gray-50 text-gray-400 rounded-[2rem] font-black text-xs uppercase">Annulla</button>
              <button onClick={() => editingItem?.id ? updateItem(editingItem.id, editingItem) : handleAddItem(editingItem || {})} className="flex-[2] py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase shadow-xl">{editingItem?.id ? 'Conferma' : 'Aggiungi'}</button>
            </div>
          </div>
        </div>
      )}

      {showVisualSearch && <VisualSearch inventoryNames={inventory.map(i => i.name)} onMatch={(name) => { setSearchQuery(name); setShowVisualSearch(false); setActiveView('inventory'); const m = inventory.find(i => i.name === name); if (m) setExpandedItemId(m.id); }} onClose={() => setShowVisualSearch(false)} />}
      {activeView === 'scanner' && <Scanner onScanComplete={(data) => { setEditingItem({ name: data.name, barcode: data.barcode, category: data.category as any || 'fridge', quantity: 1 }); setShowAddModal(true); setActiveView('inventory'); }} onCancel={() => setActiveView('dashboard')} />}
      {showPhotoEditor && <div className="fixed inset-0 z-[60] p-6 bg-black/90 flex items-center justify-center"><div className="w-full max-w-xl h-[90vh]"><PhotoEditor initialImage={editingItem?.image} onSave={(img) => { if (editingItem?.id) updateItem(editingItem.id, { image: img }); else setEditingItem(p => ({ ...p, image: img })); setShowPhotoEditor(false); setShowAddModal(true); }} onClose={() => setShowPhotoEditor(false)} /></div></div>}
    </div>
  );
};

export default App;
