
import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Loader2, AlertCircle, Scan, ArrowLeft, Zap } from 'lucide-react';
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
    return () => {
      stopCamera();
    };
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
    setLoading(false);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => setIsCameraActive(true);
      }
    } catch (err) {
      setError("Permesso fotocamera negato.");
    }
  };

  const captureAndIdentify = async () => {
    if (!videoRef.current || !canvasRef.current || loading) return;
    setLoading(true);
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      stopCamera();
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 200);
      const result = await identifyProductFromImage(base64Data);
      onScanComplete(result);
    } catch (err: any) {
      setError("AI Riconoscimento fallito. Riprova.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-between p-8">
      {/* Header Info */}
      <div className="w-full text-center pt-8">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">KitchenAI Vision</p>
        <p className="text-white/40 text-[9px] font-bold uppercase mt-1 tracking-widest">Inquadra il codice a barre o l'etichetta</p>
      </div>

      {/* Camera Viewport */}
      <div className="relative w-full aspect-[4/5] overflow-hidden rounded-[3rem] bg-slate-900 shadow-2xl border-2 border-white/5">
        {!loading && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
          />
        )}

        {isCameraActive && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-40 border-2 border-indigo-500/30 rounded-[2rem] relative overflow-hidden backdrop-blur-[1px]">
               <div className="absolute inset-x-0 h-0.5 bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,1)] animate-scan"></div>
            </div>
          </div>
        )}

        {isFlashing && <div className="absolute inset-0 bg-white z-40 animate-out fade-out" />}

        {loading && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white z-50">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
            <p className="mt-6 text-sm font-black tracking-widest uppercase">Elaborazione AI...</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-8 text-center z-50">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
            <p className="text-white font-bold text-sm mb-6">{error}</p>
            <button onClick={startCamera} className="px-6 py-3 bg-white text-slate-950 rounded-xl font-black text-[9px] uppercase tracking-widest">Riavvia Fotocamera</button>
          </div>
        )}
      </div>

      {/* Symmetrical Controls Bar */}
      <div className="w-full flex items-center justify-center gap-10 pb-10">
        <button onClick={() => { stopCamera(); onCancel(); }} className="w-14 h-14 bg-white/5 text-white rounded-full flex items-center justify-center active:scale-90 transition-all border border-white/10">
          <X className="w-5 h-5" />
        </button>

        <button
          onClick={captureAndIdentify}
          disabled={!isCameraActive || loading}
          className="w-24 h-24 bg-white text-slate-950 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all disabled:opacity-20 relative group"
        >
          <div className="w-20 h-20 border-2 border-slate-950/10 rounded-full flex items-center justify-center">
            <Camera className="w-10 h-10" />
          </div>
        </button>

        <button onClick={startCamera} className="w-14 h-14 bg-white/5 text-white rounded-full flex items-center justify-center active:scale-90 transition-all border border-white/10">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
