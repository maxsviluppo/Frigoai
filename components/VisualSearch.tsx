
import React, { useRef, useState } from 'react';
import { Camera, X, Loader2, Upload, Image as ImageIcon, CheckCircle2, ChevronRight } from 'lucide-react';
import { matchImageToInventory, InventoryMatch } from '../services/geminiService';

interface VisualSearchProps {
  inventoryNames: string[];
  onMatch: (productName: string) => void;
  onClose: () => void;
}

export const VisualSearch: React.FC<VisualSearchProps> = ({ inventoryNames, onMatch, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<InventoryMatch[]>([]);
  const [searchDone, setSearchDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (base64: string) => {
    setLoading(true);
    setError(null);
    setMatches([]);
    setSearchDone(false);
    try {
      const results = await matchImageToInventory(base64, inventoryNames);
      if (results && results.length > 0) {
        setMatches(results);
        if (results[0].confidence > 0.95) {
          onMatch(results[0].productName);
          return;
        }
      } else {
        setError("Nessuna corrispondenza trovata nell'inventario.");
      }
      setSearchDone(true);
    } catch (err) {
      setError("Errore durante l'analisi dell'immagine.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 text-center space-y-6 flex-shrink-0">
          <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-2 text-blue-600">
            <ImageIcon className="w-10 h-10" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Ricerca Visiva AI</h2>
            <p className="text-gray-500 text-sm">Analisi intelligente per trovare prodotti simili nell'inventario.</p>
          </div>
        </div>

        <div className="px-8 pb-8 flex-1 overflow-y-auto space-y-4">
          {!searchDone && !loading && (
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center space-x-3 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                <Camera className="w-6 h-6" />
                <span>Scatta o Carica Foto</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <p className="text-blue-600 font-bold animate-pulse uppercase tracking-widest text-xs">Confronto con l'inventario...</p>
            </div>
          )}

          {searchDone && matches.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Risultati trovati:</p>
              {matches.map((match, idx) => (
                <button
                  key={idx}
                  onClick={() => onMatch(match.productName)}
                  className="w-full p-4 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm">
                      <CheckCircle2 className={`w-5 h-5 ${match.confidence > 0.8 ? 'text-green-500' : 'text-blue-400'}`} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900">{match.productName}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Corrispondenza: {(match.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
              
              <button
                onClick={() => setSearchDone(false)}
                className="w-full py-3 mt-4 text-sm font-bold text-blue-600 border-2 border-blue-50 border-dashed rounded-xl hover:bg-blue-50 transition-colors"
              >
                Riprova con un'altra foto
              </button>
            </div>
          )}

          {error && (
            <div className="p-6 bg-red-50 text-red-600 rounded-2xl text-center space-y-4 border border-red-100">
              <p className="font-medium">{error}</p>
              <button
                onClick={() => setSearchDone(false)}
                className="px-6 py-2 bg-white text-red-600 rounded-xl font-bold text-xs shadow-sm"
              >
                Riprova
              </button>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            capture="environment" // Impostata fotocamera esterna
            onChange={handleFileUpload} 
          />
        </div>

        <div className="p-4 bg-gray-50 text-center flex-shrink-0">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
            Tecnologia di Riconoscimento Visivo FridgeMaster
          </p>
        </div>
      </div>
    </div>
  );
};
