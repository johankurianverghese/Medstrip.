import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff, CheckCircle2, AlertCircle, User } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLogin, currentUser }) {
  const [fullName, setFullName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [forgotNotice, setForgotNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Pre-fill or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setForgotNotice(false);
      if (currentUser && currentUser.name && currentUser.name !== 'Guest Patient') {
        setFullName(currentUser.name);
        setEmailOrPhone(currentUser.email || '');
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const validateInputs = () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter your full name.');
      return false;
    }

    if (trimmedName.length < 2) {
      setErrorMsg('Full name must be at least 2 characters long.');
      return false;
    }

    const trimmedContact = emailOrPhone.trim();
    if (!trimmedContact) {
      setErrorMsg('Please enter your email address or mobile number.');
      return false;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact);
    const cleanedPhone = trimmedContact.replace(/\D/g, '');
    const isPhone = cleanedPhone.length >= 10;

    if (!isEmail && !isPhone) {
      setErrorMsg('Please enter a valid email address or 10-digit mobile number.');
      return false;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return false;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return false;
    }

    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setForgotNotice(false);

    if (!validateInputs()) {
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const trimmedName = fullName.trim();
      const displayName = trimmedName
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const trimmedContact = emailOrPhone.trim();
      let displayEmail = trimmedContact;
      if (!trimmedContact.includes('@')) {
        displayEmail = `${trimmedContact}@patient.medstrip.health`;
      }

      onLogin({
        name: displayName,
        fullName: displayName,
        email: displayEmail,
        role: 'Verified Patient',
        avatarChar: displayName[0] || 'U',
        rememberMe,
      });

      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  const handleGuestContinue = () => {
    onLogin({
      name: 'Guest Patient',
      fullName: 'Guest Patient',
      email: 'guest@medstrip.local',
      role: 'Offline Patient',
      avatarChar: 'G',
      rememberMe: false,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#FAF7F2] rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-lifted space-y-5 animate-in zoom-in-95 duration-200 text-stone-900 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 border border-stone-200/80 transition-colors cursor-pointer shadow-2xs"
          aria-label="Close Login Modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E7EFEA] border border-[#D5E3DA] text-[11px] font-bold text-[#26433A]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D5B]" />
            <span>MedStrip Telehealth Account</span>
          </div>
          <h2 className="text-2xl sm:text-[1.65rem] font-extrabold text-[#1C2321] tracking-tight">
            Sign In to MedStrip
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed">
            Sync dosage calendars, prescription history &amp; voice alarm preferences.
          </p>
        </div>

        {/* Validation / Error Feedback */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password Reset Notice */}
        {forgotNotice && (
          <div className="p-3 rounded-2xl bg-[#E7EFEA] border border-[#BFE0CD] text-[#26433A] text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
            <span>Password reset instructions have been dispatched to your contact channel.</span>
          </div>
        )}

        {/* Standard Credentials Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name Input Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800 block">
              Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter your full name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stone-300 focus:border-[#26433A] focus:ring-2 focus:ring-[#26433A]/20 outline-hidden text-xs sm:text-sm font-medium text-stone-900 shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Email / Mobile Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800 block">
              Email or Mobile Number *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoComplete="username"
                value={emailOrPhone}
                onChange={(e) => {
                  setEmailOrPhone(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="patient@example.com or 9876543210"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stone-300 focus:border-[#26433A] focus:ring-2 focus:ring-[#26433A]/20 outline-hidden text-xs sm:text-sm font-medium text-stone-900 shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Password Field with Show / Hide Toggle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800">
                Password *
              </label>
              <button
                type="button"
                onClick={() => setForgotNotice(true)}
                className="text-[11px] font-semibold text-[#26433A] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter your account password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-stone-300 focus:border-[#26433A] focus:ring-2 focus:ring-[#26433A]/20 outline-hidden text-xs sm:text-sm font-medium text-stone-900 shadow-2xs transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Option */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-md border-stone-300 text-[#26433A] focus:ring-[#26433A] accent-[#26433A] cursor-pointer"
              />
              <span className="text-xs font-semibold text-stone-700">Remember me</span>
            </label>
          </div>

          {/* Primary Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-full bg-[#1C2321] hover:bg-[#26433A] text-white font-bold text-sm shadow-md transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In to Account'}</span>
              <ArrowRight className="w-4 h-4 text-stone-300" />
            </button>
          </div>
        </form>

        {/* Clean Guest / Offline Option at the Bottom */}
        <div className="pt-1.5 text-center border-t border-stone-200/70">
          <button
            type="button"
            onClick={handleGuestContinue}
            className="text-xs font-semibold text-stone-600 hover:text-[#26433A] transition-colors cursor-pointer"
          >
            Continue as Guest / Offline Patient →
          </button>
        </div>
      </div>
    </div>
  );
}
