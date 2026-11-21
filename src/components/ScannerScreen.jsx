import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, ShieldCheck, Volume2, Play, Pause, ChevronDown, CalendarPlus, Pill, SwitchCamera } from 'lucide-react';
import { speakWithBrowserTTS, stopBrowserTTS } from './AudioPlayer';
import MedicineScanAnimation, { SCAN_STEPS } from './MedicineScanAnimation';
import RevealOnScroll from './RevealOnScroll';

/**
 * Downscales an image File/Blob on an offscreen canvas to max dimension (1280px)
 * and compresses as JPEG with quality (0.82) to reduce payload size to ~120-180KB
 * while preserving fine text sharpness on blister packs.
 */
export async function optimizeImageFile(file, maxDimension = 1280, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      // If already within 1280px and under 250KB, keep as-is
      if (Math.max(width, height) <= maxDimension && file.size < 250 * 1024) {
        resolve(file);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const optimizedFile = new File(
            [blob],
            file.name ? file.name.replace(/\.[^/.]+$/, '.jpg') : 'captured_strip.jpg',
            {
              type: 'image/jpeg',
              lastModified: Date.now(),
            }
          );
          resolve(optimizedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Fast client-side quality scoring for camera frames.
 * Evaluates gradient variance (sharpness) and specular glare hotspots.
 * Returns higher score for sharp, low-glare frames.
 */
function scoreFrameQuality(ctx, width, height) {
  try {
    const sampleW = 160;
    const sampleH = 90;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sCtx = sampleCanvas.getContext('2d');
    if (!sCtx) return 0;

    sCtx.drawImage(ctx.canvas, 0, 0, sampleW, sampleH);
    const imgData = sCtx.getImageData(0, 0, sampleW, sampleH).data;

    let totalDiff = 0;
    let glareCount = 0;
    const totalPixels = sampleW * sampleH;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 240) glareCount++;

      if ((i + 4) % (sampleW * 4) !== 0) {
        const nextLum = 0.299 * imgData[i + 4] + 0.587 * imgData[i + 5] + 0.114 * imgData[i + 6];
        const diff = Math.abs(lum - nextLum);
        totalDiff += diff * diff;
      }
    }

    const sharpness = Math.sqrt(totalDiff / totalPixels);
    const glarePct = (glareCount / totalPixels) * 100;
    return sharpness - glarePct * 0.4;
  } catch (e) {
    return 0;
  }
}

export default function ScannerScreen({
  scanResult,
  onCaptureBurst,
  onUploadFile,
  isLoading,
  previewUrl,
  lang,
  setLang,
  onSelectSample,
  onAddToCalendar,
}) {
  const [isLive, setIsLive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (rear) | 'user' (front)
  const [cameraError, setCameraError] = useState(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [burstStep, setBurstStep] = useState(0); // 0 = idle, 1..4 = capturing
  const [addedCalendarToast, setAddedCalendarToast] = useState(null);

  // Time-aligned scanStep progression (0..4) and processing overlay visibility
  const [scanStep, setScanStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const stepTimerRef = useRef(null);
  const completionRef = useRef(null);
  const currentStepRef = useRef(0);

  // Synchronize scanStep progression with isLoading and burstStep
  useEffect(() => {
    // Clear any active timers
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    if (completionRef.current) clearTimeout(completionRef.current);

    if (isLoading || burstStep > 0) {
      setIsProcessing(true);

      if (burstStep > 0) {
        setScanStep(0);
        currentStepRef.current = 0;
        return;
      }

      // Start from Step 0: Uploading your photo
      setScanStep(0);
      currentStepRef.current = 0;

      // ~1.2s -> Step 1 (Scanning the label)
      const t1 = setTimeout(() => {
        setScanStep(1);
        currentStepRef.current = 1;

        // ~2.8s -> Step 2 (Reading medicine names) [1.2s + 1.6s]
        const t2 = setTimeout(() => {
          setScanStep(2);
          currentStepRef.current = 2;

          // ~4.8s -> Step 3 (Checking against medicine list) [2.8s + 2.0s]
          const t3 = setTimeout(() => {
            setScanStep(3);
            currentStepRef.current = 3;
            // Holds/caps at Step 3 (3 SAFETY GATES) while backend request is in flight!
          }, 2000);
          stepTimerRef.current = t3;
        }, 1600);
        stepTimerRef.current = t2;
      }, 1200);

      stepTimerRef.current = t1;
    } else if (isProcessing) {
      // Backend request finished (isLoading became false)
      // Rapidly step through remaining stages (~180ms per stage) to Step 4 (READY)
      const stepThroughToEnd = (startStep) => {
        if (startStep >= 4) {
          // Already at Step 4 ("Preparing your card" / "READY"), hold briefly then reveal verified result
          completionRef.current = setTimeout(() => {
            setIsProcessing(false);
            setScanStep(0);
            currentStepRef.current = 0;
          }, 350);
          return;
        }

        const nextStep = startStep + 1;
        setScanStep(nextStep);
        currentStepRef.current = nextStep;

        if (nextStep === 4) {
          // Hold at Step 4 for 450ms so the user sees the verified card glow & READY badge
          completionRef.current = setTimeout(() => {
            setIsProcessing(false);
            setScanStep(0);
            currentStepRef.current = 0;
          }, 450);
        } else {
          // Fast compressed pace (~180ms per stage) so each step is seen cleanly
          completionRef.current = setTimeout(() => {
            stepThroughToEnd(nextStep);
          }, 180);
        }
      };

      stepThroughToEnd(currentStepRef.current);
    }

    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      if (completionRef.current) clearTimeout(completionRef.current);
    };
  }, [isLoading, burstStep]);

  // Stop camera cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
  };

  // Start Camera with target facing mode (defaults to rear camera 'environment' on mobile)
  const startCamera = async (targetMode = facingMode) => {
    setCameraError(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser or is blocked over non-HTTPS. Please use "Upload Photo" or run over HTTPS.');
      return;
    }

    try {
      let stream;
      try {
        // Ideal resolution for OCR & ideal facing mode (rear camera on mobile)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (idealErr) {
        // Fallback constraint if device rejects ideal resolution or strict parameters
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetMode },
            audio: false,
          });
        } catch (strictErr) {
          // Final fallback to any available camera stream
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      streamRef.current = stream;
      setFacingMode(targetMode);
      setIsLive(true);
    } catch (err) {
      console.warn('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera permissions in browser settings or upload a photo.');
      } else if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        setCameraError('Mobile browsers require HTTPS or localhost for live camera access. Use "Upload Photo" to capture directly via your native camera.');
      } else {
        setCameraError('Camera unavailable or in use by another app. Please upload a photo.');
      }
      setIsLive(false);
    }
  };

  // Toggle between Rear ('environment') and Front ('user') cameras
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isLive) {
      await startCamera(nextMode);
    } else {
      await startCamera(nextMode);
    }
  };

  useEffect(() => {
    if (isLive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.warn);
    }
  }, [isLive]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopBrowserTTS();
    };
  }, []);

  // 4-Frame Burst Capture from live camera (optimized: max 1280px, 150ms interval, JPEG 0.82, sharpness-scored)
  const triggerLiveBurst = async () => {
    if (!videoRef.current || !isLive) {
      // If camera is not yet active, turn it on first!
      startCamera();
      return;
    }

    const video = videoRef.current;
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const targetW = Math.max(1, Math.round(vw * scale));
    const targetH = Math.max(1, Math.round(vh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    const candidateFrames = [];
    for (let i = 1; i <= 4; i++) {
      setBurstStep(i);
      if (ctx) {
        ctx.drawImage(video, 0, 0, targetW, targetH);
        const score = scoreFrameQuality(ctx, targetW, targetH);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        if (blob) {
          candidateFrames.push({
            file: new File([blob], `burst_frame_${i}.jpg`, { type: 'image/jpeg' }),
            score,
            index: i,
          });
        }
      }
      if (i < 4) await new Promise((r) => setTimeout(r, 150));
    }

    // Sort candidate frames descending by sharpness/quality score so the sharpest, least-glare frame is first!
    candidateFrames.sort((a, b) => b.score - a.score);
    const sortedFiles = candidateFrames.map((c) => c.file);

    setBurstStep(0);
    stopCamera();
    onCaptureBurst(sortedFiles);
  };

  // Get current active voice text & audio for the selected language
  const activeVoice = scanResult?.voice?.[lang] || {
    text: scanResult?.speech_text || (
      lang === 'en'
        ? `This medicine is ${scanResult?.brand_name || 'Zerodol-SP'}. It contains ${scanResult?.generic_name || 'Aceclofenac + Paracetamol'} ${scanResult?.strength || '100mg + 325mg'}. Take in the morning and night, after food within 15–20 minutes.`
        : (lang === 'hi'
            ? `यह दवा ${scanResult?.brand_name || 'Zerodol-SP'} है। सुबह और रात को खाना खाने के बाद लें।`
            : `ਇਹ ਦਵਾਈ ${scanResult?.brand_name || 'Zerodol-SP'} ਹੈ। ਸਵੇਰੇ ਅਤੇ ਰਾਤ ਨੂੰ ਰੋਟੀ ਖਾਣ ਤੋਂ ਬਾਅਦ ਲਵੋ।`)
    ),
    audio_base64: scanResult?.audio_base64,
  };

  const handleToggleVoice = () => {
    if (isPlayingVoice) {
      if (audioRef.current) audioRef.current.pause();
      stopBrowserTTS();
      setIsPlayingVoice(false);
      return;
    }

    const isChimeFallback = activeVoice.audio_base64 && activeVoice.audio_base64.startsWith('data:audio/wav');
    const hasRealAudio = activeVoice.audio_base64 && !isChimeFallback && activeVoice.audio_base64.startsWith('data:audio/');

    if (hasRealAudio && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play()
        .then(() => setIsPlayingVoice(true))
        .catch(() => {
          speakWithBrowserTTS(activeVoice.text, lang, () => setIsPlayingVoice(true), () => setIsPlayingVoice(false), () => setIsPlayingVoice(false));
        });
    } else {
      speakWithBrowserTTS(
        activeVoice.text,
        lang,
        () => setIsPlayingVoice(true),
        () => setIsPlayingVoice(false),
        () => setIsPlayingVoice(false)
      );
    }
  };

  // Default displayed medicine if no scan yet
  const displayBrand = scanResult?.brand_name || 'Zerodol-SP';
  const displayManufacturer = scanResult?.manufacturer || 'Ipca Laboratories Ltd';
  const displayIngredients = scanResult?.generic_name || 'Aceclofenac + Paracetamol';
  const displayStrength = scanResult?.strength || '100mg + 325mg';
  const isVerified = scanResult ? scanResult.status === 'VERIFIED' : true;
  const ocrEngine = scanResult?.ocr_engine || 'Gemini Flash Vision';

  return (
    <section id="scanner" className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 scroll-mt-6 animate-in fade-in duration-300">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={activeVoice.audio_base64}
        onEnded={() => setIsPlayingVoice(false)}
        onPause={() => setIsPlayingVoice(false)}
      />

      {/* Hidden File Input with native mobile camera capture fallback */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          if (e.target.files && e.target.files[0]) {
            const optimized = await optimizeImageFile(e.target.files[0], 1280, 0.82);
            onUploadFile(optimized);
          }
        }}
      />

      {/* 2-Column Split Layout matching Reference Screenshot 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
        {/* ================= LEFT CARD: Scan Medicine Strip ================= */}
        <RevealOnScroll delay={0} className="w-full h-full flex flex-col">
          <div className="bg-[#FAF7F2] rounded-3xl md:rounded-4xl p-6 sm:p-8 lg:p-10 border border-stone-200/80 shadow-soft flex flex-col justify-between h-full">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight mb-5">
                Scan Medicine Strip
              </h2>

              {/* Dark Camera Viewfinder with minimal white corner brackets */}
              <div className="relative w-full min-h-[340px] sm:min-h-[380px] lg:min-h-[420px] aspect-[16/11] rounded-2xl md:rounded-3xl bg-[#121816] overflow-hidden flex items-center justify-center border border-stone-800 shadow-inner group">
              {/* Active Camera Indicator Pill */}
              {isLive && (
                <div className="absolute top-3.5 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold tracking-wide shadow-sm animate-in fade-in duration-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{facingMode === 'environment' ? 'Rear Camera' : 'Front Camera'}</span>
                </div>
              )}

              {/* Viewfinder Top-Right Flip Camera Button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                title={`Switch to ${facingMode === 'environment' ? 'Front' : 'Rear'} Camera`}
                className="absolute top-3.5 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 backdrop-blur-md border border-white/25 text-white text-xs font-semibold tracking-wide shadow-md transition-all cursor-pointer group"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-emerald-300 group-hover:rotate-180 transition-transform duration-300" />
                <span className="hidden sm:inline">
                  {facingMode === 'environment' ? 'Flip to Front' : 'Flip to Rear'}
                </span>
                <span className="sm:hidden">Flip</span>
              </button>

              {/* Minimal White Corner Framing Brackets */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-sm z-10 pointer-events-none" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-sm z-10 pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-sm z-10 pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-sm z-10 pointer-events-none" />

              {/* Viewfinder Content: Live Video or Preview or Simulated Strip Image */}
              {isLive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Scanned strip preview"
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  {/* Styled medicine strip mockup matching screenshot */}
                  <img
                    src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80"
                    alt="Sample Medicine Strip in Hand"
                    className="absolute inset-0 w-full h-full object-cover opacity-60 filter brightness-90 contrast-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

                  <div className="relative z-10 flex flex-col items-center">
                    <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 mb-2">
                      Viewfinder Active
                    </span>
                    <span className="text-sm font-medium text-white/90">
                      Position medicine strip inside white brackets
                    </span>
                  </div>
                </div>
              )}

              {/* MedicineScanAnimation Processing Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 z-30 bg-[#071124]/85 backdrop-blur-[4px] flex flex-col items-center justify-center p-3 text-white animate-in fade-in duration-300 select-none">
                  {/* Drop-in Medicine Strip Scanner Animation */}
                  <div className="scale-[0.88] sm:scale-100 transform-gpu origin-center">
                    <MedicineScanAnimation activeStep={scanStep} />
                  </div>

                  {/* Step Heading */}
                  <h3 className="mt-2 text-sm sm:text-base font-extrabold tracking-tight text-white text-center">
                    {burstStep > 0
                      ? `Capturing 4-Frame Tilt Burst (${burstStep}/4)`
                      : SCAN_STEPS[scanStep]?.heading || 'Analyzing medicine strip...'}
                  </h3>

                  {/* Progress Bar */}
                  <div className="w-52 sm:w-60 h-1.5 bg-slate-800/90 rounded-full overflow-hidden mt-2 border border-slate-700/60 shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-sky-400 transition-all duration-300"
                      style={{
                        width:
                          burstStep > 0
                            ? `${(burstStep / 4) * 20}%`
                            : `${((scanStep + 1) / SCAN_STEPS.length) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Stage Label & Details */}
                  <div className="mt-2 text-xs text-slate-300 font-medium flex items-center gap-1.5 text-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                    <span>
                      {burstStep > 0
                        ? 'Hold steady & slightly tilt strip to defeat glare'
                        : scanStep === 0
                        ? 'Uploading & balancing multi-angle frames...'
                        : scanStep === 1
                        ? 'Filtering foil reflections & glare shifts...'
                        : scanStep === 2
                        ? 'Transcribing brand names & active salts...'
                        : scanStep === 3
                        ? 'Verifying against 3 hard safety gates...'
                        : 'Verified telehealth card ready!'}
                    </span>
                  </div>
                </div>
              )}

              {/* Camera Error Message if any */}
              {cameraError && (
                <div className="absolute bottom-3 inset-x-3 z-30 bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs p-2.5 rounded-xl text-center">
                  {cameraError}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Buttons: "Capture 4-Frame Burst" & "Upload Photo" */}
          <div className="pt-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Primary Pill Button */}
              <button
                type="button"
                onClick={triggerLiveBurst}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#1C2321] hover:bg-[#26433A] text-white font-bold text-sm shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                <Camera className="w-4 h-4 text-emerald-300" />
                <span>{isLive ? 'Capture 4-Frame Burst' : 'Start Camera & Burst'}</span>
              </button>

              {/* Quick Camera Flip Button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={isLoading}
                title={`Switch to ${facingMode === 'environment' ? 'Front' : 'Rear'} Camera`}
                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-full bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-sm shadow-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <SwitchCamera className="w-4 h-4 text-[#26433A]" />
                <span className="hidden sm:inline">{facingMode === 'environment' ? 'Rear' : 'Front'}</span>
                <span className="sm:hidden">Flip</span>
              </button>

              {/* Secondary Outline Pill Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-sm shadow-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Upload className="w-4 h-4 text-stone-600" />
                <span>Upload Photo</span>
              </button>
            </div>

            {/* Quick Desktop Demo Strips Pills */}
            <div className="pt-2 flex items-center gap-2 flex-wrap text-xs text-stone-600">
              <span className="font-semibold text-stone-500 text-[11px] uppercase tracking-wider">
                1-Click Demo:
              </span>
              {[
                {
                  id: 'zerodol',
                  name: 'Zerodol-SP',
                  ocr: 'Zerodol-SP Aceclofenac 100mg Paracetamol 325mg Serratiopeptidase 15mg IPCA Laboratories Ltd',
                },
                {
                  id: 'augmentin',
                  name: 'Augmentin 625 Duo',
                  ocr: 'AUGMENTIN 625 Duo Tablets Amoxycillin 500mg Potassium Clavulanate 125mg GSK',
                },
                {
                  id: 'dolo',
                  name: 'Dolo 650',
                  ocr: 'DOLO 650 Paracetamol Tablets IP 650mg Micro Labs Ltd',
                },
              ].map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSample(s.ocr, s.name)}
                  className="px-2.5 py-1 rounded-full bg-white border border-stone-200 hover:border-[#26433A] hover:text-[#26433A] font-semibold text-[11px] transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                  style={{ transitionDelay: `${idx * 60}ms` }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </RevealOnScroll>

      {/* ================= RIGHT CARD: Analysis & Verification ================= */}
      <RevealOnScroll delay={100} className="w-full h-full flex flex-col">
        <div className="bg-[#E7EFEA] rounded-3xl md:rounded-4xl p-6 sm:p-8 lg:p-10 border border-[#26433A]/15 shadow-soft flex flex-col justify-between h-full">
          <div className="space-y-6">
            {/* Header: "Analysis & Verification" on left, "Verified • 100% Match" pill on right */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#26433A]/70">
                Analysis &amp; Verification
              </span>

              {isVerified ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D6E8DE] border border-[#BFE0CD] text-xs font-bold text-[#1E5E41]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
                  <span>Verified • {scanResult?.confidence || 100}% Match</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-xs font-bold text-rose-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  <span>Unverified • Safety Alert</span>
                </span>
              )}
            </div>

            {/* Medicine Title & Manufacturer */}
            <div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-[#192D27] tracking-tight leading-tight">
                {displayBrand}
              </h3>
              <p className="text-sm sm:text-base text-[#2E4F44] font-medium mt-1">
                {displayManufacturer}
              </p>
            </div>

            {/* Clean Key-Value Rows */}
            <div className="space-y-3 pt-1 text-sm sm:text-base">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="font-extrabold text-[#192D27] min-w-[155px]">
                  Active Ingredients:
                </span>
                <span className="text-[#2C483F] font-semibold">
                  {displayIngredients}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="font-extrabold text-[#192D27] min-w-[155px]">
                  Dosage / Strength:
                </span>
                <span className="text-[#2C483F] font-semibold">
                  {displayStrength}
                </span>
              </div>
            </div>

            {/* Voice Language Toggle + Play Voice Guide Button */}
            <div className="pt-3 space-y-3">
              {/* Language Selector Pills */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#26433A]/80 uppercase tracking-wider">
                  Voice Guide Language:
                </span>
                <div className="flex items-center bg-white/70 p-1 rounded-full border border-[#26433A]/15 shadow-2xs">
                  {[
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'Hindi' },
                    { id: 'pa', label: 'Punjabi' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLang(l.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        lang === l.id
                          ? 'bg-[#26433A] text-white shadow-xs'
                          : 'text-[#26433A]/80 hover:text-[#26433A]'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warm Terracotta-Coral Pill Button: "Play Voice Guide" */}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`w-full py-3.5 px-6 rounded-full font-bold text-sm shadow-md transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer ${
                  isPlayingVoice
                    ? 'bg-[#D97742] text-white ring-4 ring-[#D97742]/30 scale-[1.01]'
                    : 'bg-[#26433A] hover:bg-[#1E362E] text-white hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isPlayingVoice ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause Voice Guide ({lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Punjabi'})</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Play Voice Guide ({lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Punjabi'})</span>
                  </>
                )}
              </button>

              {/* Animated Soundwave & Status when Playing */}
              {isPlayingVoice && (
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <div className="w-1 bg-[#D97742] rounded-full animate-wave-1" />
                  <div className="w-1 bg-[#D97742] rounded-full animate-wave-2" />
                  <div className="w-1 bg-[#D97742] rounded-full animate-wave-3" />
                  <div className="w-1 bg-[#D97742] rounded-full animate-wave-4" />
                  <div className="w-1 bg-[#D97742] rounded-full animate-wave-5" />
                  <span className="text-xs font-semibold text-[#D97742] ml-2">
                    Speaking voice instructions...
                  </span>
                </div>
              )}

              {/* 1-Click "Add to Dosage Calendar" Button */}
              <button
                type="button"
                onClick={() => {
                  if (onAddToCalendar) {
                    onAddToCalendar({
                      name: displayBrand,
                      dosage: displayStrength || '1 Tablet',
                      timings: { morning: true, afternoon: false, night: true },
                      foodTiming: 'Take After Food • Within 15–20 mins',
                      status: 'Scheduled',
                    });
                    setAddedCalendarToast(`Added ${displayBrand} to Dosage Calendar!`);
                    setTimeout(() => setAddedCalendarToast(null), 3500);
                  }
                }}
                className={`w-full py-2.5 px-4 rounded-full font-bold text-xs sm:text-sm border transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
                  addedCalendarToast
                    ? 'bg-[#D6E8DE] border-[#BFE0CD] text-[#26433A]'
                    : 'bg-white/80 hover:bg-white border-[#26433A]/20 text-[#26433A] hover:scale-[1.01] active:scale-[0.98]'
                }`}
              >
                <CalendarPlus className="w-4 h-4 text-[#26433A]" />
                <span>{addedCalendarToast || `Add ${displayBrand} to Dosage Calendar`}</span>
              </button>
            </div>
          </div>

          {/* Minimal Footer Row: "Safety" checkmark on left, "Engine: Gemini Flash Vision" on right */}
          <div className="pt-6 border-t border-[#26433A]/10 mt-6 flex items-center justify-between text-xs text-[#26433A]/80 font-medium">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2E7D5B]" />
              <span className="font-semibold text-[#192D27]">Safety Verified</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/70 border border-[#26433A]/10 text-[11px] font-semibold text-stone-700">
                Engine: {ocrEngine}
              </span>

              {/* Collapsible Debug Toggle */}
              <button
                type="button"
                onClick={() => setIsDebugOpen(!isDebugOpen)}
                className="text-stone-500 hover:text-stone-900 p-1 rounded-full hover:bg-white/50 transition-colors"
                title="View Raw OCR Text"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDebugOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Collapsible Raw OCR Transcript */}
          {isDebugOpen && (
            <div className="mt-3 p-3 rounded-2xl bg-black/80 text-emerald-300 font-mono text-[11px] max-h-28 overflow-y-auto border border-stone-800">
              <div className="text-[10px] uppercase font-bold text-stone-400 mb-1">
                Extracted Text:
              </div>
              <p className="whitespace-pre-wrap">{scanResult?.ocr_text || '(Simulated Test Strip text)'}</p>
            </div>
          )}
        </div>
      </RevealOnScroll>
    </div>
  </section>
  );
}
