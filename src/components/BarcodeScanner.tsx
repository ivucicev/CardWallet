import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Upload, X, RefreshCw, AlertCircle, CheckCircle2, Loader2, Lightbulb } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (code: string, format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR') => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [cameraState, setCameraState] = useState<'loading' | 'active' | 'permission_denied' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string>('');
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [hasFlashlight, setHasFlashlight] = useState(false);
  
  // Upload tab states
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  const qrCodeInstance = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scannerElementId = 'scanner-viewfinder-area';
  const fileScannerElementId = 'file-scanner-dummy-area';

  // play pleasant synthesizer feedback beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz (A5) pure tone
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn("Web Audio API beep not supported or blocked by user action", e);
    }
  };

  const mapFormat = (detectedFormat: any): 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR' | undefined => {
    if (!detectedFormat) return undefined;
    const str = String(detectedFormat).toUpperCase();
    if (str.includes('QR')) return 'QR';
    if (str.includes('EAN_13') || str === 'EAN13') return 'EAN13';
    if (str.includes('EAN_8') || str === 'EAN8') return 'EAN8';
    if (str.includes('UPC_A') || str === 'UPCA') return 'UPCA';
    if (str.includes('CODE_128') || str === 'CODE128') return 'CODE128';
    return undefined;
  };

  const handleScanSuccess = (decodedText: string, decodedResult: any) => {
    playBeep();
    setSuccessCode(decodedText);
    
    // Auto-detect format mapping
    const formatName = decodedResult?.result?.format?.formatName;
    const mappedFormat = mapFormat(formatName);
    
    // Visual pause before closing to feel organic
    setTimeout(() => {
      onScanSuccess(decodedText, mappedFormat);
    }, 800);
  };

  // Initialize camera scan
  useEffect(() => {
    if (activeTab !== 'camera') {
      stopCamera();
      return;
    }

    setCameraState('loading');
    setErrorMessage(null);

    // Give a short delay to ensure DOM element is mounted
    const timer = setTimeout(() => {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            
            // Try to find a back camera
            const backCamera = devices.find(device => 
              device.label.toLowerCase().includes('back') || 
              device.label.toLowerCase().includes('rear') ||
              device.label.toLowerCase().includes('environment')
            );
            
            const selectedId = backCamera ? backCamera.id : devices[0].id;
            setCurrentCameraId(selectedId);
            startCamera(selectedId);
          } else {
            // Fallback: try default environment camera directly if devices query failed/returned empty
            startCameraWithFacingMode();
          }
        })
        .catch((err) => {
          console.warn("Error getting cameras, trying default environment mode:", err);
          startCameraWithFacingMode();
        });
    }, 150);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [activeTab]);

  const startCamera = async (cameraId: string) => {
    try {
      if (qrCodeInstance.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode(scannerElementId);
      qrCodeInstance.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 15,
          qrbox: (width, height) => {
            // Landscape widescreen box for 1D barcodes and QR codes
            const boxWidth = Math.min(width * 0.85, 320);
            const boxHeight = Math.min(height * 0.45, 180);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.0
        },
        (text, result) => {
          // Stop scanning once successful to prevent duplicates
          stopCamera();
          handleScanSuccess(text, result);
        },
        (error) => {
          // Failure callback triggers on every frame where no code is detected - quiet log
        }
      );

      setCameraState('active');
      
      // Check for flashlight capability
      try {
        const track = (html5QrCode as any).getRunningTrack();
        if (track && track.getCapabilities) {
          const capabilities = track.getCapabilities();
          if ((capabilities as any).torch) {
            setHasFlashlight(true);
          }
        }
      } catch (e) {
        console.warn("Could not query flashlight capabilities", e);
      }

    } catch (err: any) {
      console.error("Failed to start camera scanner:", err);
      if (String(err).includes('NotAllowedError') || String(err).includes('Permission')) {
        setCameraState('permission_denied');
      } else {
        setCameraState('error');
        setErrorMessage(err?.message || String(err));
      }
    }
  };

  const startCameraWithFacingMode = async () => {
    try {
      if (qrCodeInstance.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode(scannerElementId);
      qrCodeInstance.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (width, height) => {
            const boxWidth = Math.min(width * 0.85, 320);
            const boxHeight = Math.min(height * 0.45, 180);
            return { width: boxWidth, height: boxHeight };
          }
        },
        (text, result) => {
          stopCamera();
          handleScanSuccess(text, result);
        },
        () => {}
      );

      setCameraState('active');
    } catch (err: any) {
      console.error("Failed starting camera by facingMode:", err);
      if (String(err).includes('NotAllowedError') || String(err).includes('Permission')) {
        setCameraState('permission_denied');
      } else {
        setCameraState('error');
        setErrorMessage('Could not open camera. Try uploading an image instead.');
      }
    }
  };

  const stopCamera = async () => {
    if (qrCodeInstance.current) {
      try {
        if (qrCodeInstance.current.isScanning) {
          await qrCodeInstance.current.stop();
        }
      } catch (e) {
        console.warn("Error stopping camera instance:", e);
      } finally {
        qrCodeInstance.current = null;
        setIsFlashlightOn(false);
        setHasFlashlight(false);
      }
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setCurrentCameraId(selectedId);
    startCamera(selectedId);
  };

  const toggleFlashlight = async () => {
    if (!qrCodeInstance.current || !hasFlashlight) return;
    try {
      const nextState = !isFlashlightOn;
      await qrCodeInstance.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any]
      });
      setIsFlashlightOn(nextState);
    } catch (e) {
      console.error("Error toggling flashlight:", e);
    }
  };

  // File Scanning Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileScanning(true);
    setUploadError(null);

    // Temporary element to bind for background decoding
    const dummyElement = document.createElement('div');
    dummyElement.id = fileScannerElementId;
    dummyElement.style.display = 'none';
    document.body.appendChild(dummyElement);

    try {
      const html5QrCode = new Html5Qrcode(fileScannerElementId);
      const decodedText = await html5QrCode.scanFile(file, true);
      
      playBeep();
      setSuccessCode(decodedText);
      
      // Auto-guess EAN-13 vs normal if no direct format back
      let formatGuess: 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR' | undefined;
      const cleanDigits = decodedText.replace(/\s+/g, '');
      if (/^\d{13}$/.test(cleanDigits)) {
        formatGuess = 'EAN13';
      } else if (/^\d{8}$/.test(cleanDigits)) {
        formatGuess = 'EAN8';
      } else if (/^\d{12}$/.test(cleanDigits)) {
        formatGuess = 'UPCA';
      } else if (/^[0-9a-zA-Z-]{3,15}$/.test(cleanDigits)) {
        formatGuess = 'CODE128';
      }

      setTimeout(() => {
        onScanSuccess(decodedText, formatGuess);
      }, 800);

    } catch (err: any) {
      console.warn("File scanning error:", err);
      setUploadError("Could not find any clear barcode or QR code in this image. Please ensure the code is well-lit, sharp, and fills most of the frame.");
    } finally {
      setIsFileScanning(false);
      // clean up dummy element safely
      try {
        document.body.removeChild(dummyElement);
      } catch (e) {}
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-display font-black text-base text-slate-900">Scan Loyalty Card</h3>
            <p className="text-[10px] text-slate-500 font-medium">Automatic QR & Barcode detection</p>
          </div>
          <button 
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Custom Tabs */}
        <div className="flex border-b border-slate-100 p-1 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" /> Use Camera
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" /> Upload Image
          </button>
        </div>

        {/* Viewfinder Content Container */}
        <div className="flex-1 p-5 flex flex-col justify-center min-h-[280px]">
          {activeTab === 'camera' ? (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              
              {/* Camera Container */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video md:aspect-[4/3] flex items-center justify-center border border-slate-800">
                
                {/* Scanner Target viewfinder div */}
                <div id={scannerElementId} className="w-full h-full object-cover [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />

                {/* Laser overlay animation on success / scanning */}
                {cameraState === 'active' && !successCode && (
                  <div className="absolute inset-x-4 top-[15%] bottom-[15%] border-2 border-dashed border-indigo-400 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                    <div className="w-full h-0.5 bg-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,1)] animate-bounce" />
                    <p className="text-[9px] text-indigo-300 font-bold tracking-wider text-center bg-slate-950/70 py-0.5 rounded backdrop-blur-sm self-center">
                      Align barcode/QR inside box
                    </p>
                  </div>
                )}

                {/* Loading state screen */}
                {cameraState === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-950">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                    <span className="text-xs font-bold">Requesting camera...</span>
                  </div>
                )}

                {/* Success overlay state */}
                {successCode && (
                  <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center text-white p-4 text-center animate-fade-in">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce mb-3" />
                    <p className="text-sm font-black tracking-wide">Card Scanned Successfully!</p>
                    <p className="text-xs font-mono text-emerald-200 bg-emerald-900/50 px-3 py-1 rounded-full border border-emerald-500/20 mt-2 font-bold select-all">
                      {successCode}
                    </p>
                  </div>
                )}

                {/* Permission denied error screen */}
                {cameraState === 'permission_denied' && (
                  <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-300 p-6 text-center">
                    <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                    <p className="text-xs font-bold text-white">Camera Access Blocked</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                      Please allow camera access in your browser settings to scan loyalty cards, or upload an image instead.
                    </p>
                    <button 
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="mt-4 px-3 py-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Switch to Image Upload
                    </button>
                  </div>
                )}

                {/* Camera generic error screen */}
                {cameraState === 'error' && (
                  <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-300 p-6 text-center">
                    <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
                    <p className="text-xs font-bold text-white">Camera Error</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">
                      {errorMessage || 'Unable to access rear camera device.'}
                    </p>
                    <button 
                      type="button"
                      onClick={() => startCameraWithFacingMode()}
                      className="mt-4 px-3 py-1.5 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Connection
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Utilities (Flashlight & Multi-Camera dropdown) */}
              {cameraState === 'active' && !successCode && (
                <div className="flex gap-2 items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {/* Torch Toggle */}
                  {hasFlashlight ? (
                    <button
                      type="button"
                      onClick={toggleFlashlight}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        isFlashlightOn 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <Lightbulb className={`w-3.5 h-3.5 ${isFlashlightOn ? 'fill-amber-400 text-amber-600' : ''}`} />
                      {isFlashlightOn ? 'Torch On' : 'Torch Off'}
                    </button>
                  ) : (
                    <div className="text-[10px] text-slate-400 font-semibold px-2">Rear camera active</div>
                  )}

                  {/* Multi-Camera Dropdown selector */}
                  {cameras.length > 1 && (
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-slate-400" />
                      <select
                        value={currentCameraId}
                        onChange={handleCameraChange}
                        className="text-[10px] bg-white border border-slate-200 rounded p-1 max-w-[150px] font-bold text-slate-700 outline-none cursor-pointer"
                      >
                        {cameras.map((camera, i) => (
                          <option key={camera.id} value={camera.id}>
                            {camera.label || `Camera ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            /* Tab 2: Upload barcode file */
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              
              {!successCode ? (
                <div 
                  onClick={triggerFileSelect}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const mockEvent = { target: { files: [file] } } as any;
                      handleFileUpload(mockEvent);
                    }
                  }}
                  className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-3 min-h-[180px]"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {isFileScanning ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                      <span className="text-xs font-bold text-slate-700">Analyzing image file...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-500">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">Choose image or drag here</p>
                        <p className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, or Screenshot of code</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-950/90 rounded-2xl p-6 text-white text-center animate-fade-in flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                  <p className="text-sm font-black tracking-wide">Image Code Detected!</p>
                  <p className="text-xs font-mono text-emerald-200 bg-emerald-900/50 px-3 py-1.5 rounded-full border border-emerald-500/20 mt-2 font-bold select-all">
                    {successCode}
                  </p>
                </div>
              )}

              {/* Show scan error info */}
              {uploadError && !isFileScanning && (
                <div className="p-3 bg-red-50 border border-red-100 text-rose-800 rounded-xl flex gap-2.5 items-start text-[11px] leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="font-semibold">{uploadError}</div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50 text-[10px] text-slate-400 text-center font-medium">
          Powered by device secure web camera technology.
        </div>
      </div>
    </div>
  );
}
