import React from 'react';
import { Pill, Volume2 } from 'lucide-react';

export default function Header({ lang, setLang, dbReady }) {
  return (
    <header className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-lg sticky top-0 z-30">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        {/* App Title & Icon */}
        <div className="flex items-center space-x-2.5">
          <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-inner">
            <Pill className="w-6 h-6 text-emerald-100 transform -rotate-45" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide flex items-center gap-1.5">
              <span>Medicine Strip Reader</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-emerald-500/30 rounded border border-emerald-300/30">
                H10
              </span>
            </h1>
            <p className="text-[11px] text-emerald-200">
              Voice-Guided Medicine Assistant
            </p>
          </div>
        </div>

        {/* Voice Language Toggle: English | Hindi | Punjabi */}
        <div className="flex items-center bg-black/25 p-1 rounded-xl border border-white/15 gap-0.5">
          <span className="text-[11px] font-semibold text-emerald-200 px-1 hidden xs:flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" />
          </span>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${
              lang === 'en'
                ? 'bg-white text-emerald-900 shadow-md scale-105'
                : 'text-emerald-100 hover:text-white opacity-80'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('hi')}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${
              lang === 'hi'
                ? 'bg-white text-emerald-900 shadow-md scale-105'
                : 'text-emerald-100 hover:text-white opacity-80'
            }`}
          >
            Hindi
          </button>
          <button
            type="button"
            onClick={() => setLang('pa')}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${
              lang === 'pa'
                ? 'bg-white text-emerald-900 shadow-md scale-105'
                : 'text-emerald-100 hover:text-white opacity-80'
            }`}
          >
            Punjabi
          </button>
        </div>
      </div>
    </header>
  );
}
