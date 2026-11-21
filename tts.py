import hashlib
import os
import io
import time
import base64
import struct
import math

CACHE_DIR = os.path.join(os.path.dirname(__file__), "audio_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

_LAST_NETWORK_CHECK = 0.0
_NETWORK_ONLINE = True

def _is_network_available() -> bool:
    """Fast network connectivity test with caching to avoid repeated blocking DNS timeouts when offline."""
    global _LAST_NETWORK_CHECK, _NETWORK_ONLINE
    now = time.time()
    if not _NETWORK_ONLINE and (now - _LAST_NETWORK_CHECK) < 10.0:
        return False
    _LAST_NETWORK_CHECK = now
    try:
        import socket
        # Use direct IP address to eliminate DNS resolution latency entirely
        s = socket.create_connection(("1.1.1.1", 53), timeout=0.3)
        s.close()
        _NETWORK_ONLINE = True
        return True
    except Exception:
        _NETWORK_ONLINE = False
        return False

def build_schedule_phrase(morning=True, afternoon=False, night=True, after_food=True, lang="hi") -> str:
    """Constructs localized schedule instructions in English, Hindi, or Punjabi."""
    times = []
    if lang == "en":
        if morning:
            times.append("morning")
        if afternoon:
            times.append("afternoon")
        if night:
            times.append("night")

        if len(times) == 3:
            time_str = "Take in the morning, afternoon, and night"
        elif len(times) == 2:
            time_str = f"Take in the {times[0]} and {times[1]}"
        elif len(times) == 1:
            time_str = f"Take in the {times[0]}"
        else:
            time_str = "Take as directed by your doctor"

        food_str = "after food within 15–20 minutes" if after_food else "before food on an empty stomach"
        return f"{time_str}, {food_str}."

    elif lang == "hi":
        if morning:
            times.append("सुबह")
        if afternoon:
            times.append("दोपहर")
        if night:
            times.append("रात")
        
        if len(times) == 3:
            time_str = "सुबह, दोपहर और रात को"
        elif len(times) == 2:
            time_str = f"{times[0]} और {times[1]} को"
        elif len(times) == 1:
            time_str = f"{times[0]} के समय"
        else:
            time_str = "डॉक्टर के बताए अनुसार"

        food_str = "खाना खाने के बाद लें" if after_food else "खाना खाने से पहले लें"
        return f"{time_str} {food_str}"
    
    else:  # Punjabi ("pa")
        if morning:
            times.append("ਸਵੇਰੇ")
        if afternoon:
            times.append("ਦੁਪਹਿਰੇ")
        if night:
            times.append("ਰਾਤ ਨੂੰ")

        if len(times) == 3:
            time_str = "ਸਵੇਰੇ, ਦੁਪਹਿਰੇ ਅਤੇ ਰਾਤ ਨੂੰ"
        elif len(times) == 2:
            time_str = f"{times[0]} ਅਤੇ {times[1]}"
        elif len(times) == 1:
            time_str = f"{times[0]}"
        else:
            time_str = "ਡਾਕਟਰ ਦੀ ਸਲਾਹ ਅਨੁਸਾਰ"

        food_str = "ਰੋਟੀ ਖਾਣ ਤੋਂ ਬਾਅਦ ਲਵੋ" if after_food else "ਰੋਟੀ ਖਾਣ ਤੋਂ ਪਹਿਲਾਂ ਲਵੋ"
        return f"{time_str} {food_str}"

def generate_speech_text(
    result: dict,
    lang: str = "hi",
    schedule: dict = None
) -> str:
    """
    Generates natural English, Hindi, or Punjabi speech text.
    NOTE: Medicine brand and generic names are NEVER translated.
    """
    if schedule is None:
        schedule = {"morning": True, "afternoon": False, "night": True, "after_food": True}

    status = result.get("status")

    if status == "VERIFIED":
        brand = result.get("brand_name", "")
        generic = result.get("generic_name", "")
        strength = result.get("strength", "")
        
        schedule_phrase = build_schedule_phrase(
            morning=schedule.get("morning", True),
            afternoon=schedule.get("afternoon", False),
            night=schedule.get("night", True),
            after_food=schedule.get("after_food", True),
            lang=lang
        )

        if lang == "en":
            if generic and strength:
                return f"This medicine is {brand}. It contains {generic} {strength}. {schedule_phrase}"
            elif strength:
                return f"This medicine is {brand} {strength}. {schedule_phrase}"
            else:
                return f"This medicine is {brand}. {schedule_phrase}"
        elif lang == "hi":
            if generic and strength:
                return f"यह दवा {brand} है। इसमें {generic} {strength} है। {schedule_phrase}।"
            elif strength:
                return f"यह दवा {brand} {strength} है। {schedule_phrase}।"
            else:
                return f"यह दवा {brand} है। {schedule_phrase}।"
        else:  # Punjabi
            if generic and strength:
                return f"ਇਹ ਦਵਾਈ {brand} ਹੈ। ਇਸ ਵਿੱਚ {generic} {strength} ਹੈ। {schedule_phrase}।"
            elif strength:
                return f"ਇਹ ਦਵਾਈ {brand} {strength} ਹੈ। {schedule_phrase}।"
            else:
                return f"ਇਹ ਦਵਾਈ {brand} ਹੈ। {schedule_phrase}।"

    # Handle NOT_SURE or quality issues
    gate_failed = result.get("gate_failed", "")
    issue = result.get("issue", "")

    if issue == "BLUR" or gate_failed == "BLUR":
        if lang == "en":
            return "Camera shake detected. Please hold your hands steady and retake a clear photo."
        elif lang == "hi":
            return "कैमरा हिल गया है। कृपया हाथ स्थिर रखकर दोबारा साफ़ फ़ोटो खींचें।"
        return "ਕੈਮਰਾ ਹਿੱਲ ਗਿਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਹੱਥ ਸਥਿਰ ਰੱਖ ਕੇ ਦੁਬਾਰਾ ਸਾਫ਼ ਫ਼ੋਟੋ ਖਿੱਚੋ।"

    if issue == "GLARE" or gate_failed == "GLARE":
        if lang == "en":
            return "Foil glare detected. Please tilt the strip slightly away from light to reduce reflection."
        elif lang == "hi":
            return "दवा की पन्नी पर तेज़ चमक आ रही है। कृपया पत्ती को थोड़ा तिरछा करके रोशनी से बचाएं।"
        return "ਦਵਾਈ ਦੀ ਪੱਤੀ 'ਤੇ ਤੇਜ਼ ਚਮਕ ਪੈ ਰਹੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਪੱਤੀ ਨੂੰ ਥੋੜ੍ਹਾ ਤਿਰਛਾ ਕਰਕੇ ਰੋਸ਼ਨੀ ਤੋਂ ਬਚਾਓ।"

    if gate_failed in ("GATE_3_STRENGTH_MISSING", "GATE_3_STRENGTH_MISMATCH"):
        if lang == "en":
            return "The medicine name is visible, but the dosage strength is unclear. For your safety, do not guess. Please check with your doctor or pharmacist."
        elif lang == "hi":
            return "दवा का नाम दिख रहा है लेकिन पावर साफ़ नहीं है। सुरक्षा के लिए कृपया डॉक्टर या दवाई वाले से पूछें।"
        return "ਦਵਾਈ ਦਾ ਨਾਮ ਦਿਸ ਰਿਹਾ ਹੈ ਪਰ ਪਾਵਰ ਸਾਫ਼ ਨਹੀਂ ਹੈ। ਸੁਰੱਖਿਆ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਡਾਕਟਰ ਜਾਂ ਦਵਾਈ ਵਾਲੇ ਤੋਂ ਪੁੱਛੋ।"

    if gate_failed == "GATE_2_AMBIGUITY":
        if lang == "en":
            return "Notice: this strip resembles multiple different medications. To prevent medication errors, do not guess and consult your doctor before taking it."
        elif lang == "hi":
            return "माफ़ कीजिए, यह दो अलग दवाओं जैसी लग रही है। बिना डॉक्टर की सलाह के इसे न लें।"
        return "ਮਾਫ਼ ਕਰਨਾ, ਇਹ ਦੋ ਵੱਖਰੀਆਂ ਦਵਾਈਆਂ ਵਰਗੀ ਲੱਗ ਰਹੀ ਹੈ। ਬਿਨਾਂ ਡਾਕਟਰ ਦੀ ਸਲਾਹ ਦੇ ਇਸਨੂੰ ਨਾ ਲਵੋ।"

    # General Not Sure fallback
    if lang == "en":
        return "Sorry, the medicine name or strength could not be verified with certainty. Please retake the photo in good lighting or consult your doctor or pharmacist."
    elif lang == "hi":
        return "माफ़ कीजिए, दवा का नाम या पावर साफ़ नहीं दिख रहा है। कृपया पत्ती को अच्छी रोशनी में रखकर दोबारा फ़ोटो लें या डॉक्टर से पूछें।"
    return "ਮਾਫ਼ ਕਰਨਾ, ਦਵਾਈ ਦਾ ਨਾਮ ਜਾਂ ਪਾਵਰ ਸਾਫ਼ ਨਹੀਂ ਦਿਸ ਰਹੀ। ਕਿਰਪਾ ਕਰਕੇ ਚੰਗੀ ਰੋਸ਼ਨੀ ਵਿੱਚ ਦੁਬਾਰਾ ਫ਼ੋਟੋ ਲਵੋ ਜਾਂ ਡਾਕਟਰ ਤੋਂ ਪਤਾ ਕਰੋ।"

def generate_reminder_text(brand_name: str, lang: str = "hi") -> str:
    """Spoken text for voice reminder alarms."""
    if lang == "en":
        return f"It is time to take your medication! Please take your {brand_name}."
    elif lang == "hi":
        return f"दवा लेने का समय हो गया है! कृपया अपनी {brand_name} दवा लें।"
    return f"ਦਵਾਈ ਲੈਣ ਦਾ ਸਮਾਂ ਹੋ ਗਿਆ ਹੈ! ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ {brand_name} ਦਵਾਈ ਲਵੋ।"

def _generate_fallback_audio() -> bytes:
    """Generates an in-memory pleasant acoustic chime WAV when offline."""
    sample_rate = 22050
    duration = 0.5  # seconds
    num_samples = int(sample_rate * duration)
    wav_io = io.BytesIO()

    # Simple WAV header + sine chime
    data_size = num_samples * 2
    wav_io.write(b'RIFF')
    wav_io.write(struct.pack('<I', 36 + data_size))
    wav_io.write(b'WAVEfmt ')
    wav_io.write(struct.pack('<IHHIIHH', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
    wav_io.write(b'data')
    wav_io.write(struct.pack('<I', data_size))

    for i in range(num_samples):
        t = float(i) / sample_rate
        # Two-tone chime 587Hz (D5) & 880Hz (A5) with decay envelope
        val = math.sin(2 * math.pi * 587.33 * t) * 0.4 + math.sin(2 * math.pi * 880.0 * t) * 0.3
        envelope = math.exp(-t * 5.0)
        sample = int(val * envelope * 32767.0)
        sample = max(-32768, min(32767, sample))
        wav_io.write(struct.pack('<h', sample))

    return wav_io.getvalue()

def synthesize_speech(text: str, lang: str = "hi") -> bytes:
    """
    Synthesizes speech using gTTS with caching.
    Supports English ('en'), Hindi ('hi'), and Punjabi ('pa').
    Gracefully falls back to offline acoustic chime when network is unreachable.
    """
    gtts_lang = "en" if lang == "en" else ("hi" if lang == "hi" else "pa")
    cache_key = hashlib.md5(f"{gtts_lang}:{text}".encode("utf-8")).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.mp3")

    if os.path.exists(cache_file):
        with open(cache_file, "rb") as f:
            return f.read()

    # Fast check: is network reachable? If offline, instantly fall back without blocking
    if not _is_network_available():
        return _generate_fallback_audio()

    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang=gtts_lang, slow=False)
        tts.save(cache_file)
        with open(cache_file, "rb") as f:
            return f.read()
    except Exception:
        # Fallback to acoustic tone so audio never breaks when offline or in sandbox
        return _generate_fallback_audio()

def synthesize_speech_base64(text: str, lang: str = "hi") -> str:
    """Returns data audio URI for immediate HTML5 browser playback."""
    audio_bytes = synthesize_speech(text, lang)
    if not audio_bytes:
        return ""
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    mime = "audio/wav" if audio_bytes.startswith(b'RIFF') else "audio/mp3"
    return f"data:{mime};base64,{b64}"
