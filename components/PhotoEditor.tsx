
import React, { useState, useRef } from 'react';
import { Wand2, Image as ImageIcon, Loader2, Save, X, Trash2, Upload, RefreshCcw } from 'lucide-react';
import { editProductImage } from '../services/geminiService';

interface PhotoEditorProps {
  initialImage?: string;
  onSave: (newImage: string) => void;
  onClose: () => void;
}

export const PhotoEditor: React.FC<PhotoEditorProps> = ({ initialImage, onSave, onClose }) => {
  const [image, setImage] = useState<string | null>(initialImage || null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async () => {
    if (!image || !prompt) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const base64Data = image.split(',')[1];
      const result = await editProductImage(base64Data, prompt);
      if (result) {
        setImage(result);
        setPrompt('');
      } else {
        throw new Error("Impossibile generare l'immagine");
      }
    } catch (err) {
      setError("L'AI non è riuscita a modificare l'immagine. Prova con un comando più chiaro.");
    } finally {
      setIsProcessing(false);
    }
  };

  const quickPrompts = [
    "Rimuovi sfondo",
    "Stile realistico 3D",
    "Schiarisci colori",
    "Stile acquerello"
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Editor AI</h2>
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Potenziato da Gemini</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="relative group aspect-square rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 overflow-hidden flex flex-col items-center justify-center transition-all hover:border-blue-300">
          {image ? (
            <>
              <img src={image} alt="Prodotto" className="w-full h-full object-contain p-4" />
              <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setImage(null)}
                  className="p-3 bg-red-500 text-white rounded-2xl shadow-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCcw className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center p-8 space-y-4">
              <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-blue-600 mb-2">
                <Upload className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-gray-900">Inizia da una foto</p>
                <p className="text-sm text-gray-500">Carica l'immagine di un prodotto per modificarla con l'AI</p>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                Carica Immagine
              </button>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload} 
          />

          {isProcessing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-300">
              <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-blue-600" />
                <Wand2 className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-gray-900 tracking-tight">Magia AI in corso...</p>
                <p className="text-sm text-gray-500 font-medium">Stiamo trasformando la tua foto</p>
              </div>
            </div>
          )}
        </div>

        {image && !isProcessing && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest">Comando Creativo</label>
                <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase">AI Activa</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es: 'Rimuovi lo sfondo', 'Trasforma in stile cartone animato', 'Aggiungi ombre realistiche'"
                className="w-full p-5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px] font-medium text-gray-800 placeholder:text-gray-400"
              />
              
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrompt(p)}
                    className="px-4 py-2 bg-white border border-gray-100 rounded-full text-xs font-bold text-gray-500 hover:border-blue-200 hover:text-blue-600 transition-all active:scale-95"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleEdit}
              disabled={isProcessing || !prompt}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-bold flex items-center justify-center space-x-3 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
            >
              <Wand2 className="w-6 h-6" />
              <span>Applica Trasformazione AI</span>
            </button>
          </div>
        )}
      </div>

      {image && !isProcessing && (
        <div className="p-6 border-t border-gray-50 bg-white/50 backdrop-blur-md sticky bottom-0">
          <button
            onClick={() => onSave(image)}
            className="w-full py-5 bg-green-600 hover:bg-green-700 text-white rounded-[1.5rem] font-black flex items-center justify-center space-x-3 shadow-xl shadow-green-100 active:scale-[0.98] transition-all"
          >
            <Save className="w-6 h-6" />
            <span>Usa questa foto</span>
          </button>
        </div>
      )}
    </div>
  );
};
