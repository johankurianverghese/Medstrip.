import React from 'react';
import { FlaskConical } from 'lucide-react';

export default function SampleSelector({ onSelectSample, activeSampleId }) {
  const samples = [
    {
      id: 'augmentin-625',
      name: 'Augmentin 625 Duo',
      desc: 'Amoxycillin 500mg + Clavulanic Acid 125mg',
      badge: 'Verified',
      type: 'success',
      ocrText: 'AUGMENTIN 625 Duo Tablets Amoxycillin and Potassium Clavulanate Tablets IP 500 mg 125 mg GSK'
    },
    {
      id: 'azithral-500',
      name: 'Azithral 500',
      desc: 'Azithromycin 500mg Tablet',
      badge: 'Verified',
      type: 'success',
      ocrText: 'AZITHRAL 500 Azithromycin Tablets IP 500mg Alembic Pharmaceuticals'
    },
    {
      id: 'dolo-650',
      name: 'Dolo 650',
      desc: 'Paracetamol 650mg Tablet',
      badge: 'Verified',
      type: 'success',
      ocrText: 'DOLO 650 Paracetamol Tablets IP 650mg Micro Labs Ltd'
    },
    {
      id: 'strength-mismatch',
      name: 'Allegra 120mg (Gate 3 Test)',
      desc: 'OCR reads 180mg on 120mg brand -> Triggers Gate 3',
      badge: 'Gate 3: Mismatch',
      type: 'gate',
      ocrText: 'Allegra 120mg Fexofenadine Hydrochloride 180mg Sanofi India'
    },
    {
      id: 'foil-glare',
      name: 'Foil Glare Simulator',
      desc: 'Simulates high specular reflection on aluminum foil',
      badge: 'Glare Warning',
      type: 'glare',
      simulatedIssue: 'GLARE'
    },
    {
      id: 'motion-blur',
      name: 'Motion Blur Simulator',
      desc: 'Simulates low Laplacian variance (camera shake)',
      badge: 'Blur Warning',
      type: 'blur',
      simulatedIssue: 'BLUR'
    }
  ];

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
          <FlaskConical className="w-4 h-4 text-emerald-600" />
          <span>Test on Computer (Demo Strips)</span>
        </h3>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          1-Click Demo
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {samples.map((s) => {
          const isActive = activeSampleId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSample(s)}
              className={`p-2.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-sm scale-102'
                  : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100/80'
              }`}
            >
              <div>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block mb-1 ${
                    s.type === 'success'
                      ? 'bg-emerald-100 text-emerald-800'
                      : s.type === 'gate'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {s.badge}
                </span>
                <p className="font-bold text-xs text-slate-900 leading-tight mb-0.5">
                  {s.name}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-2 mt-1">
                {s.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
