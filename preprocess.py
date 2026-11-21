import cv2
import numpy as np

# Hard abort thresholds (for extreme unrecoverable corruption)
HARD_BLUR_ABORT_THRESHOLD = 25.0    # Severe motion blur (variance < 25)
HARD_GLARE_ABORT_THRESHOLD = 45.0   # Severe blown-out specular glare (> 45%)

# Soft warning thresholds (reported only if matching fails)
BLUR_WARNING_THRESHOLD = 80.0       # Laplacian variance below this may impact OCR
GLARE_WARNING_THRESHOLD = 15.0      # Specular glare percentage above this may impact OCR

GUIDANCE_MESSAGES = {
    "BLUR": {
        "en": "Camera shake detected. Please hold your hands steady and retake a clear photo.",
        "hi": "कैमरा हिल गया है। कृपया हाथ स्थिर रखकर दोबारा फ़ोटो लें।",
        "pa": "ਕੈਮਰਾ ਹਿੱਲ ਗਿਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਹੱਥ ਸਥਿਰ ਰੱਖ ਕੇ ਦੁਬਾਰਾ ਫ਼ੋਟੋ ਲਵੋ।"
    },
    "GLARE": {
        "en": "Foil glare detected. Please tilt the medicine strip slightly away from light.",
        "hi": "दवा की पन्नी पर तेज़ चमक आ रही है। कृपया पत्ती को थोड़ा तिरछा करें।",
        "pa": "ਦਵਾਈ ਦੀ ਪੱਤੀ 'ਤੇ ਤੇਜ਼ ਚਮਕ ਪੈ ਰਹੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਪੱਤੀ ਨੂੰ ਥੋੜ੍ਹਾ ਤਿਰਛਾ ਕਰੋ।"
    },
    "BOTH": {
        "en": "Photo is blurry and has glare. Please tilt the strip slightly and hold hands steady.",
        "hi": "फ़ोटो धुंधली है और चमक भी है। कृपया पत्ती को थोड़ा तिरछा करें और स्थिर रखें।",
        "pa": "ਫ਼ੋਟੋ ਧੁੰਦਲੀ ਹੈ ਅਤੇ ਚਮਕ ਵੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਪੱਤੀ ਨੂੰ ਥੋੜ੍ਹਾ ਤਿਰਛਾ ਕਰੋ ਅਤੇ ਸਥਿਰ ਰੱਖੋ।"
    }
}

def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Decodes raw image bytes into an OpenCV BGR numpy array."""
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image from provided bytes.")
    return image

def check_blur(gray: np.ndarray) -> tuple[float, bool]:
    """
    Computes Laplacian variance.
    Lower variance indicates low frequency content (blur / out of focus).
    Returns (variance, is_hard_abort).
    """
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    is_hard_abort = variance < HARD_BLUR_ABORT_THRESHOLD
    return variance, is_hard_abort

def check_glare(image: np.ndarray) -> tuple[float, bool]:
    """
    Calculates percentage of specular glare pixels on reflective blister/foil.
    Uses HSV space: Value (V) >= 252 and Saturation (S) <= 15 for blown-out hotspots.
    Bright white/silver printing without blown specular hotspots is preserved.
    Returns (glare_percentage, is_hard_abort).
    """
    if len(image.shape) == 3 and image.shape[2] == 3:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        _, s, v = cv2.split(hsv)
        glare_mask = (v >= 252) & (s <= 15)
    else:
        glare_mask = image >= 252

    total_pixels = glare_mask.size
    glare_pixels = int(np.count_nonzero(glare_mask))
    glare_percentage = float((glare_pixels / total_pixels) * 100.0)
    is_hard_abort = glare_percentage > HARD_GLARE_ABORT_THRESHOLD
    return glare_percentage, is_hard_abort

def extract_red_channel(image: np.ndarray) -> np.ndarray:
    """
    Extracts the Red channel from a BGR image (image[:, :, 2]).
    Dark or blue printed ink on metallic blister foil exhibits maximum contrast
    in the red channel because blue/silver foil reflects red less than blue/green.
    Returns a 2D grayscale uint8 array.
    """
    if len(image.shape) == 3 and image.shape[2] >= 3:
        return image[:, :, 2]
    return image

def enhance_foil_contrast(image: np.ndarray) -> np.ndarray:
    """
    Applies CLAHE (Contrast Limited Adaptive Histogram Equalization)
    and unsharp masking to enhance stamped/printed dot-matrix text on reflective foil.
    Accepts BGR or grayscale image.
    """
    if len(image.shape) == 3 and image.shape[2] == 3:
        # Convert to LAB color space to equalize Luminance without color distortion
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        merged_lab = cv2.merge((cl, a, b))
        enhanced_bgr = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
        enhanced_gray = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2GRAY)
    else:
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(image)
    
    # Unsharp masking to sharpen debossed / stamped text edges
    gaussian = cv2.GaussianBlur(enhanced_gray, (0, 0), sigmaX=2.0)
    sharpened = cv2.addWeighted(enhanced_gray, 1.5, gaussian, -0.5, 0)
    
    return sharpened

def process_foil_strip(image_input) -> dict:
    """
    Full preprocessing pipeline:
    1. Decode if bytes.
    2. Check blur & specular foil glare.
    3. Determine soft warning issues and hard abort status.
    4. Apply CLAHE contrast enhancement & sharpening.
    Returns both CLAHE-enhanced grayscale image and original BGR image.
    """
    if isinstance(image_input, bytes):
        image = decode_image_bytes(image_input)
    elif isinstance(image_input, np.ndarray):
        image = image_input
    else:
        raise TypeError("Expected image bytes or numpy.ndarray")

    # Resize if extremely large to maintain snappy performance while preserving resolution
    h, w = image.shape[:2]
    max_dim = 1600
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    blur_score, is_hard_blur = check_blur(gray)
    glare_pct, is_hard_glare = check_glare(image)

    # Soft warning status
    has_glare_warning = glare_pct > GLARE_WARNING_THRESHOLD
    has_blur_warning = blur_score < BLUR_WARNING_THRESHOLD

    issue = None
    if has_glare_warning and has_blur_warning:
        issue = "BOTH"
    elif has_glare_warning:
        issue = "GLARE"
    elif has_blur_warning:
        issue = "BLUR"

    guidance_en = GUIDANCE_MESSAGES[issue]["en"] if issue else ""
    guidance_hi = GUIDANCE_MESSAGES[issue]["hi"] if issue else ""
    guidance_pa = GUIDANCE_MESSAGES[issue]["pa"] if issue else ""

    # Generate CLAHE enhanced image for stamped / low contrast text
    enhanced_gray = enhance_foil_contrast(image)

    return {
        "quality_ok": not (has_glare_warning or has_blur_warning),
        "hard_abort": (is_hard_blur or is_hard_glare),
        "issue": issue,
        "blur_score": round(blur_score, 1),
        "glare_pct": round(glare_pct, 1),
        "guidance_en": guidance_en,
        "guidance_hi": guidance_hi,
        "guidance_pa": guidance_pa,
        "enhanced_image": enhanced_gray,
        "original_image": image,
        "original_shape": (h, w)
    }
