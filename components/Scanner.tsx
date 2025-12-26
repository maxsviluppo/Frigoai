
import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Loader2, Zap, ZapOff, AlertCircle } from 'lucide-react';
import { identifyProductFromImage } from '../services/geminiService';

interface ScannerProps {
  onScanComplete: (data: any) => void;
  onCancel: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBurstMode, setIsBurstMode] = useState(false);
  const [burstProgress, setBurstProgress] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Effetto per collegare lo stream al video quando entrambi sono pronti
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Errore auto-play:", e));
    }
  }, [isCameraActive]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("Hardware camera disattivato:", track.label);
      });
      streamRef.current = null;
    }
    setIsCameraActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    setError(null);
    stopCamera();
    try {
      // Impostato facingMode: 'environment' per la telecamera esterna
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = mediaStream;
      setIsCameraActive(true);
    } catch (err) {
      console.error(err);
      setError("Impossibile attivare la telecamera esterna. Verifica i permessi.");
    }
  };

  const takeFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Cattura il frame reale (senza mirror)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
  };

  const captureAndIdentify = async () => {
    if (!streamRef.current || !isCameraActive) return;

    setLoading(true);
    const capturedImages: string[] = [];

    try {
      if (isBurstMode) {
        for (let i = 0; i < 3; i++) {
          setBurstProgress(i + 1);
          setIsFlashing(true);
          setTimeout(() => setIsFlashing(false), 100);
          const frame = takeFrame();
          if (frame) capturedImages.push(frame);
          if (i < 2) await new Promise(r => setTimeout(r, 800));
        }
      } else {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 100);
        const frame = takeFrame();
        if (frame) capturedImages.push(frame);
      }

      // STACCA IMMEDIATAMENTE LA TELECAMERA dopo lo scatto per privacy e batteria
      stopCamera();

      const result = await identifyProductFromImage(capturedImages);
      onScanComplete(result);
    } catch (err) {
      setError("Errore AI: Non è stato possibile leggere i numeri. Prova ad avvicinarti o usa il Flash.");
      startCamera(); 
    } finally {
      setLoading(false);
      setBurstProgress(0);
    }
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden rounded-[2.5rem] bg-gray-950 border-4 border-white/5 shadow-2xl">
        
        {/* Rimosso scale-x-[-1] perché usiamo la camera esterna */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
        />

        {!isCameraActive && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 space-y-4">
             <div className="w-12 h-12 rounded-full border-2 border-gray-800 flex items-center justify-center animate-pulse">
                <Camera className="w-6 h-6" />
             </div>
             <p className="text-[10px] uppercase font-black tracking-[0.2em]">Sensore Standby</p>
          </div>
        )}
        
        {isFlashing && <div className="absolute inset-0 bg-white z-10 animate-pulse" />}

        {/* Zona di Scan Mirata */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className={`w-4/5 h-40 border-2 rounded-3xl relative flex flex-col items-center justify-center transition-colors ${isCameraActive ? 'border-white/30' : 'border-white/5'}`}>
             <div className="absolute inset-x-0 h-[2px] bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] opacity-80"></div>
             
             <div className="mt-16 w-full p-2 bg-blue-600/20 backdrop-blur-sm border-t border-blue-400/30 text-center">
                <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Inquadra i numeri qui</span>
             </div>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center text-white p-8 text-center z-30">
            <Loader2 className="w-16 h-16 animate-spin text-blue-500 mb-6" />
            <div className="space-y-2">
              <p className="text-2xl font-black tracking-tighter">LETTURA OCR...</p>
              <p className="text-sm text-gray-400 font-medium italic">Hardware spento. Analisi numeri italiani...</p>
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-md mt-8 flex items-center justify-between px-4">
        <button
          onClick={() => setIsBurstMode(!isBurstMode)}
          disabled={loading}
          className={`flex items-center space-x-3 px-6 py-4 rounded-3xl font-bold transition-all shadow-xl ${
            isBurstMode ? 'bg-amber-500 text-white' : 'bg-white/10 text-gray-300'
          }`}
        >
          {isBurstMode ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
          <span className="text-sm">Raffica</span>
        </button>
        
        <div className="text-right">
          <p className="text-white font-black text-xs uppercase tracking-tighter">Cam Esterna</p>
          <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">Auto-Kill Stream</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 text-red-100 rounded-2xl text-xs font-bold text-center flex items-center gap-2 max-w-md">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 flex items-center gap-10">
        <button onClick={handleCancel} className="p-5 bg-white/5 text-white rounded-full border border-white/10 active:scale-90 transition-transform">
          <X className="w-7 h-7" />
        </button>
        
        <button
          onClick={captureAndIdentify}
          disabled={loading || !isCameraActive}
          className={`p-10 rounded-full shadow-2xl transition-all active:scale-90 disabled:opacity-30 disabled:grayscale ${
            isBurstMode ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-600 shadow-blue-500/20'
          } text-white`}
        >
          <Camera className="w-12 h-12" />
        </button>

        <button onClick={startCamera} className={`p-5 rounded-full border border-white/10 active:scale-90 transition-all ${!isCameraActive && !loading ? 'bg-blue-600 text-white animate-bounce' : 'bg-white/5 text-white'}`}>
          <RefreshCw className="w-7 h-7" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
