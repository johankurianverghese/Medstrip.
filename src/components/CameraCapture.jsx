import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, RefreshCw, X, SwitchCamera, Scan, AlertCircle, FlipHorizontal } from 'lucide-react';

export default function CameraCapture({ onCapture, isLoading, previewUrl, onReset }) {
  const [isLive, setIsLive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [isFlipped, setIsFlipped] = useState(false); // In case webcam outputs inverted feed
  const [cameraError, setCameraError] = useState(null);

  // 4-Frame Tilt Burst state
  const [isBurstCapturing, setIsBurstCapturing] = useState(false);
  const [burstStep, setBurstStep] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const guideBoxRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
    setIsBurstCapturing(false);
    setBurstStep(0);
  };

  // Start camera with getUserMedia
  const startCamera = async (mode = facingMode) => {
    setCameraError(null);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser. Please use the file upload option.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setFacingMode(mode);
      setIsLive(true);
    } catch (err) {
      console.error('getUserMedia error:', err);
      let msg = 'Unable to access camera. Please check camera permissions or use file upload.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please grant camera permission in your browser or select a photo from your device.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device. Please use the file upload option.';
      }
      setCameraError(msg);
      setIsLive(false);
    }
  };

  // Attach stream to video element whenever isLive or streamRef changes
  useEffect(() => {
    if (isLive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.log('Video play error:', err);
      });
    }
  }, [isLive]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Toggle front / back camera
  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  };

  // Helper to capture a single cropped high-res frame from video stream
  const captureFrameFromVideo = (frameIndex) => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) return resolve(null);

      const vWidth = video.videoWidth || 1280;
      const vHeight = video.videoHeight || 720;

      let cropX = 0;
      let cropY = 0;
      let cropW = vWidth;
      let cropH = vHeight;

      // Crop to framing guide box if element refs are available
      if (guideBoxRef.current && videoRef.current) {
        const videoRect = videoRef.current.getBoundingClientRect();
        const guideRect = guideBoxRef.current.getBoundingClientRect();

        const videoAspect = vWidth / vHeight;
        const containerAspect = videoRect.width / videoRect.height;
        let renderedW, renderedH, renderedX, renderedY;

        if (containerAspect > videoAspect) {
          renderedH = videoRect.height;
          renderedW = renderedH * videoAspect;
          renderedX = videoRect.left + (videoRect.width - renderedW) / 2;
          renderedY = videoRect.top;
        } else {
          renderedW = videoRect.width;
          renderedH = renderedW / videoAspect;
          renderedX = videoRect.left;
          renderedY = videoRect.top + (videoRect.height - renderedH) / 2;
        }

        if (renderedW > 0 && renderedH > 0) {
          const scale = vWidth / renderedW;
          // Add 15% generous padding so text near box edges is never clipped
          const padX = guideRect.width * 0.15;
          const padY = guideRect.height * 0.15;
          cropX = Math.max(0, (guideRect.left - padX - renderedX) * scale);
          cropY = Math.max(0, (guideRect.top - padY - renderedY) * scale);
          cropW = Math.min(vWidth - cropX, (guideRect.width + 2 * padX) * scale);
          cropH = Math.min(vHeight - cropY, (guideRect.height + 2 * padY) * scale);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropW);
      canvas.height = Math.round(cropH);
      const ctx = canvas.getContext('2d');

      if (ctx) {
        if (isFlipped) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          video,
          cropX, cropY, cropW, cropH,
          0, 0, canvas.width, canvas.height
        );
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File(
              [blob],
              `strip_burst_${Date.now()}_frame_${frameIndex}.jpg`,
              { type: 'image/jpeg', lastModified: Date.now() }
            );
            resolve(file);
          } else {
            resolve(null);
          }
        },
        'image/jpeg',
        0.92
      );
    });
  };

  // 4-Frame Tilt Burst Capture spaced 500ms apart (~2 seconds total)
  const handleCaptureBurst = async () => {
    const video = videoRef.current;
    if (!video || isBurstCapturing) return;

    setIsBurstCapturing(true);
    setBurstStep(1);

    const capturedFrames = [];

    try {
      // Frame 1 (t = 0ms)
      setBurstStep(1);
      const f1 = await captureFrameFromVideo(1);
      if (f1) capturedFrames.push(f1);

      // Frame 2 (t = 500ms)
      await new Promise((r) => setTimeout(r, 500));
      setBurstStep(2);
      const f2 = await captureFrameFromVideo(2);
      if (f2) capturedFrames.push(f2);

      // Frame 3 (t = 1000ms)
      await new Promise((r) => setTimeout(r, 500));
      setBurstStep(3);
      const f3 = await captureFrameFromVideo(3);
      if (f3) capturedFrames.push(f3);

      // Frame 4 (t = 1500ms)
      await new Promise((r) => setTimeout(r, 500));
      setBurstStep(4);
      const f4 = await captureFrameFromVideo(4);
      if (f4) capturedFrames.push(f4);

      // Brief pause to display completion before closing camera
      await new Promise((r) => setTimeout(r, 200));

      stopCamera();
      setIsBurstCapturing(false);

      if (capturedFrames.length > 0) {
        onCapture(capturedFrames);
      }
    } catch (err) {
      console.error('Tilt burst capture failed:', err);
      stopCamera();
      setIsBurstCapturing(false);
    }
  };

  // Handle file input fallback (gallery / file picker)
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      stopCamera();
      onCapture([file]);
    }
  };

  return (
    <>
      {/* Hidden file input for desktop / gallery fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* FULL-VIEWPORT LIVE CAMERA MODAL (fixed inset-0 z-50 flex flex-col h-[100dvh] bg-black) */}
      {isLive && (
        <div className="fixed inset-0 z-50 flex flex-col h-[100dvh] w-full bg-black select-none">
          {/* Top Camera Controls Bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/10 z-20">
            {/* Live Indicator */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-white font-bold text-xs tracking-wider">LIVE CAMERA</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Flip View Button */}
              <button
                type="button"
                onClick={() => setIsFlipped((prev) => !prev)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                  isFlipped
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
                title="Flip view horizontally if camera feed is mirrored"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>{isFlipped ? 'Mirrored' : 'Flip View'}</span>
              </button>

              {/* Switch Camera Button (Front / Back) */}
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/20 transition-all"
                title="Switch between front and rear cameras"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span>Switch</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={stopCamera}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all ml-1"
                title="Close Camera"
                aria-label="Close Camera"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Video Stream Container (flex-1 min-h-0 overflow-hidden) */}
          <div className="relative flex-1 min-h-0 overflow-hidden bg-black flex items-center justify-center">
            {/* Live Video Stream (never mirrored by default for left-to-right reading) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ transform: isFlipped ? 'scaleX(-1)' : 'none' }}
              className="w-full h-full object-contain"
            />

            {/* Rectangular Framing Guide Overlay ("Hold strip inside the box") */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div
                ref={guideBoxRef}
                className="w-[85%] max-w-[320px] aspect-[16/9] border-2 border-dashed border-emerald-400 rounded-2xl relative shadow-2xl bg-black/20 flex flex-col items-center justify-center"
              >
                {/* 4 Corner Framing Brackets */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                <div className="bg-black/75 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/20">
                  <Scan className="w-4 h-4 text-emerald-400" />
                  <span>Hold strip inside the box</span>
                </div>
              </div>
              <p className="text-xs text-white/90 font-medium drop-shadow-md mt-3 bg-black/50 px-3 py-1 rounded-full backdrop-blur-xs">
                Keep strip flat & ensure medicine text is in focus
              </p>
            </div>

            {/* 4-Frame Tilt Burst Progress Overlay ("Hold steady & slightly tilt the strip... 1/4, 2/4, 3/4, 4/4") */}
            {isBurstCapturing && (
              <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
                <div className="relative mb-5 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{burstStep}/4</span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Frames</span>
                  </div>
                </div>

                <h3 className="text-xl font-black text-white tracking-wide mb-1.5 leading-snug">
                  Hold steady & slightly tilt the strip...
                </h3>
                <p className="text-xs text-emerald-300 font-semibold mb-6 max-w-xs">
                  Capturing 4 tilt frames to beat specular foil glare
                </p>

                {/* 4 Step Progress Pills */}
                <div className="flex items-center gap-2.5 mb-3">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-3 rounded-full transition-all duration-300 ${
                        step < burstStep
                          ? 'w-10 bg-emerald-400 shadow-lg shadow-emerald-400/50'
                          : step === burstStep
                          ? 'w-12 bg-emerald-300 animate-pulse ring-2 ring-emerald-200'
                          : 'w-8 bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                <span className="text-xs font-mono text-slate-300 uppercase tracking-widest mt-1">
                  {burstStep <= 4 ? `Frame ${burstStep} of 4` : 'Processing burst...'}
                </span>
              </div>
            )}
          </div>

          {/* Pinned Visible Bottom Bar (shrink-0 p-4 bg-black/90) */}
          <div className="shrink-0 p-4 bg-black/90 border-t border-white/10 flex items-center justify-around z-20">
            {/* Close Button on left */}
            <button
              type="button"
              disabled={isBurstCapturing}
              onClick={stopCamera}
              className="flex flex-col items-center text-slate-300 hover:text-white transition-colors disabled:opacity-40"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center mb-1">
                <X className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium">Cancel</span>
            </button>

            {/* Large, High-Contrast Green "Capture & Scan" Button (triggers 4-frame Tilt Burst) */}
            <button
              type="button"
              disabled={isLoading || isBurstCapturing}
              onClick={handleCaptureBurst}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-full font-black text-base shadow-2xl transition-all duration-200 active:scale-95 ${
                isLoading || isBurstCapturing
                  ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-4 ring-emerald-400/40 hover:ring-emerald-400/60 shadow-emerald-500/30'
              }`}
              aria-label="Capture & Scan"
            >
              {isBurstCapturing ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-900" />
                  <span>Capturing {burstStep}/4...</span>
                </>
              ) : isLoading ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-900" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Camera className="w-6 h-6 text-slate-950" />
                  <span>Capture & Scan</span>
                </>
              )}
            </button>

            {/* Switch Camera on right */}
            <button
              type="button"
              disabled={isBurstCapturing}
              onClick={handleSwitchCamera}
              className="flex flex-col items-center text-slate-300 hover:text-white transition-colors disabled:opacity-40"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center mb-1">
                <SwitchCamera className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium">Switch</span>
            </button>
          </div>
        </div>
      )}

      {/* Main In-Page Card (Idle / Preview State) */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 text-center relative overflow-hidden">
        {previewUrl ? (
          /* Captured Image Preview */
          <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md mb-4 bg-slate-900 aspect-video flex items-center justify-center">
            <img src={previewUrl} alt="Captured strip" className="w-full h-full object-contain" />
            <button
              onClick={onReset}
              className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full backdrop-blur-sm transition-all"
              title="Scan another strip"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-center py-2">
          {/* Camera Error Alert if user denied permission or camera failed */}
          {cameraError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2 text-left w-full">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Primary "Scan Medicine Strip" Button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => startCamera('environment')}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl relative group active:scale-95 ${
              isLoading
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white ring-8 ring-emerald-100 hover:ring-emerald-200 animate-pulse'
            }`}
            aria-label="Scan Medicine Strip"
          >
            {isLoading ? (
              <RefreshCw className="w-10 h-10 animate-spin" />
            ) : (
              <Camera className="w-11 h-11 transition-transform group-hover:scale-110" />
            )}
          </button>

          <h2 className="font-extrabold text-lg text-slate-900 mt-4 leading-tight">
            {isLoading ? 'Scanning Medicine Strip...' : 'Scan Medicine Strip'}
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            Tap button to open camera with 4-frame Tilt Burst
          </p>

          {/* Desktop / Gallery File Upload Fallback */}
          <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-2 rounded-xl transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose from Gallery / Computer</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
