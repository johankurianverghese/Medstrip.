import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, HelpCircle, Building2, Tag, Bug, ChevronDown } from 'lucide-react';

function OcrDebugSection({ result }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!result) return null;

  const detectedStrengthsStr = Array.isArray(result.detected_strengths)
    ? result.detected_strengths.join(', ')
    : (result.detected_strengths || result.strength || 'None');

  const ocrEngine = result.ocr_engine || 'Offline RapidOCR';
  const isGemini = ocrEngine.toLowerCase().includes('gemini');

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-200/80">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1"
      >
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <Bug className="w-3.5 h-3.5 text-slate-400" />
          <span>OCR Debug Info</span>
          <span className={`text-[10px] font-sans font-bold px-1.5 py-0.5 rounded border ${
            isGemini 
              ? 'bg-cyan-50 text-cyan-800 border-cyan-300' 
              : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}>
            {ocrEngine}
          </span>
          {result.confidence > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
              {result.confidence}%
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-2xl text-[11px] font-mono space-y-2 overflow-hidden shadow-inner">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-sans">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Engine:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isGemini ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-800 text-slate-300'
            }`}>
              {ocrEngine}
            </span>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider mb-1">
              Raw Extracted OCR Text:
            </div>
            <div className="bg-slate-950 p-2 rounded-xl text-emerald-400 whitespace-pre-wrap break-words max-h-28 overflow-y-auto border border-slate-800">
              {result.ocr_text || '(No text extracted)'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-sans text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Detected Strength:</span>
              <span className="text-amber-300 font-semibold">{detectedStrengthsStr}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Match Type:</span>
              <span className="text-slate-200 font-semibold">{result.match_type || 'Branded'}</span>
            </div>
            {result.burst_frames_count > 1 && (
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tilt Burst:</span>
                <span className="text-emerald-300 font-semibold">
                  {result.burst_frames_used} of {result.burst_frames_count} frames pooled to beat glare
                </span>
              </div>
            )}
            {result.gate_failed && (
              <div className="col-span-2">
                <span className="text-rose-400 block text-[10px] uppercase font-bold">Gate Failed:</span>
                <span className="text-rose-300 font-semibold">{result.gate_failed}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultCard({ result, onRescan, lang = 'en', onLangChange }) {
  if (!result) return null;

  const isVerified = result.status === 'VERIFIED';

  if (isVerified) {
    return (
      <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-emerald-500 overflow-hidden relative">
        {/* Top Verified Banner */}
        <div className="bg-emerald-600 text-white -mx-5 -mt-5 px-5 py-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-200" />
            <span className="font-bold text-sm tracking-wide">
              Medicine Verified Successfully
            </span>
          </div>
          <span className="bg-emerald-700/80 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-400/40">
            {result.confidence}% Match
          </span>
        </div>

        {/* Verification View Voice Language Selector */}
        {onLangChange && (
          <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-1.5 mb-3 text-xs">
            <span className="font-bold text-emerald-900">Voice Language:</span>
            <div className="flex items-center gap-1">
              {[
                { id: 'en', label: 'English' },
                { id: 'hi', label: 'Hindi' },
                { id: 'pa', label: 'Punjabi' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onLangChange(item.id)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                    lang === item.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-800 hover:text-emerald-950 bg-white border border-emerald-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Brand Name & Strength */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
              {result.brand_name}
            </h2>
          </div>

          {result.strength && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl font-bold text-base shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Dosage / Strength:</span>
              <span className="text-emerald-950 font-black">{result.strength}</span>
            </div>
          )}
        </div>

        {/* Generic Composition */}
        {result.generic_name && (
          <div className="mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              Active Ingredients (Generic Salt)
            </span>
            <p className="text-sm font-semibold text-slate-800">
              {result.generic_name}
            </p>
          </div>
        )}

        {/* Manufacturer & Price */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
          {result.manufacturer && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{result.manufacturer}</span>
            </div>
          )}
          {result.price > 0 && (
            <div className="flex items-center gap-1.5 justify-end font-semibold text-slate-900">
              <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>₹{result.price}</span>
            </div>
          )}
        </div>

        {/* Collapsible OCR Debug Section */}
        <OcrDebugSection result={result} />
      </div>
    );
  }

  // NOT_SURE Status — Safety Gate Enforced
  const gateFailed = result.gate_failed || '';
  let gateLabel = 'Safety Gate Triggered';
  let defaultReason = 'Medicine name or strength could not be verified with certainty.';

  if (gateFailed.includes('CONFIDENCE')) {
    gateLabel = 'Gate 1: Low Confidence (< 80%)';
    defaultReason = 'OCR match confidence is below the 80% safety threshold. Medicine cannot be confirmed with certainty.';
  } else if (gateFailed.includes('AMBIGUITY')) {
    gateLabel = 'Gate 2: Lookalike Medicine Ambiguity';
    defaultReason = 'Multiple lookalike medicine names found within 10% similarity margin.';
  } else if (gateFailed.includes('STRENGTH')) {
    gateLabel = 'Gate 3: Strength (mg/ml) Mismatched or Missing';
    defaultReason = `Expected strength (${result.expected_strength || 'standard'}) does not match strength detected on strip (${Array.isArray(result.detected_strengths) ? result.detected_strengths.join(', ') : (result.detected_strengths || 'none')}).`;
  }

  return (
    <div className="bg-rose-50/80 rounded-3xl p-5 shadow-sm border-2 border-rose-400 overflow-hidden text-slate-900">
      {/* Not Sure Warning Banner */}
      <div className="flex items-start gap-3.5 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-rose-200 text-rose-900 px-2 py-0.5 rounded-md">
              {gateLabel}
            </span>
          </div>
          <h3 className="font-black text-lg text-rose-950 leading-tight">
            Verification Inconclusive (Not Sure)
          </h3>
        </div>
      </div>

      {/* Verification View Voice Language Selector */}
      {onLangChange && (
        <div className="flex items-center justify-between bg-rose-100/70 border border-rose-200 rounded-xl px-3 py-1.5 mb-3 text-xs">
          <span className="font-bold text-rose-900">Voice Language:</span>
          <div className="flex items-center gap-1">
            {[
              { id: 'en', label: 'English' },
              { id: 'hi', label: 'Hindi' },
              { id: 'pa', label: 'Punjabi' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onLangChange(item.id)}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                  lang === item.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-800 hover:text-rose-950 bg-white border border-rose-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white/90 p-3.5 rounded-2xl border border-rose-200 text-sm text-slate-700 mb-4 space-y-2">
        <p className="font-medium text-rose-900">
          {result.reason || defaultReason}
        </p>
        <p className="text-xs text-slate-500 italic">
          ⚠️ Strict Safety Rule: Never guess medication. To prevent dangerous medication errors, AI will not guess uncertain medicines.
        </p>
      </div>

      {/* Suggested Action */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
        <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>
          Please take a clearer photo in good lighting, or consult a licensed doctor or pharmacist.
        </span>
      </div>

      {/* Collapsible OCR Debug Section */}
      <OcrDebugSection result={result} />
    </div>
  );
}
