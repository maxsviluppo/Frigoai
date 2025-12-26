
import React, { useState, useRef } from 'react';
import { Wand2, Image as ImageIcon, Loader2, Save, X, Trash2, Upload, RefreshCcw, Sparkles, Camera } from 'lucide-react';
import { editProductImage } from '../services/geminiService.ts';

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
    "Sfondo cucina moderna",
    "Sfondo bianco pulito",
    "Migliora colori",
    "Stile pop art",
    "Effetto vintage"
  ];

  return (
    <div className="flex flex-col min-h-[70vh] bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-gray-100 animate-in slide-in-from-bottom duration-500">
      <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">AI Lab Editor</h2>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Potenziato da Gemini 2.5 Flash</p>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 p-8 space-y-8">
        <div className="relative group aspect-square rounded-[3rem] bg-gray-50 border-4 border-dashed border-gray-100 overflow-hidden flex flex-col items-center justify-center transition-all hover:border-blue-200 hover:bg-blue-50/10">
          {image ? (
            <>
              <img src={image} alt="Prodotto" className="w-full h-full object-cover p-2" />
              <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setImage(null)}
                  className="p-4 bg-red-500 text-white rounded-2xl shadow-xl hover:bg-red-600 transition-colors active:scale-95"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-700 transition-colors active:scale-95"
                >
                  <RefreshCcw className="w-6 h-6" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center p-10 space-y-6">
              <div className="bg-blue-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto text-blue-600 mb-2 shadow-inner">
                <Upload className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black text-gray-900">Nessuna Immagine</p>
                <p className="text-sm text-gray-500 font-medium">Carica una foto per iniziare la magia AI</p>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center gap-3 mx-auto"
              >
                {/* Fixed: Added missing Camera icon to the imports above */}
                <Camera className="w-5 h-5" />
                Carica Foto
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
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-400/20 blur-3xl animate-pulse rounded-full"></div>
                <Loader2 className="w-20 h-20 animate-spin text-blue-600 relative z-10" />
                <Sparkles className="w-8 h-8 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-gray-900 tracking-tight">Magia AI in corso...</p>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">Sostituzione pixel intelligenti</p>
              </div>
            </div>
          )}
        </div>

        {image && !isProcessing && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Prompt Creativo AI</label>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                  <Sparkles className="w-3 h-3" /> Gemini Vision
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es: 'Metti questo latte su un tavolo da colazione rustico' oppure 'Cambia lo sfondo in bianco puro'"
                className="w-full p-6 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none min-h-[140px] font-bold text-gray-800 placeholder:text-gray-300 shadow-inner transition-all"
              />
              
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrompt(p)}
                    className="px-5 py-2.5 bg-white border border-gray-100 rounded-2xl text-[10px] font-black text-gray-500 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-5 bg-red-50 text-red-600 rounded-3xl text-xs font-black border border-red-100 flex items-center space-x-4 animate-in shake">
                <div className="p-2 bg-red-100 rounded-xl"><X className="w-4 h-4" /></div>
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleEdit}
              disabled={isProcessing || !prompt}
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-4 transition-all shadow-2xl shadow-indigo-200 disabled:opacity-30 disabled:shadow-none active:scale-[0.98]"
            >
              <Wand2 className="w-6 h-6" />
              <span>Trasforma con AI</span>
            </button>
          </div>
        )}
      </div>

      {image && !isProcessing && (
        <div className="p-8 border-t border-gray-50 bg-white/50 backdrop-blur-md sticky bottom-0">
          <button
            onClick={() => onSave(image)}
            className="w-full py-6 bg-green-600 hover:bg-green-700 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-4 shadow-2xl shadow-green-100 active:scale-[0.98] transition-all"
          >
            <Save className="w-6 h-6" />
            <span>Salva nell'Inventario</span>
          </button>
        </div>
      )}
    </div>
  );
};
