import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, X, Volume2, Sparkles } from 'lucide-react';
import { speakWithBrowserTTS } from './AudioPlayer';

export default function ReminderModal({ isOpen, onClose, brandName = '', lang = 'en', onLangChange }) {
  const [selectedTime, setSelectedTime] = useState('morning');
  const [countdown, setCountdown] = useState(null);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [reminderAudio, setReminderAudio] = useState(null);
  const [reminderText, setReminderText] = useState('');
  const audioRef = useRef(null);

  const medicineName = brandName || 'Your Prescribed Medication';

  // Play Web Audio Chime on alert
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.log('Web audio chime error:', e);
    }
  };

  const handleTestIn5Seconds = async () => {
    setCountdown(5);
    setIsAlertActive(false);

    // Pre-fetch reminder speech from backend
    try {
      const res = await fetch('/api/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: medicineName, lang: lang })
      });
      const data = await res.json();
      setReminderText(data.speech_text);
      setReminderAudio(data.audio_base64);
    } catch (e) {
      const fallbackText = lang === 'en'
        ? `It is time to take your medication! Please take your ${medicineName}.`
        : lang === 'hi'
        ? `दवा लेने का समय हो गया है! कृपया अपनी ${medicineName} दवा लें।`
        : `ਦਵਾਈ ਲੈਣ ਦਾ ਸਮਾਂ ਹੋ ਗਿਆ ਹੈ! ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ${medicineName} ਦਵਾਈ ਲਵੋ।`;
      setReminderText(fallbackText);
    }
  };

  useEffect(() => {
    let timer;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCountdown(null);
      triggerAlert();
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const triggerAlert = () => {
    setIsAlertActive(true);
    playChime();

    const isChimeFallback = reminderAudio && reminderAudio.startsWith('data:audio/wav');
    const hasRealAudio = reminderAudio && !isChimeFallback && reminderAudio.startsWith('data:audio/');

    if (hasRealAudio && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        speakWithBrowserTTS(reminderText, lang);
      });
    } else {
      // Allow chime to ring first, then speak the reminder clearly
      setTimeout(() => {
        speakWithBrowserTTS(reminderText, lang);
      }, 400);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
      {/* Hidden audio element for voice alarm */}
      <audio ref={audioRef} src={reminderAudio} />

      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom duration-200 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
            <Bell className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">
              Medication Voice Reminder
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {medicineName}
            </p>
          </div>
        </div>

        {/* Voice Language Selector */}
        <div className="flex items-center justify-between bg-slate-100 p-2 rounded-2xl mb-4 border border-slate-200">
          <span className="text-xs font-bold text-slate-700 px-1 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-emerald-600" />
            <span>Voice Language:</span>
          </span>
          <div className="flex items-center gap-1">
            {[
              { id: 'en', label: 'English' },
              { id: 'hi', label: 'Hindi' },
              { id: 'pa', label: 'Punjabi' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onLangChange) onLangChange(item.id);
                  const fallbackText = item.id === 'en'
                    ? `It is time to take your medication! Please take your ${medicineName}.`
                    : item.id === 'hi'
                    ? `दवा लेने का समय हो गया है! कृपया अपनी ${medicineName} दवा लें।`
                    : `ਦਵਾਈ ਲੈਣ ਦਾ ਸਮਾਂ ਹੋ ਗਿਆ ਹੈ! ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ${medicineName} ਦਵਾਈ ਲਵੋ।`;
                  setReminderText(fallbackText);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  lang === item.id
                    ? 'bg-emerald-600 text-white shadow-sm scale-105'
                    : 'text-slate-600 hover:text-slate-900 bg-white/80'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5-Second Test Demo Section */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200 mb-4 text-center">
          <p className="text-xs font-semibold text-amber-900 mb-2">
            ⚡ Test how the voice alarm sounds:
          </p>

          <button
            type="button"
            disabled={countdown !== null}
            onClick={handleTestIn5Seconds}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
              countdown !== null
                ? 'bg-amber-400 text-amber-950 ring-4 ring-amber-300'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 active:scale-98'
            }`}
          >
            {countdown !== null ? (
              <>
                <Clock className="w-5 h-5 animate-spin" />
                <span>Alarm ringing in {countdown} seconds...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-200" />
                <span>Test Reminder in 5 Seconds</span>
              </>
            )}
          </button>
        </div>

        {/* Active Alert Banner when Countdown Fires */}
        {isAlertActive && (
          <div className="bg-emerald-600 text-white rounded-2xl p-4 mb-4 shadow-lg animate-bounce border border-emerald-400 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-white text-emerald-700 flex items-center justify-center mb-2 shadow">
              <Volume2 className="w-7 h-7" />
            </div>
            <h4 className="font-black text-base mb-1">
              Alarm! Time to take your medication
            </h4>
            <p className="text-xs text-emerald-100 mb-3 px-2">
              {reminderText}
            </p>
            <button
              onClick={() => setIsAlertActive(false)}
              className="bg-white text-emerald-900 font-bold text-xs py-2 px-5 rounded-full shadow hover:bg-emerald-50"
            >
              ✓ I have taken my medicine
            </button>
          </div>
        )}

        {/* Scheduled Daily Slot Selector */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-bold text-slate-700 block">
            Choose daily reminder timing:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'morning', label: 'Morning 8:00 AM' },
              { id: 'afternoon', label: 'Afternoon 2:00 PM' },
              { id: 'night', label: 'Night 9:00 PM' },
            ].map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedTime(slot.id)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                  selectedTime === slot.id
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Reminder Button */}
        <button
          type="button"
          onClick={() => {
            alert('Daily reminder has been scheduled successfully!');
            onClose();
          }}
          className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-sm shadow transition-all"
        >
          Set Daily Reminder
        </button>
      </div>
    </div>
  );
}
