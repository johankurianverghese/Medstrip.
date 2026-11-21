import React, { useEffect, useRef, useState } from 'react';
import { Volume2, RotateCcw, Play, Pause } from 'lucide-react';

// Module-scoped voice cache & reference to prevent Chromium garbage collection bug
let cachedVoices = [];
let activeUtterance = null;

const initVoices = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        cachedVoices = voices;
      }
    } catch (e) {
      console.warn('[TTS] Failed to read voices:', e);
    }
  }
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  initVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      initVoices();
    };
  }
}

export const getBestVoiceForLanguage = (lang = 'en') => {
  initVoices();
  const voices = cachedVoices.length > 0
    ? cachedVoices
    : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);

  const cleanLang = (lang || 'en').toLowerCase();

  if (!voices || voices.length === 0) {
    return {
      voice: null,
      langCode: cleanLang === 'en' ? 'en-IN' : (cleanLang === 'hi' ? 'hi-IN' : 'pa-IN')
    };
  }

  if (cleanLang === 'en') {
    // Priority order: Indian English (en-IN) -> British English -> US English -> any English -> default
    const enIn = voices.find((v) => v.lang && v.lang.toLowerCase() === 'en-in');
    if (enIn) return { voice: enIn, langCode: 'en-IN' };

    const enGb = voices.find((v) => v.lang && v.lang.toLowerCase() === 'en-gb');
    if (enGb) return { voice: enGb, langCode: enGb.lang };

    const enUs = voices.find((v) => v.lang && v.lang.toLowerCase() === 'en-us');
    if (enUs) return { voice: enUs, langCode: enUs.lang };

    const anyEn = voices.find(
      (v) => (v.lang && v.lang.toLowerCase().startsWith('en')) || (v.name && v.name.toLowerCase().includes('english'))
    );
    if (anyEn) return { voice: anyEn, langCode: anyEn.lang };

    // Fall back to default browser voice with safe 'en-IN' locale
    const defaultVoice = voices.find((v) => v.default) || voices[0];
    return { voice: defaultVoice || null, langCode: 'en-IN' };
  }

  if (cleanLang === 'hi') {
    const hiIn = voices.find(
      (v) => (v.lang && (v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase().startsWith('hi'))) ||
             (v.name && v.name.toLowerCase().includes('hindi'))
    );
    if (hiIn) return { voice: hiIn, langCode: 'hi-IN' };

    const defaultVoice = voices.find((v) => v.default) || voices[0];
    return { voice: defaultVoice || null, langCode: 'hi-IN' };
  }

  if (cleanLang === 'pa') {
    const paIn = voices.find(
      (v) => (v.lang && (v.lang.toLowerCase() === 'pa-in' || v.lang.toLowerCase().startsWith('pa'))) ||
             (v.name && v.name.toLowerCase().includes('punjabi'))
    );
    if (paIn) return { voice: paIn, langCode: 'pa-IN' };

    // Often Punjabi shares Hindi voice models on Windows/Android
    const hiFallback = voices.find(
      (v) => v.lang && (v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase().startsWith('hi'))
    );
    if (hiFallback) return { voice: hiFallback, langCode: 'hi-IN' };

    const defaultVoice = voices.find((v) => v.default) || voices[0];
    return { voice: defaultVoice || null, langCode: 'pa-IN' };
  }

  return { voice: null, langCode: 'en-IN' };
};

export const stopBrowserTTS = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
    activeUtterance = null;
    if (typeof window !== 'undefined') window._activeUtterance = null;
  }
};

export const speakWithBrowserTTS = (text, lang = 'en', onStart, onEnd, onError) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('[TTS] window.speechSynthesis is not supported on this device/browser.');
    if (onError) onError(new Error('SpeechSynthesis not supported'));
    return false;
  }

  if (!text || !text.trim()) {
    console.warn('[TTS] Empty text provided for speech synthesis.');
    return false;
  }

  // Workaround for Chromium .cancel() race condition:
  // If canceling an in-flight utterance, wait a small 50ms tick before queuing the new utterance
  const executeSpeak = () => {
    try {
      const { voice, langCode } = getBestVoiceForLanguage(lang);
      const utterance = new SpeechSynthesisUtterance(text);

      if (voice) {
        utterance.voice = voice;
      }
      utterance.lang = langCode || (lang === 'en' ? 'en-US' : (lang === 'hi' ? 'hi-IN' : 'pa-IN'));
      utterance.volume = 1.0;
      utterance.rate = 0.95; // clear, gentle speed for patients & seniors
      utterance.pitch = 1.0;

      utterance.onstart = (e) => {
        console.log(`[TTS] Spoken voice started using voice: "${voice?.name || 'Browser Default'}" [${utterance.lang}]`);
        if (onStart) onStart(e);
      };

      utterance.onend = (e) => {
        console.log('[TTS] Spoken voice finished.');
        activeUtterance = null;
        if (typeof window !== 'undefined') window._activeUtterance = null;
        if (onEnd) onEnd(e);
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          console.warn('[TTS] SpeechSynthesis error:', e.error || e);
        }
        activeUtterance = null;
        if (typeof window !== 'undefined') window._activeUtterance = null;
        if (onError) onError(e);
      };

      // Keep strong reference in module & window to prevent Chromium GC mid-speech
      activeUtterance = utterance;
      if (typeof window !== 'undefined') window._activeUtterance = utterance;

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.error('[TTS] Failed to execute speechSynthesis.speak:', err);
      if (onError) onError(err);
      return false;
    }
  };

  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
    setTimeout(executeSpeak, 50);
  } else {
    executeSpeak();
  }

  return true;
};

