import React from 'react';
import { ChevronRight, User, Users, LogOut, ChevronDown } from 'lucide-react';

export default function Navbar({
  activeSection,
  onNavigate,
  lang,
  setLang,
  currentUser,
  onOpenLogin,
  onSignOut,
  onSwitchProfile,
}) {
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'scanner', label: 'Scanner' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'history', label: 'History' },
  ];

  return (
    <nav className="w-full bg-[#F7F5F0] py-3.5">
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 flex items-center justify-between">
        {/* Left: Pill Logo "MedStrip" */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-white border border-stone-200/80 shadow-xs hover:border-stone-300 transition-all cursor-pointer group"
        >
          <span className="font-extrabold text-lg tracking-tight text-stone-900 group-hover:text-[#26433A] transition-colors">
            MedStrip
          </span>
        </button>

        {/* Center: Navigation Links with active dot indicator beneath */}
        <div className="flex items-center gap-6 sm:gap-10">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="relative py-1 flex flex-col items-center group cursor-pointer focus:outline-hidden"
              >
                <span
                  className={`text-sm font-semibold transition-colors duration-200 ${
                    isActive
                      ? 'text-stone-950 font-bold'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  {item.label}
                </span>

                {/* Active Indicator Dot */}
                {isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-900 mt-1 transition-all animate-in fade-in zoom-in-50 duration-200" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent mt-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Language Switcher + Login Trigger + "Scan Now >" Pill Button */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Subtle Language Switcher Pills */}
          <div className="hidden md:flex items-center bg-white/80 p-0.5 rounded-full border border-stone-200/80 text-xs shadow-xs">
            {[
              { id: 'en', label: 'EN' },
              { id: 'hi', label: 'HI' },
              { id: 'pa', label: 'PA' },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLang(l.id)}
                className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                  lang === l.id
                    ? 'bg-[#26433A] text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title={`Spoken Voice: ${l.id === 'en' ? 'English' : l.id === 'hi' ? 'Hindi' : 'Punjabi'}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* User Sign-In Trigger / Profile Pill */}
          {!currentUser ? (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-stone-50 border border-stone-200/90 text-stone-700 hover:text-stone-950 text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer hover:scale-102 active:scale-98"
              title="Sign In to Telehealth Account"
            >
              <User className="w-3.5 h-3.5 text-stone-500" />
              <span>Login</span>
            </button>
          ) : (
            <div className="relative group">
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-stone-200/90 text-stone-800 text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-[#26433A] text-white flex items-center justify-center text-[10px] font-extrabold shadow-2xs">
                  {currentUser.avatarChar || currentUser.name?.[0] || 'U'}
                </div>
                <span className="max-w-[70px] sm:max-w-[110px] truncate">{currentUser.name}</span>
                <ChevronDown className="w-3 h-3 text-stone-400 group-hover:rotate-180 transition-transform" />
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-2xl shadow-lifted border border-stone-200 py-1.5 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] text-stone-500 font-medium truncate border-b border-stone-100">
                  {currentUser.email || 'patient@medstrip.health'}
                </div>
                <button
                  type="button"
                  onClick={onSwitchProfile}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-stone-400" />
                  <span>Switch Profile</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Primary Pill Button "Scan Now >" -> Smoothly scrolls to #scanner */}
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className="flex items-center gap-1.5 px-5 sm:px-6 py-2.5 rounded-full bg-[#1C2321] hover:bg-[#26433A] text-white text-xs sm:text-sm font-bold shadow-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span>Scan Now</span>
            <ChevronRight className="w-4 h-4 text-stone-300" />
          </button>
        </div>
      </div>
    </nav>
  );
}
