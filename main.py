import os
import sys
import hashlib
from typing import List, Optional
from pathlib import Path
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Explicitly load root .env using absolute path (works regardless of uvicorn --app-dir)
ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ROOT_ENV)
PROJECT_ROOT = str(ROOT_ENV.parent)

import preprocess
import matcher
import tts
import vlm_ocr

app = FastAPI(
    title="H10 — Medicine Strip Reader for Low-Literacy Patients",
    description="Safe OCR strip reader with RapidOCR (ONNX Runtime), RapidFuzz 3-gate verification and trilingual English/Hindi/Punjabi voice engine."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
DB_PATH = os.path.join(BACKEND_DIR, "medicines.db")
FRONTEND_DIST = os.path.join(PROJECT_ROOT, "frontend", "dist")

# Lightweight in-memory LRU cache for repeat scans (max 128 items)
SCAN_CACHE_MAX_SIZE = 128
_scan_lru_cache: OrderedDict[str, dict] = OrderedDict()

def get_cached_scan(cache_key: str) -> Optional[dict]:
    if cache_key in _scan_lru_cache:
        _scan_lru_cache.move_to_end(cache_key)
        return _scan_lru_cache[cache_key]
    return None

def set_cached_scan(cache_key: str, data: dict):
    _scan_lru_cache[cache_key] = data
    _scan_lru_cache.move_to_end(cache_key)
    if len(_scan_lru_cache) > SCAN_CACHE_MAX_SIZE:
        _scan_lru_cache.popitem(last=False)

class MatchTextRequest(BaseModel):
    text: str
    lang: str = "hi"
    morning: bool = True
    afternoon: bool = False
    night: bool = True
    after_food: bool = True

class TTSRequest(BaseModel):
    text: str
    lang: str = "hi"

class ReminderRequest(BaseModel):
    brand_name: str
    lang: str = "hi"

def build_voice_payload(result_or_issue: dict | str, schedule: dict = None, is_quality_issue: bool = False) -> dict:
    """
    Generates localized spoken text and base64 audio for English ('en'), Hindi ('hi'), and Punjabi ('pa').
    Ensures the frontend can toggle between all three languages instantly with 0 latency.
    """
    if schedule is None:
        schedule = {"morning": True, "afternoon": False, "night": True, "after_food": True}

    if is_quality_issue:
        issue = str(result_or_issue)
        text_en = preprocess.GUIDANCE_MESSAGES.get(issue, {}).get("en", "")
        text_hi = preprocess.GUIDANCE_MESSAGES.get(issue, {}).get("hi", "")
        text_pa = preprocess.GUIDANCE_MESSAGES.get(issue, {}).get("pa", "")
    else:
        match_result = result_or_issue if isinstance(result_or_issue, dict) else {}
        text_en = tts.generate_speech_text(match_result, lang="en", schedule=schedule)
        text_hi = tts.generate_speech_text(match_result, lang="hi", schedule=schedule)
        text_pa = tts.generate_speech_text(match_result, lang="pa", schedule=schedule)

    audio_en = tts.synthesize_speech_base64(text_en, lang="en")
    audio_hi = tts.synthesize_speech_base64(text_hi, lang="hi")
    audio_pa = tts.synthesize_speech_base64(text_pa, lang="pa")

    return {
        "en": {
            "text": text_en,
            "audio_base64": audio_en,
            "audio_url": audio_en
        },
        "hi": {
            "text": text_hi,
            "audio_base64": audio_hi,
            "audio_url": audio_hi
        },
        "pa": {
            "text": text_pa,
            "audio_base64": audio_pa,
            "audio_url": audio_pa
        }
    }

@app.get("/api/health")
def healthcheck():
    """Returns database readiness, row counts, and backend status."""
    db_ready = os.path.exists(DB_PATH)
    total_medicines = 0
    if db_ready:
        import sqlite3
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("SELECT count(*) FROM medicines")
            total_medicines = cur.fetchone()[0]
            conn.close()
        except Exception:
            pass

    return {
        "status": "ok",
        "database_ready": db_ready,
        "total_medicines": total_medicines,
        "rapidocr_available": matcher.RAPIDOCR_AVAILABLE,
        "gemini_vision_available": vlm_ocr.is_vlm_available(),
        "languages_supported": ["en", "hi", "pa"]
    }

@app.post("/api/scan")
async def scan_strip_endpoint(
    file: UploadFile = File(...),
    lang: str = Form("hi"),
    morning: bool = Form(True),
    afternoon: bool = Form(False),
    night: bool = Form(True),
    after_food: bool = Form(True)
):
    """
    Primary pipeline endpoint:
    1. Preprocesses strip image (CLAHE contrast enhancement & unsharp masking).
    2. Runs Gemini Flash Vision OCR with automatic fallback to offline RapidOCR.
    3. Matches against SQLite database using RapidFuzz & 3 hard safety gates.
    4. If matching succeeds (VERIFIED), returns the medicine immediately!
    5. Always includes BOTH Hindi and Punjabi speech in the 'voice' payload for instant UI toggling.
    """
    if hasattr(file, "file") and hasattr(file.file, "read"):
        file.file.seek(0)
        image_bytes = file.file.read()
    else:
        image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file received.")

    # In-memory LRU cache check for single scan
    image_hash = hashlib.sha256(image_bytes).hexdigest()
    cache_key = f"scan:{image_hash}:{lang}:{morning}:{afternoon}:{night}:{after_food}"
    cached_res = get_cached_scan(cache_key)
    if cached_res:
        print(f"[SCAN] Cache HIT for key {cache_key[:30]}", flush=True)
        return cached_res

    schedule = {
        "morning": morning,
        "afternoon": afternoon,
        "night": night,
        "after_food": after_food
    }

    # Step 1: Preprocessing & Quality Assessment
    try:
        prep_result = preprocess.process_foil_strip(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

    # Step 2: OCR Extraction (Gemini Flash Vision with offline RapidOCR fallback)
    ocr_engine = "Offline RapidOCR"
    ocr_text = ""
    vlm_result = None

    if vlm_ocr.is_vlm_available():
        try:
            print("[SCAN] Attempting Gemini Flash Vision transcription...", flush=True)
            vlm_res = vlm_ocr.transcribe_strip_vlm(image_bytes, timeout_seconds=20.0)
            if vlm_res:
                vlm_result = vlm_res
                ocr_engine = "Gemini Flash Vision"
                parts = []
                if vlm_result.get("brand_name"):
                    parts.append(vlm_result["brand_name"])
                if vlm_result.get("generic_salts"):
                    parts.extend(vlm_result["generic_salts"])
                if vlm_result.get("strengths"):
                    parts.extend(vlm_result["strengths"])
                if vlm_result.get("raw_text"):
                    parts.append(vlm_result["raw_text"])
                ocr_text = " ".join(parts).strip()
                print(f"[SCAN] Gemini Flash Vision extracted: brand='{vlm_result.get('brand_name')}', salts={vlm_result.get('generic_salts')}, strengths={vlm_result.get('strengths')}", flush=True)
            else:
                print("[SCAN NOTICE] Gemini Flash Vision returned None; falling back to Offline RapidOCR.", flush=True)
        except Exception as e:
            import traceback
            print(f"[SCAN ERROR] Gemini Flash Vision exception ({type(e).__name__}: {e})\n{traceback.format_exc()}Falling back to Offline RapidOCR.", flush=True)
    else:
        print("[SCAN NOTICE] Gemini Flash Vision is not available (key not set or genai uninstalled); using Offline RapidOCR.", flush=True)

    if not ocr_text:
        enhanced_image = prep_result["enhanced_image"]
        original_image = prep_result.get("original_image")
        ocr_text = matcher.extract_ocr_text(enhanced_image, original_image=original_image)
        ocr_engine = "Offline RapidOCR"

    # Step 3: Safe Matcher with 3 Hard Safety Gates
    match_result = matcher.safe_match(ocr_text, DB_PATH, vlm_data=vlm_result)

    # Step 4: If match succeeded, return the verified medicine!
    if match_result["status"] == "VERIFIED":
        voice_payload = build_voice_payload(match_result, schedule=schedule)
        active_lang = lang if lang in ("en", "pa", "hi") else "en"
        res = {
            "status": "VERIFIED",
            "quality_ok": True,
            "blur_score": prep_result["blur_score"],
            "glare_pct": prep_result["glare_pct"],
            "ocr_engine": ocr_engine,
            "brand_name": match_result.get("brand_name"),
            "generic_name": match_result.get("generic_name"),
            "strength": match_result.get("strength"),
            "manufacturer": match_result.get("manufacturer"),
            "price": match_result.get("price"),
            "confidence": match_result.get("confidence", 0.0),
            "match_type": match_result.get("match_type", "BRANDED"),
            "detected_strengths": match_result.get("detected_strengths", []),
            "schedule": schedule,
            "ocr_text": ocr_text,
            "speech_text": voice_payload[active_lang]["text"],
            "audio_base64": voice_payload[active_lang]["audio_base64"],
            "voice": voice_payload
        }
        set_cached_scan(cache_key, res)
        return res

    # Step 5: Matching returned NOT_SURE -> Check if glare > 15% or blur < 80
    has_glare = prep_result["glare_pct"] > preprocess.GLARE_WARNING_THRESHOLD
    is_blurred = prep_result["blur_score"] < preprocess.BLUR_WARNING_THRESHOLD

    if has_glare or is_blurred:
        if has_glare and is_blurred:
            issue = "BOTH"
        elif has_glare:
            issue = "GLARE"
        else:
            issue = "BLUR"

        voice_payload = build_voice_payload(issue, schedule=schedule, is_quality_issue=True)
        active_lang = lang if lang in ("en", "pa", "hi") else "en"
        res = {
            "status": "NOT_SURE",
            "quality_ok": False,
            "issue": issue,
            "blur_score": prep_result["blur_score"],
            "glare_pct": prep_result["glare_pct"],
            "ocr_engine": ocr_engine,
            "reason": voice_payload[active_lang]["text"],
            "speech_text": voice_payload[active_lang]["text"],
            "audio_base64": voice_payload[active_lang]["audio_base64"],
            "schedule": schedule,
            "ocr_text": ocr_text,
            "voice": voice_payload
        }
        set_cached_scan(cache_key, res)
        return res

    # Step 6: Normal NOT_SURE (Confidence, Ambiguity, or Strength gate failure)
    voice_payload = build_voice_payload(match_result, schedule=schedule)
    active_lang = lang if lang in ("en", "pa", "hi") else "en"
    res = {
        "status": "NOT_SURE",
        "quality_ok": True,
        "blur_score": prep_result["blur_score"],
        "glare_pct": prep_result["glare_pct"],
        "ocr_engine": ocr_engine,
        "brand_name": match_result.get("brand_name"),
        "confidence": match_result.get("confidence", 0.0),
        "gate_failed": match_result.get("gate_failed"),
        "reason": match_result.get("reason"),
        "expected_strength": match_result.get("expected_strength"),
        "detected_strengths": match_result.get("detected_strengths"),
        "schedule": schedule,
        "ocr_text": ocr_text,
        "speech_text": voice_payload[active_lang]["text"],
        "audio_base64": voice_payload[active_lang]["audio_base64"],
        "voice": voice_payload
    }
    set_cached_scan(cache_key, res)
    return res

@app.post("/api/scan-burst")
async def scan_burst_endpoint(
    files: List[UploadFile] = File(...),
    lang: str = Form("hi"),
    morning: bool = Form(True),
    afternoon: bool = Form(False),
    night: bool = Form(True),
    after_food: bool = Form(True)
):
    """
    4-Frame Tilt Burst Endpoint:
    Receives multiple frames captured as the user tilts the strip to beat foil glare.
    Preprocesses frames concurrently via ThreadPoolExecutor (OpenCV).
    Short-circuits immediately if the single sharpest frame passes all 3 Hard Safety Gates (VERIFIED).
    Falls back to RapidOCR pooling only if needed, with instant LRU caching.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No image files received in burst.")

    schedule = {
        "morning": morning,
        "afternoon": afternoon,
        "night": night,
        "after_food": after_food
    }

    raw_frames = []
    for idx, file in enumerate(files):
        if hasattr(file, "file") and hasattr(file.file, "read"):
            file.file.seek(0)
            b = file.file.read()
        else:
            b = await file.read()
        if b:
            raw_frames.append(b)

    if not raw_frames:
        raise HTTPException(status_code=400, detail="No valid image data received in burst.")

    # Cache lookup across all burst frames
    burst_hasher = hashlib.sha256()
    for b in raw_frames:
        burst_hasher.update(b)
    cache_key = f"burst:{burst_hasher.hexdigest()}:{lang}:{morning}:{afternoon}:{night}:{after_food}"
    cached_res = get_cached_scan(cache_key)
    if cached_res:
        print(f"[BURST] Cache HIT for key {cache_key[:30]}", flush=True)
        return cached_res

    # Step 1: Preprocess all frames concurrently using ThreadPoolExecutor (CPU-bound OpenCV)
    with ThreadPoolExecutor(max_workers=min(4, len(raw_frames))) as executor:
        prep_results = list(executor.map(preprocess.process_foil_strip, raw_frames))

    blur_scores = [p["blur_score"] for p in prep_results]
    glare_pcts = [p["glare_pct"] for p in prep_results]
    avg_blur = round(sum(blur_scores) / len(blur_scores), 1) if blur_scores else 0.0
    avg_glare = round(sum(glare_pcts) / len(glare_pcts), 1) if glare_pcts else 0.0

    valid_candidates = []
    for idx, (prep, raw_b) in enumerate(zip(prep_results, raw_frames)):
        if prep["blur_score"] < preprocess.HARD_BLUR_ABORT_THRESHOLD:
            print(f"[BURST] Skipping frame {idx+1}: severely blurred (blur_score: {prep['blur_score']:.1f})", flush=True)
            continue
        # Quality score prioritizes high sharpness and low specular glare
        quality_score = prep["blur_score"] - (prep["glare_pct"] * 5.0)
        valid_candidates.append((quality_score, idx, prep, raw_b))

    if not valid_candidates:
        # All frames severely blurred
        issue = "BLUR"
        voice_payload = build_voice_payload(issue, schedule=schedule, is_quality_issue=True)
        active_lang = lang if lang in ("en", "pa", "hi") else "en"
        res = {
            "status": "NOT_SURE",
            "quality_ok": False,
            "issue": issue,
            "blur_score": avg_blur,
            "glare_pct": avg_glare,
            "ocr_engine": "Offline RapidOCR",
            "burst_frames_count": len(raw_frames),
            "burst_frames_used": 0,
            "reason": voice_payload[active_lang]["text"],
            "speech_text": voice_payload[active_lang]["text"],
            "audio_base64": voice_payload[active_lang]["audio_base64"],
            "schedule": schedule,
            "ocr_text": "",
            "voice": voice_payload
        }
        set_cached_scan(cache_key, res)
        return res

    # Sort valid frames so the highest quality (sharpest, least glare) is first
    valid_candidates.sort(key=lambda x: x[0], reverse=True)
    best_quality, best_idx, sharpest_prep, sharpest_bytes = valid_candidates[0]
    print(f"[BURST] Sharpest candidate is frame {best_idx+1} (score: {best_quality:.1f}, blur: {sharpest_prep['blur_score']:.1f}, glare: {sharpest_prep['glare_pct']:.1f}%)", flush=True)

    # Step 2: Attempt Single Sharpest Frame Check with Early Exit!
    ocr_engine = "Offline RapidOCR"
    sharpest_ocr_text = ""
    vlm_result = None

    if vlm_ocr.is_vlm_available():
        try:
            print("[BURST] Transcribing sharpest frame with Gemini Flash Vision...", flush=True)
            vlm_res = vlm_ocr.transcribe_strip_vlm(sharpest_bytes, timeout_seconds=15.0)
            if vlm_res:
                vlm_result = vlm_res
                ocr_engine = "Gemini Flash Vision"
                parts = []
                if vlm_result.get("brand_name"):
                    parts.append(vlm_result["brand_name"])
                if vlm_result.get("generic_salts"):
                    parts.extend(vlm_result["generic_salts"])
                if vlm_result.get("strengths"):
                    parts.extend(vlm_result["strengths"])
                if vlm_result.get("raw_text"):
                    parts.append(vlm_result["raw_text"])
                sharpest_ocr_text = " ".join(parts).strip()
        except Exception as e:
            print(f"[BURST ERROR] Gemini Vision sharpest frame error: {e}. Falling back to RapidOCR.")

    if not sharpest_ocr_text:
        sharpest_ocr_text = matcher.extract_ocr_text(sharpest_prep["enhanced_image"], original_image=sharpest_prep.get("original_image"))
        ocr_engine = "Offline RapidOCR"

    # Test sharpest frame against 3 Hard Safety Gates
    sharpest_match = matcher.safe_match(sharpest_ocr_text, DB_PATH, vlm_data=vlm_result)

    # EARLY EXIT: If sharpest frame is VERIFIED, return immediately!
    if sharpest_match["status"] == "VERIFIED":
        print(f"[BURST EARLY EXIT] Verified on sharpest frame ({sharpest_match.get('brand_name')})! Skipping OCR on remaining frames.", flush=True)
        voice_payload = build_voice_payload(sharpest_match, schedule=schedule)
        active_lang = lang if lang in ("en", "pa", "hi") else "en"
        res = {
            "status": "VERIFIED",
            "quality_ok": True,
            "blur_score": avg_blur,
            "glare_pct": avg_glare,
            "ocr_engine": ocr_engine,
            "burst_frames_count": len(raw_frames),
            "burst_frames_used": 1,
            "brand_name": sharpest_match.get("brand_name"),
            "generic_name": sharpest_match.get("generic_name"),
            "strength": sharpest_match.get("strength"),
            "manufacturer": sharpest_match.get("manufacturer"),
            "price": sharpest_match.get("price"),
            "confidence": sharpest_match.get("confidence", 0.0),
            "match_type": sharpest_match.get("match_type", "BRANDED"),
            "detected_strengths": sharpest_match.get("detected_strengths", []),
            "schedule": schedule,
            "ocr_text": sharpest_ocr_text,
            "speech_text": voice_payload[active_lang]["text"],
            "audio_base64": voice_payload[active_lang]["audio_base64"],
            "voice": voice_payload
        }
        set_cached_scan(cache_key, res)
        return res

    # Step 3: Fallback - Sharpest frame alone was NOT_SURE.
    # Extract OCR from remaining valid frames sequentially and pool them.
    extracted_texts = []
    if sharpest_ocr_text and sharpest_ocr_text.strip():
        extracted_texts.append(sharpest_ocr_text)

    for q_score, orig_idx, prep, raw_b in valid_candidates[1:]:
        frame_text = matcher.extract_ocr_text(prep["enhanced_image"], original_image=prep.get("original_image"))
        if frame_text and frame_text.strip():
            extracted_texts.append(frame_text)

    pooled_ocr_text = matcher.pool_ocr_texts(extracted_texts) if extracted_texts else sharpest_ocr_text
    match_result = matcher.safe_match(pooled_ocr_text, DB_PATH, vlm_data=vlm_result)

    if match_result["status"] == "VERIFIED":
        voice_payload = build_voice_payload(match_result, schedule=schedule)
        active_lang = lang if lang in ("en", "pa", "hi") else "en"
        res = {
            "status": "VERIFIED",
            "quality_ok": True,
            "blur_score": avg_blur,
            "glare_pct": avg_glare,
            "ocr_engine": ocr_engine,
            "burst_frames_count": len(raw_frames),
            "burst_frames_used": len(extracted_texts),
            "brand_name": match_result.get("brand_name"),
            "generic_name": match_result.get("generic_name"),
            "strength": match_result.get("strength"),
            "manufacturer": match_result.get("manufacturer"),
            "price": match_result.get("price"),
            "confidence": match_result.get("confidence", 0.0),
            "match_type": match_result.get("match_type", "BRANDED"),
            "detected_strengths": match_result.get("detected_strengths", []),
            "schedule": schedule,
            "ocr_text": pooled_ocr_text,
            "speech_text": voice_payload[active_lang]["text"],
            "audio_base64": voice_payload[active_lang]["audio_base64"],
            "voice": voice_payload
        }
        set_cached_scan(cache_key, res)
        return res

    # Step 4: NOT_SURE - Check glare/blur quality warnings
    has_glare = avg_glare > preprocess.GLARE_WARNING_THRESHOLD
    is_blurred = avg_blur < preprocess.BLUR_WARNING_THRESHOLD

    if has_glare or is_blurred:
        if has_glare and is_blurred:
            issue = "BOTH"
        elif has_glare:
            issue = "GLARE"
        else:
            issue = "BLUR"

        voice_payload = build_voice_payload(issue, schedule=schedule, is_quality_issue=True)
        active_lang = lang if lang in ("en", "pa", "hi") else "en"
        res = {
            "status": "NOT_SURE",
            "quality_ok": False,
            "issue": issue,
            "blur_score": avg_blur,
            "glare_pct": avg_glare,
            "ocr_engine": ocr_engine,
            "burst_frames_count": len(raw_frames),
            "burst_frames_used": len(extracted_texts),
            "reason": voice_payload[active_lang]["text"],
            "speech_text": voice_payload[active_lang]["text"],
            "audio_base64": voice_payload[active_lang]["audio_base64"],
            "schedule": schedule,
            "ocr_text": pooled_ocr_text,
            "voice": voice_payload
        }
        set_cached_scan(cache_key, res)
        return res

    # Normal NOT_SURE (Gate 1, 2, or 3 failure)
    voice_payload = build_voice_payload(match_result, schedule=schedule)
    active_lang = lang if lang in ("en", "pa", "hi") else "en"
    res = {
        "status": "NOT_SURE",
        "quality_ok": True,
        "blur_score": avg_blur,
        "glare_pct": avg_glare,
        "ocr_engine": ocr_engine,
        "burst_frames_count": len(raw_frames),
        "burst_frames_used": len(extracted_texts),
        "brand_name": match_result.get("brand_name"),
        "confidence": match_result.get("confidence", 0.0),
        "gate_failed": match_result.get("gate_failed"),
        "reason": match_result.get("reason"),
        "expected_strength": match_result.get("expected_strength"),
        "detected_strengths": match_result.get("detected_strengths", []),
        "schedule": schedule,
        "ocr_text": pooled_ocr_text,
        "speech_text": voice_payload[active_lang]["text"],
        "audio_base64": voice_payload[active_lang]["audio_base64"],
        "voice": voice_payload
    }
    set_cached_scan(cache_key, res)
    return res

@app.post("/api/match-text")
def match_text_endpoint(req: MatchTextRequest):
    """Direct OCR text matcher endpoint returning trilingual speech payloads."""
    match_result = matcher.safe_match(req.text, DB_PATH)
    schedule = {
        "morning": req.morning,
        "afternoon": req.afternoon,
        "night": req.night,
        "after_food": req.after_food
    }
    voice_payload = build_voice_payload(match_result, schedule=schedule)
    active_lang = req.lang if req.lang in ("en", "pa", "hi") else "en"

    return {
        "status": match_result["status"],
        "quality_ok": True,
        "brand_name": match_result.get("brand_name"),
        "generic_name": match_result.get("generic_name"),
        "strength": match_result.get("strength"),
        "manufacturer": match_result.get("manufacturer"),
        "price": match_result.get("price"),
        "confidence": match_result.get("confidence", 0.0),
        "match_type": match_result.get("match_type", "BRANDED"),
        "gate_failed": match_result.get("gate_failed"),
        "reason": match_result.get("reason"),
        "expected_strength": match_result.get("expected_strength"),
        "detected_strengths": match_result.get("detected_strengths", []),
        "schedule": schedule,
        "ocr_text": req.text,
        "speech_text": voice_payload[active_lang]["text"],
        "audio_base64": voice_payload[active_lang]["audio_base64"],
        "voice": voice_payload
    }

@app.post("/api/tts")
def tts_endpoint(req: TTSRequest):
    """Generates base64 encoded MP3 audio for given text in English, Hindi, or Punjabi."""
    audio_b64 = tts.synthesize_speech_base64(req.text, lang=req.lang)
    return {
        "text": req.text,
        "lang": req.lang,
        "audio_base64": audio_b64
    }

@app.post("/api/reminder")
def reminder_endpoint(req: ReminderRequest):
    """Generates reminder alarm voice sentence and base64 audio in all three languages."""
    speech_en = tts.generate_reminder_text(req.brand_name, lang="en")
    audio_en = tts.synthesize_speech_base64(speech_en, lang="en")

    speech_hi = tts.generate_reminder_text(req.brand_name, lang="hi")
    audio_hi = tts.synthesize_speech_base64(speech_hi, lang="hi")

    speech_pa = tts.generate_reminder_text(req.brand_name, lang="pa")
    audio_pa = tts.synthesize_speech_base64(speech_pa, lang="pa")

    active_lang = req.lang if req.lang in ("en", "pa", "hi") else "en"
    speech_map = {"en": speech_en, "hi": speech_hi, "pa": speech_pa}
    audio_map = {"en": audio_en, "hi": audio_hi, "pa": audio_pa}

    return {
        "brand_name": req.brand_name,
        "lang": active_lang,
        "speech_text": speech_map[active_lang],
        "audio_base64": audio_map[active_lang],
        "voice": {
            "en": { "text": speech_en, "audio_base64": audio_en, "audio_url": audio_en },
            "hi": { "text": speech_hi, "audio_base64": audio_hi, "audio_url": audio_hi },
            "pa": { "text": speech_pa, "audio_base64": audio_pa, "audio_url": audio_pa }
        }
    }

@app.get("/api/samples")
def get_samples():
    """Returns metadata for preloaded test medicine strip samples."""
    samples_dir = os.path.join(BACKEND_DIR, "samples")
    samples = []
    if os.path.exists(samples_dir):
        for f in os.listdir(samples_dir):
            if f.endswith((".jpg", ".png", ".jpeg")):
                samples.append({
                    "filename": f,
                    "url": f"/samples/{f}"
                })
    return {"samples": samples}

# Mount samples directory if present
samples_dir = os.path.join(BACKEND_DIR, "samples")
if os.path.exists(samples_dir):
    app.mount("/samples", StaticFiles(directory=samples_dir), name="samples")

# Mount frontend production build if present
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