export default function AudioPlayer({ audioBase64, speechText, lang = 'en', autoPlay = true }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [hasBlockedAutoplay, setHasBlockedAutoplay] = useState(false);

  // Check if backend returned real spoken MP3 vs offline fallback chime WAV
  const isChimeFallback = audioBase64 && audioBase64.startsWith('data:audio/wav');
  const hasSpokenAudio = audioBase64 && !isChimeFallback && audioBase64.startsWith('data:audio/');

  const playWithBrowserSpeech = () => {
    const success = speakWithBrowserTTS(
      speechText,
      lang,
      () => {
        setIsPlaying(true);
        setStatusMsg('Playing voice instructions...');
      },
      () => {
        setIsPlaying(false);
        setStatusMsg('');
      },
      (err) => {
        setIsPlaying(false);
        if (err && (err.error === 'not-allowed' || err.name === 'NotAllowedError')) {
          setHasBlockedAutoplay(true);
          setStatusMsg('Audio waiting — tap Play to listen');
        } else {
          setStatusMsg('Voice ready — tap Play');
        }
      }
    );

    if (!success) {
      setIsPlaying(false);
      setStatusMsg('Audio ready — click Play');
    }
  };

  const startPlayback = () => {
    setStatusMsg('');
    setHasBlockedAutoplay(false);

    // If real backend MP3 speech audio is available, attempt HTML5 audio first
    if (hasSpokenAudio && audioRef.current) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setStatusMsg('Playing recorded audio...');
          })
          .catch((err) => {
            console.log('[AudioPlayer] Audio tag play failed, falling back to browser TTS:', err);
            if (err.name === 'NotAllowedError') {
              setHasBlockedAutoplay(true);
              setStatusMsg('Audio waiting — tap Play to listen');
              setIsPlaying(false);
            } else {
              playWithBrowserSpeech();
            }
          });
      }
    } else {
      // Offline / fallback chime: Speak directly with browser SpeechSynthesis so the user actually hears speech!
      playWithBrowserSpeech();
    }
  };

  const stopAllPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    stopBrowserTTS();
    setIsPlaying(false);
  };

  // Trigger playback when audio or text changes
  useEffect(() => {
    if (speechText && autoPlay) {
      startPlayback();
    }
    return () => {
      stopAllPlayback();
    };
  }, [audioBase64, speechText, lang]);

  const togglePlay = () => {
    if (isPlaying) {
      stopAllPlayback();
    } else {
      startPlayback();
    }
  };

  const handleReplay = () => {
    stopAllPlayback();
    setTimeout(() => {
      startPlayback();
    }, 60);
  };

  if (!audioBase64 && !speechText) return null;

  const voiceName = lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Punjabi';

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-lg border border-emerald-500/40 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

      {/* Hidden HTML5 Audio Element for backend MP3 streams */}
      <audio
        ref={audioRef}
        src={hasSpokenAudio ? audioBase64 : undefined}
        onEnded={() => {
          setIsPlaying(false);
          setStatusMsg('');
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <div className="flex items-start gap-4">
        {/* Giant Play / Pause Button for easy touch target */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all shadow-md transform active:scale-95 ${
            isPlaying
              ? 'bg-amber-400 text-amber-950 ring-4 ring-amber-300/50 animate-pulse'
              : 'bg-white text-emerald-800 hover:bg-emerald-50 ring-4 ring-white/30'
          }`}
          aria-label={isPlaying ? 'Pause voice' : 'Play voice'}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 fill-current" />
          ) : (
            <Play className="w-8 h-8 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Spoken Text & Controls */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Voice Instructions ({voiceName})</span>
            </span>

            {/* Replay Button */}
            <button
              type="button"
              onClick={handleReplay}
              className="text-xs bg-white/15 hover:bg-white/25 active:bg-white/30 px-2.5 py-1 rounded-lg flex items-center gap-1 text-emerald-100 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Replay Voice</span>
            </button>
          </div>

          {/* Large spoken text transcription */}
          <p className="text-sm md:text-base font-medium leading-snug text-white/95 line-clamp-3">
            {speechText}
          </p>

          {/* Status feedback & animated sound wave bars */}
          <div className="flex items-center gap-2 mt-2.5 min-h-[20px]">
            {isPlaying ? (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-3.5 bg-amber-300 rounded-full animate-wave-1" />
                <div className="w-1 h-3.5 bg-amber-300 rounded-full animate-wave-2" />
                <div className="w-1 h-3.5 bg-amber-300 rounded-full animate-wave-3" />
                <div className="w-1 h-3.5 bg-amber-300 rounded-full animate-wave-4" />
                <div className="w-1 h-3.5 bg-amber-300 rounded-full animate-wave-5" />
                <span className="text-[11px] text-amber-200 ml-1 font-semibold">
                  Playing voice instructions...
                </span>
              </div>
            ) : statusMsg ? (
              <span className="text-[11px] bg-black/20 text-emerald-100 px-2 py-0.5 rounded-md font-medium">
                {statusMsg}
              </span>
            ) : (
              <span className="text-[10px] text-emerald-200/70 font-medium">
                Tap Play to listen anytime
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
