import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Clock,
  Utensils,
  Bell,
  Volume2,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  AlertCircle,
  Pill,
} from 'lucide-react';
import { speakWithBrowserTTS, stopBrowserTTS } from './AudioPlayer';
import RevealOnScroll from './RevealOnScroll';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function CalendarScreen({
  calendarEvents = {},
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onToggleDoseStatus,
  lang = 'en',
  onNavigateToScanner,
  scanResult,
}) {
  // Calendar month/year navigation state (defaults to November 2026 to match telehealth prototype)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 10 = November (0-indexed)
  const [selectedDate, setSelectedDate] = useState('2026-11-21'); // Default selected: Nov 21, 2026

  // Alarms toggle states
  const [voiceAlarmEnabled, setVoiceAlarmEnabled] = useState(true);
  const [morningAlarm, setMorningAlarm] = useState(true);
  const [nightAlarm, setNightAlarm] = useState(true);

  // 5s Test Alarm State
  const [alarmCountdown, setAlarmCountdown] = useState(null);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [isPlayingDayVoice, setIsPlayingDayVoice] = useState(false);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);

  // Modal / Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null); // null when adding new
  const [formName, setFormName] = useState('');
  const [formDosage, setFormDosage] = useState('1 Tablet');
  const [formTimings, setFormTimings] = useState({ morning: true, afternoon: false, night: true });
  const [formFoodTiming, setFormFoodTiming] = useState('Take After Food • Within 15–20 mins');
  const [formStatus, setFormStatus] = useState('Scheduled');

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Format date helper
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    const dayName = DAY_NAMES[dateObj.getDay()];
    const monthName = MONTH_NAMES[m].slice(0, 3);
    return `${dayName}, ${monthName} ${d}, ${y}`;
  };

  // Selected date medicines
  const currentDayMeds = calendarEvents[selectedDate] || [];

  // Generate Calendar Matrix for current month
  // Monday-based (Mon=0, Tue=1, ..., Sun=6)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  const calendarCells = [];
  // Leading empty cells
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({ day: null });
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayMeds = calendarEvents[dateKey] || [];

    let status = 'none';
    if (dayMeds.length > 0) {
      const allTaken = dayMeds.every((m) => m.status === 'Taken');
      status = allTaken ? 'taken' : 'scheduled';
    }

    calendarCells.push({
      day: d,
      dateKey,
      status,
      isSelected: selectedDate === dateKey,
      isToday: dateKey === '2026-11-21',
      hasMeds: dayMeds.length > 0,
      count: dayMeds.length,
    });
  }

  // Group cells into rows of 7
  const calendarRows = [];
  for (let i = 0; i < calendarCells.length; i += 7) {
    calendarRows.push(calendarCells.slice(i, i + 7));
  }

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingMed(null);
    setFormName(scanResult?.brand_name || 'Zerodol-SP');
    setFormDosage(scanResult?.strength ? `1 Tablet (${scanResult.strength})` : '1 Tablet');
    setFormTimings({ morning: true, afternoon: false, night: true });
    setFormFoodTiming('Take After Food • Within 15–20 mins');
    setFormStatus('Scheduled');
    setIsEditorOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (med) => {
    setEditingMed(med);
    setFormName(med.name || '');
    setFormDosage(med.dosage || '1 Tablet');
    setFormTimings(med.timings || { morning: true, afternoon: false, night: true });
    setFormFoodTiming(med.foodTiming || 'Take After Food • Within 15–20 mins');
    setFormStatus(med.status || 'Scheduled');
    setIsEditorOpen(true);
  };

  // Save Modal
  const handleSaveMed = (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const medData = {
      id: editingMed ? editingMed.id : `med-${Date.now()}`,
      name: formName.trim(),
      dosage: formDosage.trim(),
      timings: formTimings,
      foodTiming: formFoodTiming,
      status: formStatus,
      doseStatus: editingMed?.doseStatus || {
        morning: formStatus === 'Taken' ? 'taken' : 'scheduled',
        afternoon: formStatus === 'Taken' ? 'taken' : 'scheduled',
        night: formStatus === 'Taken' ? 'taken' : 'scheduled',
      },
    };

    if (editingMed) {
      onUpdateEvent(selectedDate, medData);
    } else {
      onAddEvent(selectedDate, medData);
    }
    setIsEditorOpen(false);
  };

  // Quick Preset Presets for Frequency
  const applyPresetFrequency = (preset) => {
    if (preset === '1x') setFormTimings({ morning: true, afternoon: false, night: false });
    if (preset === '2x') setFormTimings({ morning: true, afternoon: false, night: true });
    if (preset === '3x') setFormTimings({ morning: true, afternoon: true, night: true });
  };

  // Build Voice readout for Selected Day
  const getSelectedDayVoiceText = () => {
    const formatted = formatDisplayDate(selectedDate);
    if (currentDayMeds.length === 0) {
      if (lang === 'en') return `Dosage schedule for ${formatted}: No medicines are scheduled for this date.`;
      if (lang === 'hi') return `${formatted} के लिए कोई दवा निर्धारित नहीं है।`;
      return `${formatted} ਲਈ ਕੋਈ ਦਵਾਈ ਤਹਿ ਨਹੀਂ ਕੀਤੀ ਗਈ ਹੈ।`;
    }

    const medDescriptions = currentDayMeds.map((m) => {
      const times = [];
      if (m.timings?.morning) times.push(lang === 'en' ? 'morning' : lang === 'hi' ? 'सुबह' : 'ਸਵੇਰੇ');
      if (m.timings?.afternoon) times.push(lang === 'en' ? 'afternoon' : lang === 'hi' ? 'दोपहर' : 'ਦੁਪਹਿਰ');
      if (m.timings?.night) times.push(lang === 'en' ? 'night' : lang === 'hi' ? 'रात' : 'ਰਾਤ');
      const timeStr = times.join(lang === 'en' ? ' and ' : ' और ');

      if (lang === 'en') {
        return `${m.name}, ${m.dosage}, take in the ${timeStr || 'morning'}, ${m.foodTiming || 'after food'}.`;
      } else if (lang === 'hi') {
        return `${m.name}, ${m.dosage}, ${timeStr || 'सुबह'} को, ${m.foodTiming || 'खाना खाने के बाद'} लें।`;
      } else {
        return `${m.name}, ${m.dosage}, ${timeStr || 'ਸਵੇਰੇ'} ਨੂੰ, ${m.foodTiming || 'ਰੋਟੀ ਖਾਣ ਤੋਂ ਬਾਅਦ'} ਲਵੋ।`;
      }
    }).join(' ');

    if (lang === 'en') {
      return `MedStrip schedule for ${formatted}: You have ${currentDayMeds.length} medicine scheduled. ${medDescriptions}`;
    } else if (lang === 'hi') {
      return `मेडस्ट्रिप कार्यक्रम ${formatted}: आपकी निर्धारित दवाएं: ${medDescriptions}`;
    } else {
      return `ਮੈਡਸਟ੍ਰਿਪ ਪ੍ਰੋਗਰਾਮ ${formatted}: ਤੁਹਾਡੀਆਂ ਦਵਾਈਆਂ: ${medDescriptions}`;
    }
  };

  // Play audio for selected day's schedule
  const handleToggleDayVoice = () => {
    if (isPlayingDayVoice) {
      stopBrowserTTS();
      setIsPlayingDayVoice(false);
      return;
    }

    const textToSpeak = getSelectedDayVoiceText();
    speakWithBrowserTTS(
      textToSpeak,
      lang,
      () => setIsPlayingDayVoice(true),
      () => setIsPlayingDayVoice(false),
      () => setIsPlayingDayVoice(false)
    );
  };

  // Play a soft medical chime followed by the spoken voice reminder
  const triggerAlarmSoundAndVoice = () => {
    setIsAlarmPlaying(true);

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        osc1.frequency.setValueAtTime(830.61, now + 0.25); // G#5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(329.63, now); // E4
        osc2.frequency.setValueAtTime(415.30, now + 0.25); // G#4

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.85);
        osc2.stop(now + 0.85);
      }
    } catch (e) {
      console.warn('Web Audio alarm chime error:', e);
    }

    // Trigger spoken reminder after chime
    setTimeout(() => {
      const activeMed = currentDayMeds[0] || { name: scanResult?.brand_name || 'Zerodol-SP', dosage: '1 Tablet' };
      let reminderText = '';
      if (lang === 'en') {
        reminderText = `MedStrip Reminder for ${formatDisplayDate(selectedDate)}. It is time to take your medicine: ${activeMed.name}, ${activeMed.dosage}. Please take after food within 15 to 20 minutes.`;
      } else if (lang === 'hi') {
        reminderText = `${formatDisplayDate(selectedDate)} के लिए दवा का समय हो गया है। कृपया ${activeMed.name} की ${activeMed.dosage} खाना खाने के बाद लें।`;
      } else {
        reminderText = `${formatDisplayDate(selectedDate)} ਲਈ ਦਵਾਈ ਦਾ ਸਮਾਂ ਹੋ ਗਿਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ${activeMed.name} ਦੀ ${activeMed.dosage} ਰੋਟੀ ਖਾਣ ਤੋਂ ਬਾਅਦ ਲਵੋ।`;
      }

      speakWithBrowserTTS(
        reminderText,
        lang,
        () => setIsAlarmPlaying(true),
        () => {
          setIsAlarmPlaying(false);
          setAlarmCountdown(null);
        },
        () => {
          setIsAlarmPlaying(false);
          setAlarmCountdown(null);
        }
      );
    }, 700);
  };

  const handleTestAlarm = () => {
    if (alarmCountdown !== null || isAlarmPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      stopBrowserTTS();
      setAlarmCountdown(null);
      setIsAlarmPlaying(false);
      return;
    }

    let count = 5;
    setAlarmCountdown(count);

    timerRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(timerRef.current);
        setAlarmCountdown(0);
        triggerAlarmSoundAndVoice();
      } else {
        setAlarmCountdown(count);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopBrowserTTS();
    };
  }, []);

  return (
    <section id="calendar" className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 scroll-mt-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* ================= LEFT COLUMN: Interactive Dosage Calendar Card (7 cols) ================= */}
        <RevealOnScroll delay={0} className="lg:col-span-7">
          <div className="bg-[#E7EFEA] rounded-3xl md:rounded-4xl p-6 sm:p-8 lg:p-10 border border-[#D5E3DA] shadow-soft">
          {/* Calendar Header with Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1C2321] tracking-tight">
                Dosage Calendar — {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <p className="text-xs text-stone-600 font-medium mt-0.5">
                Click any date to view, add, or edit scheduled medicines
              </p>
            </div>

            {/* Previous / Next Month Arrows */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-stone-700 flex items-center justify-center border border-stone-200/80 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-stone-700 flex items-center justify-center border border-stone-200/80 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center mb-3">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span
                key={d}
                className="text-xs sm:text-sm font-bold text-stone-600 tracking-tight py-1"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Dates Grid */}
          <div className="space-y-3">
            {calendarRows.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-7 text-center items-center gap-1 sm:gap-2">
                {row.map((cell, cIdx) => {
                  if (!cell.day) {
                    return <div key={cIdx} className="h-14 sm:h-16" />;
                  }

                  const isSelected = cell.isSelected;
                  const isToday = cell.isToday;

                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => setSelectedDate(cell.dateKey)}
                      className={`h-14 sm:h-16 flex flex-col items-center justify-center relative rounded-2xl transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-[#26433A]/10 ring-2 ring-[#26433A]'
                          : 'hover:bg-white/50'
                      }`}
                    >
                      {isSelected ? (
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#26433A] text-white font-extrabold text-sm sm:text-base flex items-center justify-center shadow-xs">
                          {cell.day}
                        </div>
                      ) : (
                        <div
                          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold ${
                            isToday
                              ? 'border-2 border-[#26433A] text-[#26433A] font-bold'
                              : 'text-stone-800'
                          }`}
                        >
                          {cell.day}
                        </div>
                      )}

                      {/* Status dot indicator underneath cell */}
                      <div className="h-2 flex items-center justify-center gap-0.5 mt-0.5">
                        {cell.status === 'taken' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B]" title="All doses taken" />
                        )}
                        {cell.status === 'scheduled' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D97742]" title="Doses scheduled" />
                        )}
                        {cell.count > 1 && (
                          <span className="w-1 h-1 rounded-full bg-stone-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Interactive Legend & Today Shortcut */}
          <div className="mt-8 pt-5 border-t border-[#D0DFD6] flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm font-semibold text-stone-700">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D5B]" />
                <span>Taken</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97742]" />
                <span>Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-stone-400 bg-transparent" />
                <span>Missed</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCurrentYear(2026);
                setCurrentMonth(10);
                setSelectedDate('2026-11-21');
              }}
              className="text-xs font-bold text-[#26433A] hover:underline cursor-pointer"
            >
              Jump to Nov 21 (Today)
            </button>
          </div>
        </div>
      </RevealOnScroll>

      {/* ================= RIGHT COLUMN: Day Schedule + Voice Alarms (5 cols) ================= */}
      <div className="lg:col-span-5 space-y-6">
        {/* Card 1: Selected Day's Schedule Panel */}
        <RevealOnScroll delay={80}>
          <div className="bg-[#E7EFEA] rounded-3xl md:rounded-4xl p-6 sm:p-8 lg:p-9 border border-[#D5E3DA] shadow-soft">
            {/* Header: Date + Audio Guide + "+ Add Medicine" */}
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-[#D0DFD6]">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-stone-500 block">
                  Selected Date Schedule
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#1C2321] tracking-tight">
                  {formatDisplayDate(selectedDate)}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Voice Readout of Day's Schedule */}
                <button
                  type="button"
                  onClick={handleToggleDayVoice}
                  title="Listen to Schedule Audio Guide"
                  className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-xs transition-all cursor-pointer ${
                    isPlayingDayVoice
                      ? 'bg-[#D97742] text-white border-[#D97742] animate-pulse'
                      : 'bg-white/80 hover:bg-white text-[#26433A] border-stone-200'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                {/* + Add Medicine Button */}
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#26433A] hover:bg-[#1C2321] text-white text-xs font-bold shadow-xs transition-all hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* List of Medicines on Selected Date */}
            {currentDayMeds.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-white/40 rounded-2xl border border-dashed border-stone-300 p-4">
                <div className="w-10 h-10 mx-auto rounded-full bg-white flex items-center justify-center text-stone-400 shadow-2xs">
                  <CalendarIcon className="w-5 h-5 text-stone-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-800">
                    No medicines scheduled for this date
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Plan medication intake, frequency, and voice alarms for {formatDisplayDate(selectedDate)}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-[#D97742] hover:bg-[#c66835] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Medicine for this Date</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentDayMeds.map((med, idx) => {
                  const morningStatus = med.doseStatus?.morning || (med.status === 'Taken' ? 'taken' : 'scheduled');
                  const afternoonStatus = med.doseStatus?.afternoon || (med.status === 'Taken' ? 'taken' : 'scheduled');
                  const nightStatus = med.doseStatus?.night || (med.status === 'Taken' ? 'taken' : 'scheduled');

                  return (
                    <RevealOnScroll key={med.id} delay={idx * 70}>
                      <div
                        className="bg-white/80 rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-3"
                      >
                      {/* Medicine Header: Name + Dosage + Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-base text-[#1C2321]">
                            {med.name}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#E7EFEA] text-[#26433A] text-xs font-bold border border-[#D5E3DA]">
                            {med.dosage}
                          </span>
                        </div>

                        {/* Edit & Delete Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(med)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Edit Medicine"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEvent(selectedDate, med.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Medicine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Dose Slots */}
                      <div className="space-y-2 pt-1">
                        {/* Morning Slot */}
                        {med.timings?.morning && (
                          <div
                            onClick={() => onToggleDoseStatus(selectedDate, med.id, 'morning')}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs cursor-pointer hover:border-[#26433A]/40 transition-all select-none"
                            title="Click to toggle Taken / Scheduled"
                          >
                            {morningStatus === 'taken' ? (
                              <div className="w-6 h-6 rounded-full bg-[#2E7D5B] text-white flex items-center justify-center flex-shrink-0">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#D97742] flex items-center justify-center flex-shrink-0">
                                <span className="w-2 h-2 rounded-full bg-white" />
                              </div>
                            )}
                            <div className="text-xs sm:text-sm font-semibold text-stone-800 flex-1">
                              <span className="font-bold">Morning</span> • 08:00 AM — {med.name} ({med.dosage})
                            </div>
                            <span className="text-[10px] font-bold uppercase text-stone-400">
                              {morningStatus === 'taken' ? 'Taken' : 'Scheduled'}
                            </span>
                          </div>
                        )}

                        {/* Afternoon Slot */}
                        {med.timings?.afternoon ? (
                          <div
                            onClick={() => onToggleDoseStatus(selectedDate, med.id, 'afternoon')}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs cursor-pointer hover:border-[#26433A]/40 transition-all select-none"
                            title="Click to toggle Taken / Scheduled"
                          >
                            {afternoonStatus === 'taken' ? (
                              <div className="w-6 h-6 rounded-full bg-[#2E7D5B] text-white flex items-center justify-center flex-shrink-0">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#D97742] flex items-center justify-center flex-shrink-0">
                                <span className="w-2 h-2 rounded-full bg-white" />
                              </div>
                            )}
                            <div className="text-xs sm:text-sm font-semibold text-stone-800 flex-1">
                              <span className="font-bold">Afternoon</span> • 02:00 PM — {med.name} ({med.dosage})
                            </div>
                            <span className="text-[10px] font-bold uppercase text-stone-400">
                              {afternoonStatus === 'taken' ? 'Taken' : 'Scheduled'}
                            </span>
                          </div>
                        ) : (
                          med.timings?.morning && med.timings?.night && (
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-100/50 border border-stone-200/50 opacity-60">
                              <div className="w-6 h-6 rounded-full bg-stone-300 flex items-center justify-center flex-shrink-0" />
                              <div className="text-xs sm:text-sm font-medium text-stone-500">
                                <span>Afternoon</span> • 02:00 PM — No Dose
                              </div>
                            </div>
                          )
                        )}

                        {/* Night Slot */}
                        {med.timings?.night && (
                          <div
                            onClick={() => onToggleDoseStatus(selectedDate, med.id, 'night')}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs cursor-pointer hover:border-[#26433A]/40 transition-all select-none"
                            title="Click to toggle Taken / Scheduled"
                          >
                            {nightStatus === 'taken' ? (
                              <div className="w-6 h-6 rounded-full bg-[#2E7D5B] text-white flex items-center justify-center flex-shrink-0">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#D97742] flex items-center justify-center flex-shrink-0">
                                <span className="w-2 h-2 rounded-full bg-white" />
                              </div>
                            )}
                            <div className="text-xs sm:text-sm font-semibold text-stone-800 flex-1">
                              <span className="font-bold">Night</span> • 08:00 PM — {med.name} ({med.dosage})
                            </div>
                            <span className="text-[10px] font-bold uppercase text-stone-400">
                              {nightStatus === 'taken' ? 'Taken' : 'Scheduled'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Food Banner: Soft Mint/Sage */}
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#D6E8DE] border border-[#BFE0CD] text-[#26433A] font-bold text-xs">
                        <Utensils className="w-3.5 h-3.5 text-[#26433A] flex-shrink-0" />
                        <span>{med.foodTiming || 'Take After Food • Within 15–20 mins'}</span>
                      </div>
                    </div>
                  </RevealOnScroll>
                  );
                })}
              </div>
            )}
          </div>
        </RevealOnScroll>

        {/* Card 2: Voice Reminder Alarms */}
        <RevealOnScroll delay={160}>
          <div className="relative bg-[#E7EFEA] rounded-3xl md:rounded-4xl p-6 sm:p-8 lg:p-9 border border-[#D5E3DA] shadow-soft overflow-hidden">
            {/* Sparkle decorative element at bottom-right */}
            <Sparkles className="absolute -bottom-2 -right-2 w-16 h-16 text-[#D5E3DA] pointer-events-none opacity-50" />

            <div className="relative z-10 flex items-center justify-between mb-5">
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#1C2321] tracking-tight">
                Voice Reminder Alarms
              </h3>
            </div>

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Toggles list (8 cols) */}
              <div className="sm:col-span-8 space-y-4">
                {/* Toggle 1: Language Voice Alarm */}
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-stone-800">
                    {lang === 'en'
                      ? 'English Voice Alarm'
                      : lang === 'hi'
                      ? 'Hindi Voice Alarm'
                      : 'Punjabi Voice Alarm'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVoiceAlarmEnabled(!voiceAlarmEnabled)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      voiceAlarmEnabled ? 'bg-[#26433A]' : 'bg-stone-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        voiceAlarmEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 2: Morning 08:00 AM */}
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-stone-800">
                    Morning 08:00 AM
                  </span>
                  <button
                    type="button"
                    onClick={() => setMorningAlarm(!morningAlarm)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      morningAlarm ? 'bg-[#26433A]' : 'bg-stone-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        morningAlarm ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 3: Night 08:00 PM */}
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-stone-800">
                    Night 08:00 PM
                  </span>
                  <button
                    type="button"
                    onClick={() => setNightAlarm(!nightAlarm)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      nightAlarm ? 'bg-[#26433A]' : 'bg-stone-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        nightAlarm ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Action Button: Test 5s Alarm (4 cols) */}
              <div className="sm:col-span-4 flex sm:justify-end pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={handleTestAlarm}
                  className={`w-full sm:w-auto px-5 py-3 rounded-full text-xs sm:text-sm font-bold shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                    alarmCountdown !== null || isAlarmPlaying
                      ? 'bg-[#D97742] text-white animate-pulse'
                      : 'bg-[#1C2321] hover:bg-[#26433A] text-white hover:scale-[1.03] active:scale-[0.98]'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>
                    {alarmCountdown !== null && alarmCountdown > 0
                      ? `Alarm in ${alarmCountdown}s...`
                      : isAlarmPlaying
                      ? 'Playing Voice...'
                      : 'Test 5s Alarm'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>

      {/* ================= EDIT / ADD MEDICINE MODAL ================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#FAF7F2] rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-lifted space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#26433A] text-white flex items-center justify-center">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#1C2321]">
                    {editingMed ? 'Edit Medication' : 'Add Medication'}
                  </h3>
                  <span className="text-xs font-semibold text-stone-500">
                    For {formatDisplayDate(selectedDate)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 flex items-center justify-center text-stone-600 border border-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMed} className="space-y-4 text-xs sm:text-sm">
              {/* Medicine Name */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-800 block">
                  Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Zerodol-SP, Pentab 40, Dolo 650"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-stone-300 focus:border-[#26433A] focus:ring-2 focus:ring-[#26433A]/20 outline-hidden font-medium text-stone-900"
                />
                {/* Quick-Pick Suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-stone-500 font-semibold">Quick pick:</span>
                  {['Zerodol-SP', 'Pentab 40', 'Augmentin 625 Duo', 'Dolo 650'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setFormName(chip)}
                      className="px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-[#26433A] text-[11px] font-semibold text-stone-700 cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dosage / Amount */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-800 block">
                  Dosage / Strength
                </label>
                <input
                  type="text"
                  value={formDosage}
                  onChange={(e) => setFormDosage(e.target.value)}
                  placeholder="e.g. 1 Tablet, 1 Capsule, 5 ml, 40mg"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-stone-300 focus:border-[#26433A] focus:ring-2 focus:ring-[#26433A]/20 outline-hidden font-medium text-stone-900"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {['1 Tablet', '2 Tablets', '1 Capsule', '5 ml', '10 ml'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormDosage(d)}
                      className="px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-[#26433A] text-[11px] font-semibold text-stone-700 cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Times Per Day (Frequency) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-800">
                    Times Per Day (Frequency)
                  </label>
                  {/* Preset Pills */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyPresetFrequency('1x')}
                      className="px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-[#26433A] text-[11px] font-bold text-stone-600 cursor-pointer"
                    >
                      1x Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetFrequency('2x')}
                      className="px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-[#26433A] text-[11px] font-bold text-stone-600 cursor-pointer"
                    >
                      2x Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetFrequency('3x')}
                      className="px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-[#26433A] text-[11px] font-bold text-stone-600 cursor-pointer"
                    >
                      3x Daily
                    </button>
                  </div>
                </div>

                {/* Timing Checkbox Cards */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTimings((t) => ({ ...t, morning: !t.morning }))}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                      formTimings.morning
                        ? 'bg-[#26433A] text-white border-[#26433A]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Morning</div>
                    <div className="text-[10px] opacity-80">08:00 AM</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTimings((t) => ({ ...t, afternoon: !t.afternoon }))}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                      formTimings.afternoon
                        ? 'bg-[#26433A] text-white border-[#26433A]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Afternoon</div>
                    <div className="text-[10px] opacity-80">02:00 PM</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTimings((t) => ({ ...t, night: !t.night }))}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                      formTimings.night
                        ? 'bg-[#26433A] text-white border-[#26433A]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Night</div>
                    <div className="text-[10px] opacity-80">08:00 PM</div>
                  </button>
                </div>
              </div>

              {/* Food Timing */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-800 block">
                  Food Timing
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    'Take After Food • Within 15–20 mins',
                    'Take Before Food • 30 mins before',
                    'Take Anytime With Water',
                  ].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFormFoodTiming(option)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        formFoodTiming === option
                          ? 'bg-[#D6E8DE] border-[#BFE0CD] text-[#26433A]'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {option.split('•')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-stone-800">
                  Initial Status
                </span>
                <div className="flex items-center bg-white p-1 rounded-xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => setFormStatus('Scheduled')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formStatus === 'Scheduled'
                        ? 'bg-[#D97742] text-white shadow-xs'
                        : 'text-stone-500'
                    }`}
                  >
                    Scheduled
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('Taken')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formStatus === 'Taken'
                        ? 'bg-[#2E7D5B] text-white shadow-xs'
                        : 'text-stone-500'
                    }`}
                  >
                    Taken
                  </button>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-5 py-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-700 font-bold border border-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#D97742] hover:bg-[#c66835] text-white font-bold shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
                >
                  {editingMed ? 'Update Medicine' : 'Save to Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
