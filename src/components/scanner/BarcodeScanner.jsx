import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, X, Keyboard, RefreshCw, Flashlight } from 'lucide-react';
import { toast } from 'sonner';

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanning, setScanning] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    if (!manualMode) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [manualMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setHasCamera(true);
        startBarcodeDetection();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setHasCamera(false);
      setManualMode(true);
      toast.error('Camera not available. Use manual entry.');
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startBarcodeDetection = () => {
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e']
      });

      scanIntervalRef.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === 4 && scanning) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              setScanning(false);
              stopCamera();
              onScan(barcodes[0].rawValue);
            }
          } catch (err) {
            // Continue scanning
          }
        }
      }, 200);
    } else {
      // Fallback for browsers without BarcodeDetector API
      toast.info('Auto-scan not supported. Please enter barcode manually.');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
    }
  };

  const captureAndDecode = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Try to decode using BarcodeDetector
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new window.BarcodeDetector();
        const barcodes = await barcodeDetector.detect(canvas);
        if (barcodes.length > 0) {
          stopCamera();
          onScan(barcodes[0].rawValue);
          return;
        }
      } catch (err) {
        console.error('Decode error:', err);
      }
    }
    
    toast.error('Could not detect barcode. Try again or enter manually.');
  };

  if (manualMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Enter Barcode</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
            <X className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Keyboard className="w-16 h-16 text-slate-500 mb-6" />
          <form onSubmit={handleManualSubmit} className="w-full max-w-sm space-y-4">
            <Input
              type="text"
              placeholder="Enter barcode number..."
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              className="h-14 text-lg text-center bg-slate-800 border-slate-600 text-white"
              autoFocus
            />
            <Button type="submit" className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700">
              Search Part
            </Button>
          </form>
          
          {hasCamera && (
            <Button 
              variant="ghost" 
              className="mt-6 text-slate-400"
              onClick={() => setManualMode(false)}
            >
              <Camera className="w-5 h-5 mr-2" />
              Use Camera Instead
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white bg-black/30">
          <X className="w-6 h-6" />
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white bg-black/30"
            onClick={() => setManualMode(true)}
          >
            <Keyboard className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Scan overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="w-72 h-48 border-2 border-white/50 rounded-xl">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
            </div>
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/70 animate-pulse" />
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-center text-sm mb-4">
            Position barcode within the frame
          </p>
          <Button 
            onClick={captureAndDecode}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg"
          >
            <Camera className="w-5 h-5 mr-2" />
            Capture & Scan
          </Button>
        </div>
      </div>
    </div>
  );
}