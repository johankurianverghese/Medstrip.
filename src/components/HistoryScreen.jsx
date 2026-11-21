import React, { useState } from 'react';
import { ShieldCheck, Volume2, Clock, ArrowRight, Trash2 } from 'lucide-react';
import { speakWithBrowserTTS, stopBrowserTTS } from './AudioPlayer';
import RevealOnScroll from './RevealOnScroll';

export default function HistoryScreen({
  history = [],
  onClearHistory,
  onSelectHistoryItem,
  onNavigateToScanner,
  lang,
}) {
  const [playingId, setPlayingId] = useState(null);

  const handlePlayVoice = (item) => {
    if (playingId === item.id) {
      stopBrowserTTS();
      setPlayingId(null);
      return;
    }

    const voiceText =
      item.voice?.[lang]?.text ||
      item.speech_text ||
      `This medicine is ${item.brand_name || 'verified medicine'}. Contains ${item.generic_name || 'active salts'} ${item.strength || ''}.`;

    speakWithBrowserTTS(
      voiceText,
      lang,
      () => setPlayingId(item.id),
      () => setPlayingId(null),
      () => setPlayingId(null)
    );
  };

  return (
    <section id="history" className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 scroll-mt-6">
      <RevealOnScroll delay={0}>
        <div className="bg-[#E7EFEA] rounded-3xl md:rounded-4xl p-6 sm:p-8 lg:p-10 border border-[#D5E3DA] shadow-soft">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#D0DFD6] gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1C2321] tracking-tight">
                Scan History & Logs
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-medium mt-1">
                Verified medicine strips scanned across your sessions with voice replay.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/80 hover:bg-red-50 text-stone-600 hover:text-red-700 text-xs font-bold border border-stone-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}

              <button
                type="button"
                onClick={onNavigateToScanner}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#1C2321] hover:bg-[#26433A] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span>Scan New Strip</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Content list */}
          {history.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-white/80 border border-stone-200 flex items-center justify-center text-stone-400">
                <ShieldCheck className="w-7 h-7 text-[#26433A]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-800">
                  No medicine strips scanned yet
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 max-w-sm mx-auto">
                  Scan your first foil strip with 4-frame anti-glare capture to see verified safety analysis and audio logs here.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToScanner}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#26433A] hover:bg-[#1e362e] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
              >
                <span>Scan First Strip</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#D0DFD6]/60">
              {history.map((item, idx) => (
                <RevealOnScroll key={item.id} delay={idx * 70}>
                  <div className="py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/40 px-3 rounded-2xl transition-colors">
                    {/* Left info */}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-extrabold text-base sm:text-lg text-[#1C2321]">
                          {item.brand_name || 'Unknown Medicine'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D6E8DE] text-[#26433A] text-xs font-bold border border-[#BFE0CD]">
                          <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                          <span>{item.status === 'VERIFIED' ? 'Verified • 100%' : 'Analyzed'}</span>
                        </span>
                        <span className="text-xs text-stone-500 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" />
                          {item.timestamp || 'Just now'}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-stone-700 font-medium">
                        {item.generic_name || 'Active ingredients extracted'} • {item.strength || 'Standard dosage'}
                      </p>
                      <p className="text-xs text-stone-500">
                        Manufacturer: {item.manufacturer || 'Ipca Laboratories Ltd'}
                      </p>
                    </div>

                    {/* Right action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePlayVoice(item)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shadow-xs transition-all cursor-pointer ${
                          playingId === item.id
                            ? 'bg-[#D97742] text-white animate-pulse'
                            : 'bg-white hover:bg-stone-50 text-stone-800 border border-stone-200'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{playingId === item.id ? 'Playing...' : 'Replay Voice'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectHistoryItem(item);
                          onNavigateToScanner();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1C2321] hover:bg-[#26433A] text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          )}
        </div>
      </RevealOnScroll>
    </section>
  );
}
