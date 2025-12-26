
import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Loader2, Zap, ZapOff, AlertCircle } from 'lucide-react';
import { identifyProductFromImage } from '../services/geminiService.ts';

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
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Errore video.play():", e));
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
        console.log("Track camera fermato:", track.label);
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
      console.error("Errore camera:", err);
      setError("Impossibile attivare la fotocamera. Verifica i permessi nelle impostazioni del browser.");
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
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  };

  const captureAndIdentify = async () => {
    if (!streamRef.current || !isCameraActive || loading) return;

    setLoading(true);
    setError(null);
    const capturedImages: string[] = [];

    try {
      if (isBurstMode) {
        for (let i = 0; i < 3; i++) {
          setIsFlashing(true);
          setTimeout(() => setIsFlashing(false), 50);
          const frame = takeFrame();
          if (frame) capturedImages.push(frame);
          if (i < 2) await new Promise(r => setTimeout(r, 600));
        }
      } else {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 50);
        const frame = takeFrame();
        if (frame) capturedImages.push(frame);
      }

      // Spegniamo la camera SUBITO dopo aver preso i frame
      stopCamera();

      // Se la chiave API non è presente, fallirà qui
      const result = await identifyProductFromImage(capturedImages);
      onScanComplete(result);
    } catch (err: any) {
      console.error("Errore durante la scansione:", err);
      setError(err.message?.includes("API_KEY") 
        ? "Errore: Chiave API Gemini non configurata su Vercel." 
        : "L'AI non è riuscita a leggere i numeri. Assicurati che il codice sia ben illuminato.");
      // Riattiviamo la camera solo se l'analisi fallisce
      startCamera();
      setLoading(false);
    }
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden rounded-[2.5rem] bg-gray-950 border-4 border-white/5 shadow-2xl">
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
             <p className="text-[10px] uppercase font-black tracking-[0.2em]">Fotocamera Inattiva</p>
          </div>
        )}
        
        {isFlashing && <div className="absolute inset-0 bg-white z-10" />}

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className={`w-4/5 h-40 border-2 rounded-3xl relative flex flex-col items-center justify-center transition-colors ${isCameraActive ? 'border-blue-500/50' : 'border-white/5'}`}>
             <div className="absolute inset-x-0 h-[2px] bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] opacity-80"></div>
             <div className="mt-16 w-full p-2 bg-blue-600/20 backdrop-blur-sm border-t border-blue-400/30 text-center">
                <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Inquadra i numeri</span>
             </div>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-white p-8 text-center z-30 animate-in fade-in">
            <Loader2 className="w-16 h-16 animate-spin text-blue-500 mb-6" />
            <div className="space-y-2">
              <p className="text-2xl font-black tracking-tighter uppercase">Analisi AI...</p>
              <p className="text-sm text-gray-400 font-medium italic">Riconoscimento prodotto in corso</p>
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
          <p className="text-white font-black text-xs uppercase tracking-tighter">Telecamera</p>
          <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">Posteriore</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 text-red-100 rounded-2xl text-xs font-bold text-center flex items-center gap-2 max-w-md animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 flex items-center gap-10">
        <button onClick={handleCancel} disabled={loading} className="p-5 bg-white/5 text-white rounded-full border border-white/10 active:scale-90 transition-transform disabled:opacity-30">
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

        <button onClick={startCamera} disabled={loading} className={`p-5 rounded-full border border-white/10 active:scale-90 transition-all ${!isCameraActive && !loading ? 'bg-blue-600 text-white animate-bounce' : 'bg-white/5 text-white'}`}>
          <RefreshCw className="w-7 h-7" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
