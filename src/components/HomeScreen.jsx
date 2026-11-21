import React from 'react';
import { CheckCircle2, ChevronRight, Volume2, Sparkles, ShieldCheck } from 'lucide-react';
import RevealOnScroll from './RevealOnScroll';

export default function HomeScreen({ onStartScanning }) {
  return (
    <section id="home" className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 scroll-mt-4">
      {/* Giant Hero Container in Nordic Forest Sage #26433A with Rich Ambient Lighting */}
      <RevealOnScroll delay={0}>
        <div className="relative w-full rounded-3xl md:rounded-[2.5rem] bg-gradient-to-br from-[#2f5548] via-[#26433A] to-[#1a2f28] text-white p-8 sm:p-10 md:p-12 lg:p-14 overflow-hidden shadow-lifted border border-white/10">
          {/* Multi-layered radial lighting for rich organic depth */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-96 h-96 bg-teal-300/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#142620] rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            {/* Left Column: Editorial Value Proposition & CTA (7 cols) */}
            <div className="lg:col-span-7 space-y-7">
              {/* Pill Tag */}
              <RevealOnScroll delay={40}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-semibold tracking-wide text-[#E7EFEA] shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AI-Powered Medicine Safety</span>
                </div>
              </RevealOnScroll>

              {/* Editorial Headline */}
              <RevealOnScroll delay={90}>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold tracking-tight leading-[1.08] text-[#FDFCF9] drop-shadow-xs">
                  Every strip, <br className="hidden sm:inline" />
                  crystal clear.
                </h1>
              </RevealOnScroll>

              {/* Subtext */}
              <RevealOnScroll delay={140}>
                <p className="text-base sm:text-lg lg:text-xl text-[#D6E3DD] font-normal leading-relaxed max-w-2xl">
                  Instant medicine verification and voice-guided dosage schedules for patients and families.
                </p>
              </RevealOnScroll>

              {/* 3 Checkmark Items */}
              <div className="space-y-3.5 pt-1">
                {[
                  'Zero-guessing 3-gate verification',
                  '4-frame glare-free strip scanning',
                  'English, Hindi & Punjabi voice guidance',
                ].map((item, idx) => (
                  <RevealOnScroll key={idx} delay={180 + idx * 70}>
                    <div className="flex items-center gap-3 text-sm sm:text-base lg:text-lg text-white font-medium">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
                      </div>
                      <span>{item}</span>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>

              {/* Warm Terracotta-Coral CTA Pill Button -> Scrolls smoothly to #scanner */}
              <RevealOnScroll delay={400} className="pt-2">
                <button
                  type="button"
                  onClick={onStartScanning}
                  className="inline-flex items-center gap-2.5 px-9 py-4 rounded-full bg-[#D97742] hover:bg-[#c66835] text-white font-bold text-base lg:text-lg shadow-lg shadow-[#D97742]/30 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer group"
                >
                  <span>Start Scanning</span>
                  <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </RevealOnScroll>
            </div>

            {/* Right Column: 2x2 Bento Feature Grid (5 cols) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4 sm:gap-5">
              {/* Bento Card 1: 100% Verified Safety Gates */}
              <RevealOnScroll delay={80} className="h-full">
                <div className="group relative h-52 sm:h-64 min-h-[210px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1e342d] p-5 flex flex-col justify-end shadow-md hover:shadow-xl transition-all duration-300 border border-white/15 hover:border-emerald-300/40 hover:-translate-y-1 cursor-default">
                  {/* Rich Real Visual Image with High Visibility */}
                  <img
                    src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=700&q=80"
                    alt="Doctor Consultation"
                    className="absolute inset-0 w-full h-full object-cover object-top opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 filter brightness-95"
                    loading="lazy"
                  />
                  {/* Bottom Scrim for perfect high-contrast typography */}
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

                  {/* Floating Shield Badge Top-Right */}
                  <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-[#26433A]/80 backdrop-blur-md border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>

                  <div className="relative z-10 space-y-0.5">
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight drop-shadow-md">
                      100% Verified
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-200 font-medium drop-shadow-sm">
                      Safety Gates
                    </p>
                  </div>
                </div>
              </RevealOnScroll>

              {/* Bento Card 2: 4-Frame Anti-Glare Burst */}
              <RevealOnScroll delay={160} className="h-full">
                <div className="group relative h-52 sm:h-64 min-h-[210px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1e342d] p-5 flex flex-col justify-end shadow-md hover:shadow-xl transition-all duration-300 border border-white/15 hover:border-emerald-300/40 hover:-translate-y-1 cursor-default">
                  {/* Blister pack photo with hands */}
                  <img
                    src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80"
                    alt="Medicine Blister Pack"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 filter brightness-95"
                    loading="lazy"
                  />
                  {/* Bottom Scrim */}
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

                  {/* White corner brackets matching scanner aesthetics */}
                  <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-white/90 drop-shadow-xs" />
                  <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-white/90 drop-shadow-xs" />
                  <div className="absolute bottom-12 left-3 w-3 h-3 border-b-2 border-l-2 border-white/90 drop-shadow-xs" />
                  <div className="absolute bottom-12 right-3 w-3 h-3 border-b-2 border-r-2 border-white/90 drop-shadow-xs" />

                  <div className="relative z-10 space-y-0.5">
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight drop-shadow-md">
                      4-Frame
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-200 font-medium drop-shadow-sm">
                      Anti-Glare Burst
                    </p>
                  </div>
                </div>
              </RevealOnScroll>

              {/* Bento Card 3: Trilingual Voice Guide */}
              <RevealOnScroll delay={240} className="h-full">
                <div className="group relative h-52 sm:h-64 min-h-[210px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1e342d] p-5 flex flex-col justify-end shadow-md hover:shadow-xl transition-all duration-300 border border-white/15 hover:border-emerald-300/40 hover:-translate-y-1 cursor-default">
                  {/* Caring telehealth / senior counseling scene */}
                  <img
                    src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=700&q=80"
                    alt="Doctor with Patient"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 filter brightness-95"
                    loading="lazy"
                  />
                  {/* Bottom Scrim */}
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

                  {/* Audio Speaker Pill Badge Top-Right */}
                  <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-xs">
                    <Volume2 className="w-4 h-4" />
                  </div>

                  <div className="relative z-10 space-y-0.5">
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight drop-shadow-md">
                      Trilingual Voice
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-200 font-medium drop-shadow-sm">
                      EN • HI • PA Guide
                    </p>
                  </div>
                </div>
              </RevealOnScroll>

              {/* Bento Card 4: Offline RapidOCR Fallback */}
              <RevealOnScroll delay={320} className="h-full">
                <div className="group relative h-52 sm:h-64 min-h-[210px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1e342d] p-5 flex flex-col justify-end shadow-md hover:shadow-xl transition-all duration-300 border border-white/15 hover:border-emerald-300/40 hover:-translate-y-1 cursor-default">
                  {/* Medicine Strip / Optical Barcode Lab Image */}
                  <img
                    src="https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=700&q=80"
                    alt="Medicine OCR Analysis"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 filter brightness-95"
                    loading="lazy"
                  />
                  {/* Bottom Scrim */}
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

                  {/* Corner framing brackets */}
                  <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-white/90 drop-shadow-xs" />
                  <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-white/90 drop-shadow-xs" />
                  <div className="absolute bottom-12 left-3 w-3 h-3 border-b-2 border-l-2 border-white/90 drop-shadow-xs" />
                  <div className="absolute bottom-12 right-3 w-3 h-3 border-b-2 border-r-2 border-white/90 drop-shadow-xs" />

                  {/* Subtle Horizontal Scanning Laser Line */}
                  <div className="absolute top-1/2 inset-x-4 h-[1.5px] bg-emerald-400/70 shadow-[0_0_8px_#34d399] pointer-events-none" />

                  <div className="relative z-10 space-y-0.5">
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight drop-shadow-md">
                      Offline
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-200 font-medium drop-shadow-sm">
                      RapidOCR Fallback
                    </p>
                  </div>
                </div>
              </RevealOnScroll>
            </div>
          </div>

          {/* Bottom Right 4-Point Star Sparkle matching reference */}
          <div className="absolute bottom-4 right-4 pointer-events-none opacity-50">
            <Sparkles className="w-6 h-6 text-emerald-200" />
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}
