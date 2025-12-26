
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
    startCamera();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setError(null);
    stopCamera();
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
      console.error("Errore camera:", err);
      setError("Permessi fotocamera negati o fotocamera non trovata.");
    }
  };

  const takeFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Usiamo dimensioni reali del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  const captureAndIdentify = async () => {
    if (!isCameraActive || loading) return;

    setLoading(true);
    setError(null);
    const capturedImages: string[] = [];

    try {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 100);

      if (isBurstMode) {
        for (let i = 0; i < 3; i++) {
          const frame = takeFrame();
          if (frame) capturedImages.push(frame);
          if (i < 2) await new Promise(r => setTimeout(r, 500));
        }
      } else {
        const frame = takeFrame();
        if (frame) capturedImages.push(frame);
      }

      if (capturedImages.length === 0) throw new Error("Cattura fallita. Riprova.");

      // Analisi tramite Gemini
      const result = await identifyProductFromImage(capturedImages);
      
      stopCamera();
      onScanComplete(result);
    } catch (err: any) {
      console.error("Errore scansione:", err);
      setError("L'AI non ha rilevato il codice. Inquadra meglio e riprova.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden rounded-[2.5rem] bg-gray-900 border-4 border-white/10 shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
        />

        {isFlashing && <div className="absolute inset-0 bg-white z-20 animate-out fade-out duration-300" />}

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className={`w-3/4 h-32 border-2 rounded-3xl relative flex items-center justify-center transition-all ${isCameraActive ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-white/20'}`}>
             <div className="absolute inset-x-0 h-[1px] bg-blue-400 animate-pulse"></div>
          </div>
          <p className="mt-4 text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Allinea Codice a Barre</p>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center z-30">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <p className="text-xl font-black uppercase tracking-tight">Analisi AI...</p>
            <p className="text-xs text-gray-400 mt-2">Sto leggendo il prodotto per te</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center gap-6">
        <button onClick={onCancel} className="p-4 bg-white/10 text-white rounded-full"><X className="w-6 h-6" /></button>
        <button
          onClick={captureAndIdentify}
          disabled={loading || !isCameraActive}
          className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all disabled:opacity-50"
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
