import os
import sys
import json
import time
import logging
import cv2
import numpy as np
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from dotenv import load_dotenv

# Ensure environment variables from project root .env are loaded using absolute path
ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ROOT_ENV)

logger = logging.getLogger("vlm_ocr")

# Models to attempt in order (high-quota Flash-Lite first for low latency & fast throughput)
CANDIDATE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash"
]

GENAI_AVAILABLE = False
try:
    from google import genai
    from google.genai import types
    from google.genai.errors import APIError, ClientError
    GENAI_AVAILABLE = True
except ImportError:
    logger.warning("[VLM] google-genai library is not installed.")

TRANSCRIPTION_PROMPT = """You are an ultra-precise, literal optical character reader (OCR) for pharmaceutical medicine blister foil strips.
Your job is strictly transcription.

RULES:
1. Read ONLY characters physically visible on the strip image (including rotated, curved, embossed, or foil-stamped text).
2. NEVER guess, speculate, or autocomplete torn, cut-off, or partially obstructed letters. If part of a word is torn or cut off, represent the missing characters as "___" (e.g., "___cetamol" or "Parac___").
3. Extract:
   - "brand_name": Primary brand name visible on the strip, preserving all variant suffixes (e.g., "Zerodol-SP", "Augmentin 625 Duo", "Dolo 650", "Pan 40", "Allegra 120mg"). If generic strip with no brand name, leave empty "".
   - "generic_salts": Array of active chemical ingredient / salt names visible on the strip (e.g. ["Aceclofenac", "Paracetamol", "Serratiopeptidase"]).
   - "strengths": Array of dosage strengths visible on the strip (e.g. ["100mg", "15mg", "325mg"]).
   - "raw_text": Complete transcription of ALL readable words, numbers, and tokens visible on the strip in natural reading order, separated by spaces.
   - "unreadable_reason": If the strip is completely illegible due to severe blur, specular glare blowout, or obstruction, describe why; otherwise leave empty "".

Return STRICTLY a JSON object matching this schema:
{
  "brand_name": "string",
  "generic_salts": ["string"],
  "strengths": ["string"],
  "raw_text": "string",
  "unreadable_reason": "string"
}
"""

_LAST_VLM_NETWORK_CHECK = 0.0
_VLM_NETWORK_ONLINE = True

def _is_network_online() -> bool:
    global _LAST_VLM_NETWORK_CHECK, _VLM_NETWORK_ONLINE
    now = time.time()
    if not _VLM_NETWORK_ONLINE and (now - _LAST_VLM_NETWORK_CHECK) < 10.0:
        return False
    _LAST_VLM_NETWORK_CHECK = now
    try:
        import socket
        s = socket.create_connection(("1.1.1.1", 53), timeout=0.3)
        s.close()
        _VLM_NETWORK_ONLINE = True
        return True
    except Exception:
        _VLM_NETWORK_ONLINE = False
        return False

