import React from 'react';
import { EyeOff, ShieldCheck, Mic } from 'lucide-react';

export default function UtilityBar() {
  return (
    <div className="w-full bg-[#F7F5F0] border-b border-stone-200/70 py-2.5 sm:py-3 min-h-[38px] flex items-center">
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 flex items-center justify-center gap-6 sm:gap-14 text-xs text-stone-600 font-semibold tracking-wide">
        <div className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
          <EyeOff className="w-3.5 h-3.5 text-[#26433A]" />
          <span>Offline Ready</span>
        </div>
        <div className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D5B]" />
          <span>3 Safety Gates</span>
        </div>
        <div className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
          <Mic className="w-3.5 h-3.5 text-[#D97742]" />
          <span>English, Hindi &amp; Punjabi Voice</span>
        </div>
      </div>
    </div>
  );
}
