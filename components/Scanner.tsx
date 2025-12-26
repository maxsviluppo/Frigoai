
import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Loader2, AlertCircle } from 'lucide-react';
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
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraActive(true);
        };
      }
    } catch (err) {
      console.error("Errore fotocamera:", err);
      setError("Impossibile accedere alla fotocamera. Controlla i permessi.");
    }
  };

  const captureAndIdentify = async () => {
    if (!videoRef.current || !canvasRef.current || loading) return;

    // Fondamentale: verifichiamo che il video sia pronto per il rendering (readyState 2+)
    if (videoRef.current.readyState < 2) {
      setError("Fotocamera non pronta, attendi un istante...");
      return;
    }

    setLoading(true);
    setError(null);
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Usiamo le dimensioni reali del video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Errore context canvas");
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      // Analisi tramite Gemini
      const result = await identifyProductFromImage(base64Data);
      
      stopCamera();
      onScanComplete(result);
    } catch (err: any) {
      console.error("Errore analisi AI:", err);
      setError("L'AI non ha letto il codice. Inquadra meglio e riprova.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden rounded-[3rem] bg-gray-900 border-4 border-white/10 shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
        />

        {isFlashing && <div className="absolute inset-0 bg-white z-20" />}

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="w-64 h-32 border-2 border-blue-500 rounded-3xl relative">
             <div className="absolute inset-x-0 h-[1px] bg-blue-400 top-1/2 animate-pulse"></div>
          </div>
          <p className="mt-8 text-[10px] font-black text-white/50 uppercase tracking-[0.3em] bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
            Codice a barre qui
          </p>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white z-30">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <p className="text-xl font-black uppercase tracking-tight">Gemini Vision...</p>
            <p className="text-xs text-gray-400 mt-2">Analisi prodotto in corso</p>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center gap-8">
        <button onClick={onCancel} className="p-4 bg-white/10 text-white rounded-full"><X className="w-6 h-6" /></button>
        <button
          onClick={captureAndIdentify}
          disabled={loading || !isCameraActive}
          className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all disabled:opacity-50"
        >
          <Camera className="w-8 h-8" />
        </button>
        <button onClick={startCamera} className="p-4 bg-white/10 text-white rounded-full"><RefreshCw className="w-6 h-6" /></button>
      </div>

      {error && (
        <div className="absolute top-10 px-6 py-3 bg-red-600 text-white rounded-full text-xs font-black uppercase flex items-center gap-2 animate-bounce">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