def is_vlm_available() -> bool:
    """Checks whether google-genai is installed, GEMINI_API_KEY is configured, and network is online."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    return GENAI_AVAILABLE and bool(api_key) and _is_network_online()

def optimize_image_for_gemini(image_input: bytes | np.ndarray, max_dim: int = 1280, quality: int = 85) -> bytes:
    """
    Resizes image maintaining aspect ratio so max(width, height) <= max_dim,
    and encodes to JPEG with specified quality (default 85).
    Drastically reduces upload payload and latency while preserving full OCR legibility.
    """
    if isinstance(image_input, bytes):
        nparr = np.frombuffer(image_input, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return image_input
    else:
        img = image_input

    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    success, enc = cv2.imencode(".jpg", img, encode_params)
    if success:
        return enc.tobytes()
    return image_input if isinstance(image_input, bytes) else b""

def _call_gemini_api(images: list[bytes]) -> tuple[dict, str, float, float]:
    """Synchronous invocation of Google GenAI SDK with candidate model fallback and latency logging."""
    if not is_vlm_available():
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        raise RuntimeError(f"GEMINI_API_KEY not configured (key length: {len(api_key)}) or google-genai library missing (installed: {GENAI_AVAILABLE}).")

    client = genai.Client()

    # Pre-compress and resize all images to max 1280px at quality 85
    optimized_images = [optimize_image_for_gemini(img_bytes) for img_bytes in images]
    total_size_kb = sum(len(b) for b in optimized_images) / 1024.0
    print(f"[VLM PAYLOAD] {len(optimized_images)} frame(s) optimized to {total_size_kb:.1f} KB (max dim <= 1280px, quality 85)", flush=True)

    parts = [
        types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
        for img_bytes in optimized_images
    ]
    parts.append(TRANSCRIPTION_PROMPT)

    last_error = None
    for model_name in CANDIDATE_MODELS:
        # Determine appropriate thinking level based on model compatibility:
        # - gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-3.5-flash support MINIMAL (instant OCR)
        # - gemini-3.8-flash requires LOW (rejects MINIMAL with 400 error)
        primary_thinking = "LOW" if model_name == "gemini-3.8-flash" else "MINIMAL"

        configs_to_try = [
            (primary_thinking, types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
                max_output_tokens=512,
                thinking_config=types.ThinkingConfig(thinking_level=primary_thinking)
            )),
            ("OFF", types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
                max_output_tokens=512
            ))
        ]

        for thinking_label, config in configs_to_try:
            try:
                t0 = time.time()
                print(f"[VLM] Invoking model: {model_name} (thinking={thinking_label}, max_tokens=512, payload={total_size_kb:.1f}KB)...", flush=True)
                response = client.models.generate_content(
                    model=model_name,
                    contents=parts,
                    config=config
                )
                elapsed = time.time() - t0
                print(f"[VLM LATENCY] Model {model_name} responded in {elapsed:.2f}s! ({total_size_kb:.1f} KB payload)", flush=True)
                raw_content = response.text or "{}"
                parsed = json.loads(raw_content)
                return parsed, model_name, elapsed, total_size_kb
            except (ClientError, APIError) as e:
                err_str = str(e)
                last_error = e
                print(f"[VLM MODEL ERROR] Model '{model_name}' (thinking={thinking_label}) failed with {type(e).__name__}: {e}", flush=True)
                # Network or connection issues: abort immediately rather than trying more models
                if any(w in err_str.lower() for w in ("connect", "socket", "dns", "unreachable", "name resolution", "econnrefused")):
                    raise e
                # If thinking level is not supported by this specific model, try next config (e.g. OFF)
                if "thinking" in err_str.lower() or "thinking_level" in err_str.lower() or "400" in err_str:
                    continue
                # 404 indicates model deprecation/migration; try next model
                if "404" in err_str or "NOT_FOUND" in err_str:
                    break
                # 503 indicates temporary overload; try next model
                if "503" in err_str or "UNAVAILABLE" in err_str:
                    break
                raise e
            except Exception as e:
                err_str = str(e).lower()
                print(f"[VLM UNEXPECTED ERROR] Model '{model_name}' (thinking={thinking_label}) failed with {type(e).__name__}: {e}", flush=True)
                last_error = e
                if any(w in err_str for w in ("connect", "socket", "dns", "network", "unreachable", "getaddrinfo", "timeout")):
                    raise e
                break

    if last_error:
        raise last_error
    raise RuntimeError("All candidate Gemini Flash models failed.")

def transcribe_strip_vlm(
    images: bytes | list[bytes],
    timeout_seconds: float = 20.0
) -> dict | None:
    """
    Transcribes medicine strip(s) using Gemini Flash Vision with strict JSON output.
    Enforces a strict timeout (default 20.0s) and returns None on failure/timeout
    so the system automatically falls back to offline RapidOCR.
    """
    if not is_vlm_available():
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        print(f"[VLM NOTICE] Gemini API not available (key length: {len(api_key)}, genai_available: {GENAI_AVAILABLE}); using Offline RapidOCR.", flush=True)
        return None

    if isinstance(images, bytes):
        images_list = [images]
    else:
        images_list = list(images)

    if not images_list:
        return None

    print(f"[VLM] Calling Gemini Flash Vision with {len(images_list)} frame(s) (timeout: {timeout_seconds}s)...", flush=True)

    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_call_gemini_api, images_list)
    try:
        data, model_used, elapsed, payload_kb = future.result(timeout=timeout_seconds)
        executor.shutdown(wait=False, cancel_futures=True)
        brand = str(data.get("brand_name") or "").strip()
        salts = [str(s).strip() for s in data.get("generic_salts", []) if str(s).strip()]
        strengths = [str(st).strip() for st in data.get("strengths", []) if str(st).strip()]
        raw_text = str(data.get("raw_text") or "").strip()
        unreadable_reason = str(data.get("unreadable_reason") or "").strip()

        print(f"[VLM SUCCESS] Transcribed in {elapsed:.2f}s with {model_used}!")
        print(f"[VLM DATA] Brand: '{brand}' | Salts: {salts} | Strengths: {strengths}", flush=True)

        return {
            "engine": "Gemini Flash Vision",
            "model_used": model_used,
            "brand_name": brand,
            "generic_salts": salts,
            "strengths": strengths,
            "raw_text": raw_text,
            "unreadable_reason": unreadable_reason,
            "elapsed_seconds": round(elapsed, 2),
            "payload_kb": round(payload_kb, 1)
        }
    except FuturesTimeoutError:
        print(f"[VLM TIMEOUT ERROR] Gemini Flash Vision timed out after {timeout_seconds}s; falling back to Offline RapidOCR.", flush=True)
        executor.shutdown(wait=False, cancel_futures=True)
        return None
    except Exception as e:
        import traceback
        print(f"[VLM EXCEPTION] Gemini Flash Vision call failed ({type(e).__name__}: {e})\n{traceback.format_exc()}; falling back to Offline RapidOCR.", flush=True)
        executor.shutdown(wait=False, cancel_futures=True)
        return None
