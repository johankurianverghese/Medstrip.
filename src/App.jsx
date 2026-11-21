import React, { useState, useEffect } from 'react';
import UtilityBar from './components/UtilityBar';
import Navbar from './components/Navbar';
import HomeScreen from './components/HomeScreen';
import ScannerScreen, { optimizeImageFile } from './components/ScannerScreen';
import CalendarScreen from './components/CalendarScreen';
import HistoryScreen from './components/HistoryScreen';
import LoginModal from './components/LoginModal';
import { ArrowUp, ShieldCheck } from 'lucide-react';

const DEFAULT_CALENDAR_EVENTS = {
  '2026-11-01': [
    {
      id: 'd-1',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Taken',
      doseStatus: { morning: 'taken', night: 'taken' },
    },
  ],
  '2026-11-04': [
    {
      id: 'd-4',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Taken',
      doseStatus: { morning: 'taken', night: 'taken' },
    },
  ],
  '2026-11-05': [
    {
      id: 'd-5',
      name: 'Augmentin 625 Duo',
      dosage: '1 Tablet (500mg+125mg)',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Taken',
      doseStatus: { morning: 'taken', night: 'taken' },
    },
  ],
  '2026-11-06': [
    {
      id: 'd-6',
      name: 'Augmentin 625 Duo',
      dosage: '1 Tablet (500mg+125mg)',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Taken',
      doseStatus: { morning: 'taken', night: 'taken' },
    },
  ],
  '2026-11-07': [
    {
      id: 'd-7',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Taken',
      doseStatus: { morning: 'taken', night: 'taken' },
    },
  ],
  '2026-11-09': [
    {
      id: 'd-9',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-10': [
    {
      id: 'd-10',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-11': [
    {
      id: 'd-11',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-13': [
    {
      id: 'd-13',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Taken',
      doseStatus: { morning: 'taken', night: 'taken' },
    },
  ],
  '2026-11-15': [
    {
      id: 'd-15',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-17': [
    {
      id: 'd-17',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-21': [
    {
      id: 'd-21-1',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: {
        morning: 'taken',
        night: 'scheduled',
      },
    },
  ],
  '2026-11-23': [
    {
      id: 'd-23',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-26': [
    {
      id: 'd-26',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-27': [
    {
      id: 'd-27',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
  '2026-11-28': [
    {
      id: 'd-28',
      name: 'Zerodol-SP',
      dosage: '1 Tablet',
      timings: { morning: true, afternoon: false, night: true },
      foodTiming: 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    },
  ],
};

export default function App() {
  // Active Section for Sticky Navbar Dot Indicator
  const [activeSection, setActiveSection] = useState('home');

  // Voice Language: 'en' | 'hi' | 'pa' (persisted in localStorage)
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('med_strip_voice_lang');
      if (saved && ['en', 'hi', 'pa'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.warn('localStorage read error:', e);
    }
    return 'en';
  });

  const handleSetLang = (newLang) => {
    setLang(newLang);
    try {
      localStorage.setItem('med_strip_voice_lang', newLang);
    } catch (e) {
      console.warn('localStorage write error:', e);
    }
  };

  const [dbReady, setDbReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // User Profile Authentication State (Persisted in localStorage)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('med_strip_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('localStorage read user error:', e);
    }
    return null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    try {
      localStorage.setItem('med_strip_user', JSON.stringify(userData));
    } catch (e) {
      console.warn('localStorage write user error:', e);
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('med_strip_user');
    } catch (e) {
      console.warn('localStorage remove user error:', e);
    }
  };

  // Active Scanned Result (defaults to Zerodol-SP demo state for instant inspection)
  const [scanResult, setScanResult] = useState({
    status: 'VERIFIED',
    brand_name: 'Zerodol-SP',
    generic_name: 'Aceclofenac + Paracetamol',
    strength: '100mg + 325mg',
    manufacturer: 'Ipca Laboratories Ltd',
    confidence: 100,
    ocr_engine: 'Gemini Flash Vision',
    speech_text: 'This medicine is Zerodol-SP. It contains Aceclofenac 100mg and Paracetamol 325mg. Take morning and night, after food within 15 to 20 minutes.',
    voice: {
      en: {
        text: 'This medicine is Zerodol-SP. It contains Aceclofenac 100mg and Paracetamol 325mg. Take morning and night, after food within 15 to 20 minutes.',
      },
      hi: {
        text: 'यह दवा ज़ेरोडोल-एसपी है। इसमें एसीक्लोफेनाक और पैरासिटामोल शामिल हैं। सुबह और रात को खाना खाने के बाद लें।',
      },
      pa: {
        text: 'ਇਹ ਦਵਾਈ ਜ਼ੀਰੋਡੋਲ-ਐਸਪੀ ਹੈ। ਇਸ ਵਿੱਚ ਐਸੀਕਲੋਫੇਨੈਕ ਅਤੇ ਪੈਰਾਸੀਟਾਮੋਲ ਸ਼ਾਮਲ ਹਨ। ਸਵੇਰੇ ਅਤੇ ਰਾਤ ਨੂੰ ਰੋਟੀ ਖਾਣ ਤੋਂ ਬਾਅਦ ਲਵੋ।',
      },
    },
  });

  // Dose Schedule (Morning, Afternoon, Night, After Food)
  const [schedule, setSchedule] = useState({
    morning: true,
    afternoon: false,
    night: true,
    after_food: true,
  });

  // Interactive Calendar Events state (Persisted in localStorage)
  const [calendarEvents, setCalendarEvents] = useState(() => {
    try {
      const saved = localStorage.getItem('med_strip_calendar_events');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('localStorage read calendar error:', e);
    }
    return DEFAULT_CALENDAR_EVENTS;
  });

  const saveCalendarEvents = (updated) => {
    setCalendarEvents(updated);
    try {
      localStorage.setItem('med_strip_calendar_events', JSON.stringify(updated));
    } catch (e) {
      console.warn('localStorage write calendar error:', e);
    }
  };

  const handleAddCalendarEvent = (dateStr, medData) => {
    const list = calendarEvents[dateStr] || [];
    const updated = {
      ...calendarEvents,
      [dateStr]: [...list, medData],
    };
    saveCalendarEvents(updated);
  };

  const handleUpdateCalendarEvent = (dateStr, updatedMed) => {
    const list = calendarEvents[dateStr] || [];
    const updated = {
      ...calendarEvents,
      [dateStr]: list.map((m) => (m.id === updatedMed.id ? updatedMed : m)),
    };
    saveCalendarEvents(updated);
  };

  const handleDeleteCalendarEvent = (dateStr, medId) => {
    const list = calendarEvents[dateStr] || [];
    const updated = {
      ...calendarEvents,
      [dateStr]: list.filter((m) => m.id !== medId),
    };
    saveCalendarEvents(updated);
  };

  const handleToggleDoseStatus = (dateStr, medId, doseKey) => {
    const list = calendarEvents[dateStr] || [];
    const updated = {
      ...calendarEvents,
      [dateStr]: list.map((m) => {
        if (m.id !== medId) return m;
        const currentDoseStatus = m.doseStatus?.[doseKey] || 'scheduled';
        const newDoseStatus = currentDoseStatus === 'taken' ? 'scheduled' : 'taken';
        const nextDoseStatusObj = {
          ...(m.doseStatus || {}),
          [doseKey]: newDoseStatus,
        };

        const activeSlots = Object.entries(m.timings || {}).filter(([_, active]) => active);
        const allSlotsTaken = activeSlots.every(([slot]) => nextDoseStatusObj[slot] === 'taken');

        return {
          ...m,
          doseStatus: nextDoseStatusObj,
          status: allSlotsTaken ? 'Taken' : 'Scheduled',
        };
      }),
    };
    saveCalendarEvents(updated);
  };

  // 1-Click Add Newly Scanned Medicine to Dosage Calendar
  const handleAddScanToCalendar = (medData) => {
    const targetDate = '2026-11-21';
    handleAddCalendarEvent(targetDate, {
      id: `scan-${Date.now()}`,
      name: medData.name || scanResult?.brand_name || 'Zerodol-SP',
      dosage: medData.dosage || scanResult?.strength || '1 Tablet',
      timings: medData.timings || { morning: true, afternoon: false, night: true },
      foodTiming: medData.foodTiming || 'Take After Food • Within 15–20 mins',
      status: 'Scheduled',
      doseStatus: { morning: 'scheduled', night: 'scheduled' },
    });
    scrollToSection('calendar');
  };

  // Scan History
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('med_strip_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('localStorage read history error:', e);
    }
    return [
      {
        id: 1,
        brand_name: 'Zerodol-SP',
        generic_name: 'Aceclofenac + Paracetamol',
        strength: '100mg + 325mg',
        manufacturer: 'Ipca Laboratories Ltd',
        status: 'VERIFIED',
        confidence: 100,
        timestamp: 'Today, 11:30 AM',
        speech_text: 'This medicine is Zerodol-SP. Take morning and night after food.',
      },
      {
        id: 2,
        brand_name: 'Augmentin 625 Duo',
        generic_name: 'Amoxycillin + Potassium Clavulanate',
        strength: '500mg + 125mg',
        manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
        status: 'VERIFIED',
        confidence: 100,
        timestamp: 'Yesterday, 08:15 PM',
        speech_text: 'This medicine is Augmentin 625 Duo. Take twice daily with food.',
      },
    ];
  });

  // Save history to localStorage
  const addHistoryItem = (item) => {
    setHistory((prev) => {
      const updated = [item, ...prev.filter((h) => h.brand_name !== item.brand_name)].slice(0, 20);
      try {
        localStorage.setItem('med_strip_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('localStorage write history error:', e);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('med_strip_history');
    } catch (e) {
      console.warn(e);
    }
  };

  // Smooth Scroll to Section Helper
  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scrollspy: dynamically update activeSection dot indicator as user scrolls
  useEffect(() => {
    const sectionIds = ['home', 'scanner', 'calendar', 'history'];
    const handleScroll = () => {
      if (window.scrollY < 80) {
        setActiveSection('home');
        return;
      }
      const scrollPos = window.scrollY + 120;
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(sectionIds[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check backend health
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') setDbReady(data.database_ready);
      })
      .catch((err) => console.log('Backend healthcheck error:', err));
  }, []);

  // Update speech text if language changes and we have a scan result
  useEffect(() => {
    if (scanResult && scanResult.brand_name && !scanResult.voice) {
      fetch('/api/match-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scanResult.ocr_text || scanResult.brand_name,
          lang: lang,
          ...schedule,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setScanResult((prev) => ({
            ...prev,
            speech_text: data.speech_text,
            audio_base64: data.audio_base64,
            voice: data.voice || prev.voice,
          }));
        })
        .catch(console.error);
    }
  }, [lang]);

  // Handle Image Upload / 4-Frame Tilt Burst Capture
  const handleCaptureBurst = async (capturedFiles) => {
    setIsLoading(true);

    const rawList = Array.isArray(capturedFiles) ? capturedFiles : [capturedFiles];
    if (rawList.length === 0) {
      setIsLoading(false);
      return;
    }

    // Ensure all uploaded/captured frames are downscaled (max 1280px) & compressed to JPEG 0.82
    const files = await Promise.all(
      rawList.map((f) => (f instanceof File || f instanceof Blob ? optimizeImageFile(f, 1280, 0.82) : f))
    );

    // Display primary frame preview
    const primaryFile = files[0];
    const objectUrl = URL.createObjectURL(primaryFile);
    setPreviewUrl(objectUrl);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('file', primaryFile);
    formData.append('lang', lang);
    formData.append('morning', schedule.morning);
    formData.append('afternoon', schedule.afternoon);
    formData.append('night', schedule.night);
    formData.append('after_food', schedule.after_food);

    try {
      const res = await fetch('/api/scan-burst', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setScanResult(data);

      if (data.status === 'VERIFIED') {
        addHistoryItem({
          id: Date.now(),
          brand_name: data.brand_name,
          generic_name: data.generic_name,
          strength: data.strength,
          manufacturer: data.manufacturer || 'Verified Indian Manufacturer',
          status: data.status,
          confidence: data.confidence || 100,
          timestamp: 'Just now',
          speech_text: data.speech_text,
          voice: data.voice,
        });
      }
    } catch (err) {
      console.error('Scan error:', err);
      setScanResult({
        status: 'NOT_SURE',
        reason: 'Unable to connect to server. Please ensure backend is running.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle 1-Click Desktop Sample Testing
  const handleSelectSample = async (ocrText, sampleName) => {
    setIsLoading(true);
    setPreviewUrl(null);

    try {
      const res = await fetch('/api/match-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ocrText,
          lang: lang,
          ...schedule,
        }),
      });
      const data = await res.json();
      setScanResult(data);

      if (data.status === 'VERIFIED') {
        addHistoryItem({
          id: Date.now(),
          brand_name: data.brand_name,
          generic_name: data.generic_name,
          strength: data.strength,
          manufacturer: data.manufacturer || 'Verified Indian Manufacturer',
          status: data.status,
          confidence: data.confidence || 100,
          timestamp: 'Just now',
          speech_text: data.speech_text,
          voice: data.voice,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A2B3C] text-slate-100 flex flex-col font-sans selection:bg-[#26433A] selection:text-white antialiased">
      {/* ================= NATURAL SCROLLING HEADER (Utility Bar + Navbar) ================= */}
      <header className="relative w-full bg-[#F7F5F0] border-b border-stone-200/50 shadow-xs">
        {/* Top Slim Trust Badges */}
        <UtilityBar />

        {/* Main Navbar with Smooth Section Links, Language Pills & Login Trigger */}
        <Navbar
          activeSection={activeSection}
          onNavigate={scrollToSection}
          lang={lang}
          setLang={handleSetLang}
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onSignOut={handleSignOut}
          onSwitchProfile={() => setIsLoginModalOpen(true)}
        />
      </header>

      {/* ================= CONTINUOUS VERTICAL SCROLLING FLOW ================= */}
      <main className="w-full flex-1 space-y-12 sm:space-y-16 py-6 sm:py-8">
        {/* Section 1: Hero Landing Banner (#home) */}
        <HomeScreen
          onStartScanning={() => scrollToSection('scanner')}
        />

        {/* Section 2: Scanner & Verification Card (#scanner) */}
        <ScannerScreen
          scanResult={scanResult}
          onCaptureBurst={handleCaptureBurst}
          onUploadFile={(file) => handleCaptureBurst([file])}
          isLoading={isLoading}
          previewUrl={previewUrl}
          lang={lang}
          setLang={handleSetLang}
          onSelectSample={handleSelectSample}
          onAddToCalendar={handleAddScanToCalendar}
        />

        {/* Section 3: Dosage Calendar & Voice Reminders (#calendar) */}
        <CalendarScreen
          calendarEvents={calendarEvents}
          onAddEvent={handleAddCalendarEvent}
          onUpdateEvent={handleUpdateCalendarEvent}
          onDeleteEvent={handleDeleteCalendarEvent}
          onToggleDoseStatus={handleToggleDoseStatus}
          lang={lang}
          onNavigateToScanner={() => scrollToSection('scanner')}
          scanResult={scanResult}
        />

        {/* Section 4: Scan History & Verified Medicine Logs (#history) */}
        <HistoryScreen
          history={history}
          onClearHistory={handleClearHistory}
          onSelectHistoryItem={(item) => {
            setScanResult(item);
            scrollToSection('scanner');
          }}
          onNavigateToScanner={() => scrollToSection('scanner')}
          lang={lang}
        />
      </main>

      {/* ================= EDITORIAL FOOTER ================= */}
      <footer className="w-full bg-[#E7EFEA] border-t border-[#D5E3DA] py-8 mt-12">
        <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-stone-600">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-stone-900 tracking-tight text-base">MedStrip</span>
            <span className="text-stone-400">•</span>
            <span>Medicine Strip Reader with 3 Hard Safety Gates</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-stone-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#2E7D5B]" />
              <span>Zero-Guessing Telehealth Protocol</span>
            </div>

            <button
              type="button"
              onClick={() => scrollToSection('home')}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-stone-800 font-bold border border-stone-200/80 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <span>Back to Top</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* ================= TELEHEALTH LOGIN & PROFILE MODAL ================= */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
        currentUser={currentUser}
      />
    </div>
  );
}
