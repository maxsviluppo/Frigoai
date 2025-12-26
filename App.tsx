
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
  AlertCircle,
  RefreshCw,
  Bell,
  BellOff
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
        if (savedInventory && savedInventory.length > 0) {
          setInventory(savedInventory);
        } else {
          // Dati demo se vuoto
          const today = new Date().toISOString().split('T')[0];
          setInventory([
            { id: '1', name: 'Latte', barcode: '800123', expiryDate: today, quantity: 1, category: 'fridge', dateAdded: today }
          ]);
        }

        // Verifica API KEY (Vercel o Dialogo)
        if (process.env.API_KEY && process.env.API_KEY.length > 5) {
          setHasApiKey(true);
        } else if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        }
      } catch (e) {
        console.error(e);
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
        console.error(e);
      }
    } else {
      alert("Su Vercel, aggiungi API_KEY nelle variabili d'ambiente del progetto.");
    }
  };

  const clearInventory = async () => {
    if (window.confirm("Sei sicuro di voler SVUOTARE TUTTO l'inventario? L'azione è irreversibile.")) {
      if (window.confirm("CONFERMA FINALE: Cancellare tutti i prodotti?")) {
        setInventory([]);
        await saveInventoryToDB([]);
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
    return {
      total: inventory.length,
      expired: inventory.filter(i => new Date(i.expiryDate) < now).length,
      nearExpiry: inventory.filter(i => {
        const d = new Date(i.expiryDate);
        return d >= now && d <= new Date(now.getTime() + 86400000 * 3);
      }).length
    };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
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
    setInventory(prev => [...prev, newItem]);
    setShowAddModal(false);
    setEditingItem(null);
  };

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const renderInventory = () => (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">Prodotti ({filteredInventory.length})</h1>
        <button onClick={() => { setEditingItem({ quantity: 1, category: 'fridge' }); setShowAddModal(true); }} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><Plus /></button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Cerca..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl outline-none" 
        />
      </div>

      <div className="space-y-3">
        {filteredInventory.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="text-gray-200" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{item.name}</h3>
                <p className="text-[10px] text-gray-400 uppercase font-black">{categoryLabels[item.category]}</p>
              </div>
            </div>
            <button onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })} className="p-2 bg-gray-50 rounded-lg text-xs font-bold">Q.tà: {item.quantity}</button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-50">
      <main className="px-6 pt-8 pb-32">
        {activeView === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-black text-gray-900">Il mio Frigo</h1><p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Gestione AI</p></div>
              {!hasApiKey && <button onClick={() => setActiveView('settings')} className="p-3 bg-amber-100 text-amber-600 rounded-full animate-pulse"><AlertCircle /></button>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <AlertTriangle className="text-red-500 mb-2" />
                <span className="text-3xl font-black">{stats.expired}</span>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Scaduti</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <Calendar className="text-orange-500 mb-2" />
                <span className="text-3xl font-black">{stats.nearExpiry}</span>
                <p className="text-[10px] text-gray-400 font-bold uppercase">In scadenza</p>
              </div>
            </div>
          </div>
        )}

        {activeView === 'inventory' && renderInventory()}
        
        {activeView === 'settings' && (
          <div className="space-y-10">
            <h1 className="text-2xl font-black text-gray-900">Setup & AI</h1>
            
            <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><Key /></div>
                <div><p className="font-black text-gray-900">Configurazione API</p><p className="text-xs text-gray-400">Indispensabile per scansione e foto</p></div>
              </div>
              
              <div className="p-4 bg-blue-50 text-blue-800 rounded-2xl text-[10px] leading-relaxed">
                <b>INFO VERCEL:</b> Se sei su Vercel e non hai configurato le variabili d'ambiente, clicca il pulsante sotto per usare la tua chiave esistente o aggiungi "API_KEY" nel dashboard di Vercel.
              </div>

              <button onClick={handleOpenApiKeySelector} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 ${hasApiKey ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white'}`}>
                <ShieldCheck /> {hasApiKey ? 'Chiave Configurata' : 'Seleziona Chiave API'}
              </button>
            </section>

            <section className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 space-y-4">
              <h2 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Zona Pericolo</h2>
              <button onClick={clearInventory} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-200">Svuota Tutto l'Inventario</button>
            </section>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white border-t border-gray-100 px-8 py-5 flex items-center justify-between z-40 rounded-t-[2.5rem] shadow-xl">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center ${activeView === 'dashboard' ? 'text-blue-600' : 'text-gray-300'}`}><LayoutDashboard /><span className="text-[9px] font-black uppercase mt-1">Home</span></button>
        <button onClick={() => setActiveView('inventory')} className={`flex flex-col items-center ${activeView === 'inventory' ? 'text-blue-600' : 'text-gray-300'}`}><Package /><span className="text-[9px] font-black uppercase mt-1">Scorte</span></button>
        <button onClick={() => setActiveView('scanner')} className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg -translate-y-2"><ScanLine /></button>
        <button onClick={() => setActiveView('settings')} className={`flex flex-col items-center ${activeView === 'settings' ? 'text-blue-600' : 'text-gray-300'}`}><Settings /><span className="text-[9px] font-black uppercase mt-1">Setup</span></button>
      </nav>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 space-y-6">
            <h2 className="text-xl font-black">Nuovo Prodotto</h2>
            <input type="text" placeholder="Nome prodotto" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => ({...prev, name: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold" />
            <div className="grid grid-cols-2 gap-4">
              <select value={editingItem?.category || 'fridge'} onChange={(e) => setEditingItem(prev => ({...prev, category: e.target.value as any}))} className="p-4 bg-gray-50 rounded-2xl font-bold">
                <option value="fridge">Frigo</option>
                <option value="freezer">Freezer</option>
                <option value="dispensa">Dispensa</option>
              </select>
              <input type="date" value={editingItem?.expiryDate || ''} onChange={(e) => setEditingItem(prev => ({...prev, expiryDate: e.target.value}))} className="p-4 bg-gray-50 rounded-2xl font-bold" />
            </div>
            <button onClick={() => handleAddItem(editingItem || {})} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black">Aggiungi</button>
          </div>
        </div>
      )}

      {activeView === 'scanner' && <Scanner onScanComplete={(data) => { setEditingItem({ name: data.name, barcode: data.barcode, category: data.category as any || 'fridge' }); setShowAddModal(true); setActiveView('inventory'); }} onCancel={() => setActiveView('dashboard')} />}
    </div>
  );
};

export default App;
