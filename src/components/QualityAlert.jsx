import React from 'react';
import { AlertTriangle, Sparkles, Smartphone, Move } from 'lucide-react';

export default function QualityAlert({ issue, blurScore, glarePct, reason, onRetry }) {
  if (!issue) return null;

  const isGlare = issue === 'GLARE' || issue === 'BOTH';
  const isBlur = issue === 'BLUR' || issue === 'BOTH';

  return (
    <div className="bg-amber-500/15 border-2 border-amber-400 rounded-3xl p-5 shadow-sm text-slate-800">
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
          {isGlare ? <Sparkles className="w-6 h-6 animate-pulse" /> : <AlertTriangle className="w-6 h-6" />}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
              Unclear Photo Detected
            </span>
            <span className="text-xs text-amber-900/70 font-medium">
              {isGlare && `Glare: ${glarePct}%`} {isBlur && `Blur Score: ${blurScore}`}
            </span>
          </div>

          <h3 className="font-bold text-base text-slate-900 mb-1 leading-snug">
            {isGlare && isBlur
              ? 'Please tilt strip slightly away from light and hold hands steady'
              : isGlare
              ? 'Foil glare detected — tilt strip slightly away from light'
              : 'Camera shake or blur detected — hold hands steady and retake photo'}
          </h3>

          <p className="text-sm text-slate-700 mb-3">
            {reason ||
              (isGlare && isBlur
                ? 'High reflection on blister foil and motion blur. Please adjust angle and steady camera.'
                : isGlare
                ? 'Strong specular light reflection on foil makes medicine text unreadable.'
                : 'Image is blurred. Hold smartphone firmly with both hands and retake.')}
          </p>

          {/* Visual cue icon banner */}
          <div className="flex items-center gap-2 py-2 px-3 bg-white/80 rounded-xl border border-amber-200 text-xs font-semibold text-amber-900">
            {isGlare ? (
              <>
                <Move className="w-4 h-4 text-amber-600 animate-bounce" />
                <span>Tip: Hold the strip at a slight angle away from direct ceiling light or bulb</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Tip: Hold the mobile phone firmly with both hands or rest elbows on a table</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
