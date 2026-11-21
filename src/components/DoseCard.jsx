import React from 'react';
import { Sun, Sunset, Moon, Utensils } from 'lucide-react';

export default function DoseCard({ schedule, onChange, editable = false, lang = 'en', onLangChange }) {
  const toggle = (key) => {
    if (!editable || !onChange) return;
    onChange({ ...schedule, [key]: !schedule[key] });
  };

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
          <span>Medication Schedule</span>
        </h3>
        {onLangChange ? (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {[
              { id: 'en', label: 'English' },
              { id: 'hi', label: 'Hindi' },
              { id: 'pa', label: 'Punjabi' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onLangChange(item.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                  lang === item.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {editable ? 'Select Timings' : 'Prescribed Timings'}
          </span>
        )}
      </div>

      {/* 3 Time Slots: Morning, Afternoon, Night */}
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        {/* Morning */}
        <button
          type="button"
          disabled={!editable}
          onClick={() => toggle('morning')}
          className={`flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl border-2 transition-all duration-200 ${
            schedule.morning
              ? 'bg-amber-500/10 border-amber-500 text-amber-900 shadow-sm'
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
          }`}
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 ${
            schedule.morning ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-200 text-slate-400'
          }`}>
            <Sun className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-xs font-bold leading-tight">
            Morning
          </span>
          <span className="text-[10px] text-slate-500">
            {schedule.morning ? '1 Tablet' : '-'}
          </span>
        </button>

        {/* Afternoon */}
        <button
          type="button"
          disabled={!editable}
          onClick={() => toggle('afternoon')}
          className={`flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl border-2 transition-all duration-200 ${
            schedule.afternoon
              ? 'bg-orange-500/10 border-orange-500 text-orange-900 shadow-sm'
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
          }`}
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 ${
            schedule.afternoon ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-200 text-slate-400'
          }`}>
            <Sunset className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold leading-tight">
            Afternoon
          </span>
          <span className="text-[10px] text-slate-500">
            {schedule.afternoon ? '1 Tablet' : '-'}
          </span>
        </button>

        {/* Night */}
        <button
          type="button"
          disabled={!editable}
          onClick={() => toggle('night')}
          className={`flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl border-2 transition-all duration-200 ${
            schedule.night
              ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 shadow-sm'
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
          }`}
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 ${
            schedule.night ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'
          }`}>
            <Moon className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold leading-tight">
            Night
          </span>
          <span className="text-[10px] text-slate-500">
            {schedule.night ? '1 Tablet' : '-'}
          </span>
        </button>
      </div>

      {/* Food Relationship: After Food vs Before Food */}
      <button
        type="button"
        disabled={!editable}
        onClick={() => toggle('after_food')}
        className={`w-full py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${
          schedule.after_food
            ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
            : 'bg-amber-50 border-amber-500 text-amber-900'
        }`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          schedule.after_food ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
        }`}>
          <Utensils className="w-4 h-4" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold">
            {schedule.after_food
              ? 'Take After Food'
              : 'Take Before Food (Empty Stomach)'}
          </p>
          <p className="text-[10px] text-slate-500">
            {schedule.after_food
              ? 'Within 15-20 minutes after breakfast or meals'
              : 'At least 30 minutes before meals'}
          </p>
        </div>
        {editable && (
          <span className="ml-auto text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
            Change
          </span>
        )}
      </button>
    </div>
  );
}
