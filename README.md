# H10 — Medicine Strip Reader for Low-Literacy Patients (दवाई रीडर)

A mobile-first assistive vision and bilingual voice application specifically engineered for low-literacy and elderly patients across India. The app processes photographs of medicine blister and foil strips, extracts printed and embossed text, strictly verifies against 169,000+ active Indian medicines with zero hallucination, and delivers dynamic spoken instructions in **Hindi (`हिंदी`)** and **Punjabi (`ਪੰਜਾਬੀ`)** alongside visual icon cards (Sun 🌅, Noon ☀️, Moon 🌙, Plate 🍽️).

---

## 🌟 Key Features

1. **Foil-Strip Optical Preprocessing (`backend/preprocess.py`)**:
   - **Blur Detection**: Calculates Laplacian variance $\sigma^2 = \text{Var}(\nabla^2 I)$. If $\sigma^2 < 80$, alerts the user to hold the camera steady (*"कैमरा हिल गया है, हाथ स्थिर रखें"* / *"ਕੈਮਰਾ ਹਿੱਲ ਗਿਆ ਹੈ, ਹੱਥ ਸਥਿਰ ਰੱਖੋ"*).
   - **Foil Specular Glare Detection**: Detects saturated reflection pixels on foil. If glare $> 12\%$, advises the user to tilt the strip away from light (*"दवा की पन्नी पर तेज़ चमक है, पत्ती को थोड़ा तिरछा करें"*).
   - **Foil Contrast Enhancement**: Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) on the L-channel and unsharp masking to enhance debossed and stamped dot-matrix characters on reflective foil before OCR.

2. **OCR & Safe Matcher with 3 Hard Safety Gates (`backend/matcher.py`)**:
   - Matches text strictly against the cleaned SQLite database using `rapidfuzz`.
   - **Gate 1 (Confidence Threshold)**: Requires score $\ge 80\%$. If $< 80\%$, returns `status: "NOT_SURE"`.
   - **Gate 2 (Ambiguity Gap)**: Requires score gap between top 2 distinct medicines $\ge 10\%$. Protects against dangerous lookalike brand confusion.
   - **Gate 3 (Dosage Strength Verification)**: Dosage strength ($mg$, $mcg$, $ml$) on strip must match candidate strength. If missing or mismatched, returns `status: "NOT_SURE"`.
   - **Zero Hallucination Guarantee**: Never guesses or makes assumptions.

3. **Bilingual Hindi & Punjabi Voice Engine (`backend/tts.py`)**:
   - **Strict Medical Rule**: Medicine brand names and scientific salts are **NOT** translated (e.g. *Augmentin 625 Duo*, *Amoxycillin*, *Paracetamol* retain authentic pronunciation).
   - Dynamic Hindi (`hi`) and Punjabi (`pa`) sentence templates speak medicine name, verified strength, and dose timings.
   - Built-in audio caching in `backend/audio_cache/` + offline acoustic chime fallback.

4. **Low-Literacy Mobile UI (`frontend/`)**:
   - **Prominent Bilingual Toggle**: Native script switcher (`हिंदी` | `ਪੰਜਾਬੀ`).
   - **Big Camera Capture Button**: Oversized 72px+ tap target with camera icon and pulsing glow, plus fallback file upload for desktop.
   - **Icon-Based Dose Cards**: Large Sun 🌅 (Morning), Noon ☀️ (Afternoon), Moon 🌙 (Night), and Plate 🍽️ (After food vs Before food) cards.
   - **Voice Readout**: Instant auto-playing voice instructions with large speaker replay button and animated wave.
   - **Voice Reminder Scheduler & 5-Second Demo**: Built-in medication alarm scheduler with a **"Test Reminder in 5 Seconds"** interactive countdown demo button.
   - **1-Click Desktop Sample Selector**: Preloaded strip cards (Augmentin 625 Duo, Azithral 500, Dolo 650, Glare Strip, Blurred Strip, Gate 3 Mismatch) for testing without needing a phone camera.

---

## 🏗️ Architecture

```
med-strip/
├── data/
│   └── A_Z_medicines_dataset_of_India.csv   (Raw 253k row Indian medicine dataset)
├── backend/
│   ├── prepare_data.py                      (ETL: Normalizes brand, generic, strength into SQLite)
│   ├── medicines.db                         (Indexed SQLite database with FTS5, 169k rows)
│   ├── preprocess.py                        (OpenCV Laplacian blur & foil glare percentage)
│   ├── matcher.py                           (OCR extraction, RapidFuzz, 3 Hard Safety Gates)
│   ├── tts.py                               (Hindi/Punjabi voice engine templates & gTTS)
│   ├── main.py                              (FastAPI server & fullstack static distributor)
│   ├── requirements.txt                     (FastAPI, OpenCV, RapidFuzz, gTTS, Pydantic, etc.)
│   ├── test_modules.py                      (Unit tests for preprocess, matcher, TTS)
│   ├── test_api_endpoints.py                (Integration tests for all REST endpoints)
│   └── samples/                             (Preloaded strip photos for evaluation)
├── frontend/
│   ├── package.json                         (React 18, Vite PWA, Lucide-react, TailwindCSS)
│   ├── vite.config.js                       (Vite config with API proxy)
│   ├── tailwind.config.js                   (Tailwind theme)
│   ├── src/
│   │   ├── App.jsx                          (Main UI coordinator)
│   │   └── components/
│   │       ├── Header.jsx                   (Language toggle: हिंदी / ਪੰਜਾਬੀ)
│   │       ├── CameraCapture.jsx            (Large camera button & file picker)
│   │       ├── DoseCard.jsx                 (Sun/Moon/Plate visual dose cards)
│   │       ├── AudioPlayer.jsx              (Big speaker, replay, wave animation)
│   │       ├── QualityAlert.jsx             (Foil glare & blur guidance banners)
│   │       ├── ResultCard.jsx               (Verified match vs NOT_SURE gate banner)
│   │       ├── ReminderModal.jsx            (Voice reminder scheduler & 5-sec demo)
│   │       └── SampleSelector.jsx           (Demo strip photos for 1-click test)
│   └── dist/                                (Production build served directly by FastAPI)
├── start_app.bat                            (1-Click Windows launcher)
└── start_app.ps1                            (PowerShell launcher)
```

---

## 🚀 Quick Start

### 1. Launch the Unified Fullstack Application
Double-click `start_app.bat` or run in PowerShell:
```powershell
.\start_app.ps1
```
Then navigate to: **[http://localhost:8000](http://localhost:8000)**

### 2. Run Verification Tests
```powershell
& "C:\Users\johan\AppData\Local\Programs\Python\Python311\python.exe" backend\test_modules.py
& "C:\Users\johan\AppData\Local\Programs\Python\Python311\python.exe" backend\test_api_endpoints.py
```
