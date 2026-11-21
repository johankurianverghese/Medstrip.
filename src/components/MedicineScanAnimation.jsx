import React from 'react';

export const SCAN_STEPS = [
  { id: 0, label: 'Uploading your photo', heading: 'Uploading your photo...' },
  { id: 1, label: 'Scanning the label', heading: 'Scanning the label...' },
  { id: 2, label: 'Reading medicine names', heading: 'Reading medicine names...' },
  { id: 3, label: 'Checking against the medicine list', heading: 'Checking against the medicine list...' },
  { id: 4, label: 'Preparing your card', heading: 'Preparing your card...' },
];

/**
 * Drop-in React component for Strip Reader's loading & processing screen.
 *
 * Props:
 *   activeStep (number 0..4):
 *     0 = Uploading your photo (4-frame tilt burst)
 *     1 = Scanning the label (laser sweep + glare shift)
 *     2 = Reading medicine names (OCR token lock-on)
 *     3 = Checking against the medicine list (3 safety gates)
 *     4 = Preparing your card (verified schedule glow)
 */
export function MedicineScanAnimation({ activeStep = 1 }) {
  const isUploading = activeStep === 0;
  const isScanning = activeStep === 1;
  const isReading = activeStep === 2;
  const isChecking = activeStep === 3;
  const isPreparing = activeStep >= 4;

  const badgeText = isUploading
    ? '4-FRAME TILT'
    : isScanning
    ? 'GLARE FILTER'
    : isReading
    ? 'LITERAL OCR'
    : isChecking
    ? '3 SAFETY GATES'
    : 'READY';

  return (
    <div className="msa-wrapper" aria-label="Scanning medicine strip animation">
      <style>{`
        .msa-wrapper {
          position: relative;
          width: 240px;
          height: 152px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 720px;
          user-select: none;
        }
        .msa-glow {
          position: absolute;
          inset: 10px 20px;
          border-radius: 28px;
          background: radial-gradient(circle, rgba(45, 212, 191, 0.24) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 75%);
          filter: blur(14px);
          pointer-events: none;
        }
        .msa-frame {
          position: relative;
          width: 214px;
          height: 132px;
          border-radius: 18px;
          background: rgba(10, 22, 46, 0.72);
          border: 1px solid rgba(56, 189, 248, 0.22);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .msa-corner {
          position: absolute;
          width: 15px;
          height: 15px;
          border-style: solid;
          border-color: #2dd4bf;
          pointer-events: none;
          transition: border-color 0.35s ease;
        }
        .msa-corner.verified { border-color: #34d399; }
        .msa-tl { top: 8px; left: 8px; border-width: 2.5px 0 0 2.5px; border-top-left-radius: 5px; }
        .msa-tr { top: 8px; right: 8px; border-width: 2.5px 2.5px 0 0; border-top-right-radius: 5px; }
        .msa-bl { bottom: 8px; left: 8px; border-width: 0 0 2.5px 2.5px; border-bottom-left-radius: 5px; }
        .msa-br { bottom: 8px; right: 8px; border-width: 0 2.5px 2.5px 0; border-bottom-right-radius: 5px; }

        .msa-strip {
          position: relative;
          width: 158px;
          height: 86px;
          border-radius: 11px;
          background:
            repeating-linear-gradient(
              45deg,
              rgba(255, 255, 255, 0.08) 0px,
              rgba(255, 255, 255, 0.08) 2px,
              rgba(15, 23, 42, 0.04) 2px,
              rgba(15, 23, 42, 0.04) 4px
            ),
            linear-gradient(135deg, #cbd5e1 0%, #f1f5f9 35%, #94a3b8 68%, #e2e8f0 100%);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.9);
          padding: 9px 11px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          transform-style: preserve-3d;
          animation: msaTilt 3.2s ease-in-out infinite;
        }
        .msa-strip.steady {
          animation: none;
          transform: rotateY(0deg) rotateX(0deg);
          transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes msaTilt {
          0%, 100% { transform: rotateY(-14deg) rotateX(4deg); }
          50% { transform: rotateY(14deg) rotateX(-4deg); }
        }

        .msa-cells {
          position: absolute;
          inset: 7px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(2, 1fr);
          gap: 6px;
          opacity: 0.28;
          pointer-events: none;
        }
        .msa-cell {
          border-radius: 9999px;
          background: radial-gradient(circle at 35% 30%, #ffffff, rgba(100, 116, 139, 0.45));
        }

        .msa-glare {
          position: absolute;
          top: -30%;
          bottom: -30%;
          width: 42%;
          background: linear-gradient(
            105deg,
            rgba(255, 255, 255, 0.0) 0%,
            rgba(255, 255, 255, 0.85) 50%,
            rgba(255, 255, 255, 0.0) 100%
          );
          transform: skewX(-18deg);
          mix-blend-mode: screen;
          pointer-events: none;
          animation: msaGlare 3.2s ease-in-out infinite;
        }
        @keyframes msaGlare {
          0%, 100% { left: -28%; opacity: 0.85; }
          50% { left: 95%; opacity: 0.9; }
        }

        .msa-beam {
          position: absolute;
          left: 12px;
          right: 12px;
          height: 2.5px;
          border-radius: 9999px;
          background: linear-gradient(90deg, transparent, #2dd4bf, #e0f2fe, #2dd4bf, transparent);
          box-shadow: 0 0 12px 3px rgba(45, 212, 191, 0.8);
          pointer-events: none;
          animation: msaBeam 1.5s ease-in-out infinite;
        }
        @keyframes msaBeam {
          0% { top: 18px; }
          50% { top: 112px; }
          100% { top: 18px; }
        }

        .msa-line {
          position: relative;
          z-index: 2;
          border-radius: 3px;
          background: rgba(15, 23, 42, 0.72);
          transition: background 0.3s ease, box-shadow 0.3s ease;
        }
        .msa-line.ocr-lit {
          background: #0f766e;
          box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.55);
        }

        .msa-badge {
          position: absolute;
          bottom: 7px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(6, 20, 42, 0.9);
          border: 1px solid rgba(45, 212, 191, 0.45);
          color: #5eead4;
          white-space: nowrap;
          z-index: 5;
        }
        .msa-badge.done {
          border-color: rgba(52, 211, 153, 0.65);
          color: #6ee7b7;
        }

        .msa-gates {
          position: absolute;
          top: 9px;
          right: 26px;
          display: flex;
          gap: 4px;
          z-index: 5;
        }
        .msa-gate-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #334155;
          transition: background 0.3s ease, transform 0.3s ease;
        }
        .msa-gate-dot.pass {
          background: #34d399;
          box-shadow: 0 0 6px rgba(52, 211, 153, 0.85);
          transform: scale(1.15);
        }
      `}</style>

      <div className="msa-glow" />
      <div className="msa-frame">
        <div className={`msa-corner msa-tl ${isPreparing ? 'verified' : ''}`} />
        <div className={`msa-corner msa-tr ${isPreparing ? 'verified' : ''}`} />
        <div className={`msa-corner msa-bl ${isPreparing ? 'verified' : ''}`} />
        <div className={`msa-corner msa-br ${isPreparing ? 'verified' : ''}`} />

        {(isChecking || isPreparing) && (
          <div className="msa-gates" title="3 Hard Safety Gates">
            <span className="msa-gate-dot pass" />
            <span className="msa-gate-dot pass" />
            <span className={`msa-gate-dot ${isPreparing ? 'pass' : ''}`} />
          </div>
        )}

        <div className={`msa-strip ${isChecking || isPreparing ? 'steady' : ''}`}>
          <div className="msa-cells">
            <div className="msa-cell" /><div className="msa-cell" /><div className="msa-cell" /><div className="msa-cell" />
            <div className="msa-cell" /><div className="msa-cell" /><div className="msa-cell" /><div className="msa-cell" />
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className={`msa-line ${isReading ? 'ocr-lit' : ''}`} style={{ width: '74px', height: '10px' }} />
            <div style={{ width: '24px', height: '8px', borderRadius: '3px', background: '#0f5c6e' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div className={`msa-line ${isReading ? 'ocr-lit' : ''}`} style={{ width: '116px', height: '6px', opacity: 0.78 }} />
            <div className={`msa-line ${isReading ? 'ocr-lit' : ''}`} style={{ width: '88px', height: '5px', opacity: 0.55 }} />
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(15,23,42,0.4)' }} />
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(15,23,42,0.4)' }} />
          </div>

          {!isPreparing && <div className="msa-glare" />}
        </div>

        {(isUploading || isScanning || isReading) && <div className="msa-beam" />}

        <div className={`msa-badge ${isPreparing ? 'done' : ''}`}>
          {isPreparing ? '✓ ' : ''}{badgeText}
        </div>
      </div>
    </div>
  );
}

export default MedicineScanAnimation;
