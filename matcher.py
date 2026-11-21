import os
import re
import sqlite3
import cv2
import numpy as np
from rapidfuzz import fuzz
try:
    import preprocess
except ImportError:
    try:
        from . import preprocess
    except ImportError:
        import backend.preprocess as preprocess

# Initialize RapidOCR engine (ONNX Runtime, PP-OCRv4)
try:
    from rapidocr_onnxruntime import RapidOCR
    RAPIDOCR_ENGINE = RapidOCR()
    RAPIDOCR_AVAILABLE = True
    print("[MATCHER] RapidOCR (ONNX Runtime) initialized successfully.")
except Exception as e:
    RAPIDOCR_ENGINE = None
    RAPIDOCR_AVAILABLE = False
    print(f"[MATCHER] RapidOCR initialization notice: {e}")

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

DB_PATH = os.path.join(os.path.dirname(__file__), "medicines.db")

COMMON_STOPWORDS = {
    "tablet", "tablets", "capsule", "capsules", "syrup", "suspension",
    "injection", "strip", "coated", "film", "oral", "dose", "for", "with",
    "and", "the", "ip", "bp", "usp", "mfg", "lic", "exp", "batch", "lot"
}

def clean_ocr_text(text: str) -> str:
    """Removes non-ASCII artifacts, excessive symbols, splits concatenated dosage/pharmacopeia words and standardizes whitespace."""
    if not text:
        return ""
    text = re.sub(r'[\r\n\t]+', ' ', text)
    # Split digit-letter and letter-digit boundaries (e.g. DOLO650 -> DOLO 650, 500mg -> 500 mg)
    text = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', text)
    text = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', text)
    # Split common pharmacopeia and dosage form words when concatenated by OCR
    text = re.sub(r'(?i)(tablets|tablet|capsules|capsule|syrup|injection|suspension|ip\b|bp\b|usp\b)', r' \1 ', text)
    # Retain alphanumeric characters, hyphens, slashes, and periods
    text = re.sub(r'[^a-zA-Z0-9\s\.\/\-\+]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_ocr_text(clahe_image: np.ndarray, original_image: np.ndarray = None) -> str:
    """
    Extracts text using RapidOCR (PP-OCRv4 on ONNX Runtime) with multi-angle and foil-ink passes:
    1. Tests 3 orientations: 0° (original), 90° CCW, and 90° CW.
    2. Identifies the orientation that yields the highest total OCR confidence / word count.
    3. Runs on the best orientation:
       - Best orientation original frame
       - CLAHE-enhanced contrast frame of the best orientation
       - Red-channel boosted pass (image[:, :, 2] where blue/dark ink on silver foil has max contrast)
    4. Combines and deduplicates all detected text lines.
    """
    lines = []
    seen = set()

    base_img = original_image if original_image is not None else clahe_image
    if base_img is None:
        return ""

    if not RAPIDOCR_AVAILABLE or RAPIDOCR_ENGINE is None:
        # Fallback to Tesseract if RapidOCR not available
        if TESSERACT_AVAILABLE and clahe_image is not None:
            try:
                t_text = pytesseract.image_to_string(clahe_image, config='--oem 3 --psm 6')
                return clean_ocr_text(t_text)
            except Exception as e:
                print(f"[TESSERACT ERROR]: {e}")
        return ""

    def run_rapidocr(img):
        if img is None:
            return []
        try:
            results, _ = RAPIDOCR_ENGINE(img)
            return results or []
        except Exception as e:
            print(f"[RAPIDOCR ERROR]: {e}")
            return []

    # 1. Test 0deg orientation first
    res_0 = run_rapidocr(base_img)
    score_0 = 0.0
    for item in res_0:
        text = (item[1] or "").strip()
        conf = float(item[2])
        if len(text) >= 3 and conf >= 0.35:
            score_0 += conf * len(text)

    best_angle_label = "0deg"
    best_img = base_img
    best_results = res_0
    best_score = score_0

    # If 0deg orientation produced low confidence text (< 12.0), test 90° CCW and 90° CW
    if score_0 < 12.0:
        other_orientations = [
            ("90deg_ccw", cv2.rotate(base_img, cv2.ROTATE_90_COUNTERCLOCKWISE)),
            ("90deg_cw", cv2.rotate(base_img, cv2.ROTATE_90_CLOCKWISE))
        ]
        for label, rot_img in other_orientations:
            res = run_rapidocr(rot_img)
            score = 0.0
            for item in res:
                text = (item[1] or "").strip()
                conf = float(item[2])
                if len(text) >= 3 and conf >= 0.35:
                    score += conf * len(text)
            if score > best_score:
                best_score = score
                best_angle_label = label
                best_img = rot_img
                best_results = res

    # 2. Add text lines from best orientation's initial frame
    for item in best_results:
        cleaned = clean_ocr_text(item[1])
        norm = cleaned.lower().strip()
        if norm and norm not in seen:
            seen.add(norm)
            lines.append(cleaned)

    # 3. CLAHE-enhanced pass on the best orientation
    clahe_best = preprocess.enhance_foil_contrast(best_img)
    clahe_results = run_rapidocr(clahe_best)
    for item in clahe_results:
        cleaned = clean_ocr_text(item[1])
        norm = cleaned.lower().strip()
        if norm and norm not in seen:
            seen.add(norm)
            lines.append(cleaned)

    # 4. Red-channel boosted pass on the best orientation (runs when contrast is challenging)
    # Blue/dark ink on metallic blister foil exhibits highest contrast in the red channel
    if (best_score < 15.0 or len(lines) < 2) and len(best_img.shape) == 3 and best_img.shape[2] >= 3:
        red_channel = preprocess.extract_red_channel(best_img)
        clahe_red = preprocess.enhance_foil_contrast(red_channel)
        red_results = run_rapidocr(clahe_red)
        for item in red_results:
            cleaned = clean_ocr_text(item[1])
            norm = cleaned.lower().strip()
            if norm and norm not in seen:
                seen.add(norm)
                lines.append(cleaned)

    # 5. Fallback to Tesseract only if RapidOCR produced no lines
    if not lines and TESSERACT_AVAILABLE and clahe_image is not None:
        try:
            t_text = pytesseract.image_to_string(clahe_image, config='--oem 3 --psm 6')
            c_text = clean_ocr_text(t_text)
            if c_text:
                lines.append(c_text)
        except Exception as e:
            print(f"[TESSERACT FALLBACK ERROR]: {e}")

    combined = " ".join(lines).strip()
    print(f"\n================ [RAW OCR EXTRACTED TEXT] ================")
    print(f"Selected Orientation: {best_angle_label} (score: {best_score:.1f})")
    print(combined if combined else "(No readable text detected)")
    print(f"==========================================================\n")
    return combined

def pool_ocr_texts(texts: list[str]) -> str:
    """
    Pools and deduplicates extracted text lines and tokens across multiple burst frames.
    Preserves word boundaries and eliminates duplicate words and redundant phrases.
    """
    if not texts:
        return ""

    pooled_lines = []
    seen = set()

    for text in texts:
        if not text:
            continue
        # Split text into lines or clauses
        parts = re.split(r'[\r\n]+', text)
        for part in parts:
            cleaned = clean_ocr_text(part)
            norm = cleaned.lower().strip()
            if norm and norm not in seen:
                seen.add(norm)
                pooled_lines.append(cleaned)

    combined = " ".join(pooled_lines).strip()
    return combined

def extract_strengths_from_text(text: str) -> list[dict]:
    """
    Extracts all dosage strengths (e.g., 500mg, 625 mg, 5ml, 250 mcg) from text.
    Returns list of dicts: [{'raw': '500mg', 'val': 500.0, 'unit': 'mg'}].
    """
    if not text:
        return []
    pattern = r'(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|gm)\b'
    matches = re.findall(pattern, text, re.IGNORECASE)
    strengths = []
    for num, unit in matches:
        try:
            val = float(num)
            strengths.append({
                "raw": f"{num}{unit.lower()}",
                "val": val,
                "unit": unit.lower()
            })
        except ValueError:
            continue
    return strengths

def query_candidates(tokens: list[str], db_path: str = DB_PATH, limit: int = 50) -> list[dict]:
    """
    Queries SQLite using:
    1. Direct generic_name_normalized match (critical for generic strips like 'Paracetamol 500mg').
    2. FTS5 index on (brand_name, generic_name, strength).
    3. Indexed LIKE query on brand_name_normalized.
    """
    if not os.path.exists(db_path):
        return []

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    candidates = {}

    # Filter tokens: discard purely numeric tokens and common packaging stopwords
    search_tokens = [
        t.lower() for t in tokens 
        if len(t) >= 3 and not t.isdigit() and t.lower() not in COMMON_STOPWORDS
    ]
    if not search_tokens:
        search_tokens = [t.lower() for t in tokens if len(t) >= 3 and not t.isdigit()]

    for token in search_tokens[:6]:
        # 1. Direct query on generic_name_normalized
        try:
            cur.execute("""
                SELECT id, brand_name, generic_name, strength, strength_clean, manufacturer, price
                FROM medicines
                WHERE generic_name_normalized = ?
                LIMIT ?
            """, (token, limit))
            for row in cur.fetchall():
                candidates[row[0]] = {
                    "id": row[0],
                    "brand_name": row[1],
                    "generic_name": row[2],
                    "strength": row[3],
                    "strength_clean": row[4],
                    "manufacturer": row[5],
                    "price": row[6]
                }
        except Exception:
            pass

        # 2. Full-text search query on FTS5
        fts_query = f"{token}*"
        try:
            cur.execute("""
                SELECT m.id, m.brand_name, m.generic_name, m.strength, m.strength_clean, m.manufacturer, m.price
                FROM medicines_fts f
                JOIN medicines m ON f.rowid = m.id
                WHERE medicines_fts MATCH ?
                LIMIT ?
            """, (fts_query, limit))
            for row in cur.fetchall():
                candidates[row[0]] = {
                    "id": row[0],
                    "brand_name": row[1],
                    "generic_name": row[2],
                    "strength": row[3],
                    "strength_clean": row[4],
                    "manufacturer": row[5],
                    "price": row[6]
                }
        except Exception:
            # 3. Fallback to indexed LIKE query
            cur.execute("""
                SELECT id, brand_name, generic_name, strength, strength_clean, manufacturer, price
                FROM medicines
                WHERE brand_name_normalized LIKE ?
                LIMIT ?
            """, (f"%{token}%", limit))
            for row in cur.fetchall():
                candidates[row[0]] = {
                    "id": row[0],
                    "brand_name": row[1],
                    "generic_name": row[2],
                    "strength": row[3],
                    "strength_clean": row[4],
                    "manufacturer": row[5],
                    "price": row[6]
                }

    conn.close()
    return list(candidates.values())

def normalize_composition(cand: dict) -> tuple[str, str]:
    """Normalizes generic salt name and strength for equivalence check."""
    gen = (cand.get("generic_name") or "").strip().lower()
    gen_norm = re.sub(r'[^a-z0-9]', '', gen)
    st = (cand.get("strength_clean") or cand.get("strength") or "").strip().lower()
    st_norm = re.sub(r'[^a-z0-9]', '', st)
    return gen_norm, st_norm

UNIQUE_SALTS = None

def load_unique_salts(db_path: str = DB_PATH) -> list[str]:
    """
    Loads and caches single-ingredient generic salts from medicines.db.
    Excludes multi-ingredient combinations (containing '+' or '/').
    """
    global UNIQUE_SALTS
    if UNIQUE_SALTS is not None:
        return UNIQUE_SALTS

    if not os.path.exists(db_path):
        return []

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT DISTINCT generic_name
            FROM medicines
            WHERE generic_name IS NOT NULL
              AND generic_name NOT LIKE '%+%'
              AND generic_name NOT LIKE '%/%'
              AND length(generic_name) >= 3
            ORDER BY length(generic_name) DESC
        """)
        UNIQUE_SALTS = [r[0] for r in cur.fetchall()]
    except Exception as e:
        print(f"[MATCHER] Warning loading unique salts: {e}")
        UNIQUE_SALTS = []
    finally:
        conn.close()

    return UNIQUE_SALTS

def try_torn_salt_recovery(ocr_text: str, ocr_strengths: list[dict], db_path: str = DB_PATH, vlm_data: dict = None) -> dict | None:
    """
    Torn-word and generic salt recovery:
    Extracts tokens of length >= 5 and adjacent joined n-grams (e.g. 'cetamol' -> 'Paracetamol').
    Matches against unique single-ingredient generic salts.

    Enforces 3 strict safety gates:
    - Gate 1: Match score >= 80%.
    - Gate 2: Gap between top 2 distinct salts >= 10%. If ambiguous, returns NOT_SURE (GATE_2_AMBIGUITY).
    - Gate 3: Detected strength must match a valid strength record for that salt in medicines.db.
    """
    if not ocr_text or len(ocr_text.strip()) < 3:
        return None

    salts = load_unique_salts(db_path)
    if not salts:
        return None

    words = re.findall(r'[a-zA-Z]+', ocr_text)
    if vlm_data:
        for s in vlm_data.get("generic_salts", []):
            words.extend(re.findall(r'[a-zA-Z]+', s))
        if vlm_data.get("brand_name"):
            words.extend(re.findall(r'[a-zA-Z]+', vlm_data["brand_name"]))

    cand_tokens = set()

    for w in words:
        if len(w) >= 5 and w.lower() not in COMMON_STOPWORDS:
            cand_tokens.add(w.lower())

    for i in range(len(words) - 1):
        w1, w2 = words[i].lower(), words[i+1].lower()
        if w1 not in COMMON_STOPWORDS or w2 not in COMMON_STOPWORDS:
            j2 = w1 + w2
            if len(j2) >= 5:
                cand_tokens.add(j2)

    for i in range(len(words) - 2):
        j3 = (words[i] + words[i+1] + words[i+2]).lower()
        if len(j3) >= 5:
            cand_tokens.add(j3)

    if not cand_tokens:
        return None

    best_match_per_salt = {}
    for token in cand_tokens:
        for salt in salts:
            s_lower = salt.lower()
            if token in s_lower:
                score = 100.0
            else:
                pr = fuzz.partial_ratio(token, s_lower)
                score = float(pr) if pr >= 85.0 else 0.0

            if score >= 80.0:
                if salt not in best_match_per_salt or score > best_match_per_salt[salt]:
                    best_match_per_salt[salt] = score

    if not best_match_per_salt:
        return None

    ranked = sorted(best_match_per_salt.items(), key=lambda x: x[1], reverse=True)
    top_salt, top_score = ranked[0]

    # Gate 1: Top match confidence >= 80%
    if top_score < 80.0:
        return {
            "status": "NOT_SURE",
            "gate_failed": "GATE_1_LOW_CONFIDENCE",
            "reason": f"Top candidate generic salt '{top_salt}' confidence is {top_score:.1f}%, below the safe 80% threshold.",
            "top_candidate": top_salt,
            "confidence": top_score,
            "detected_strengths": [s["raw"] for s in ocr_strengths],
            "ocr_text": ocr_text
        }

    # Gate 2: Ambiguity Gap Check (< 10%)
    if len(ranked) > 1:
        second_salt, second_score = ranked[1]
        gap = top_score - second_score
        if gap < 10.0:
            return {
                "status": "NOT_SURE",
                "gate_failed": "GATE_2_AMBIGUITY",
                "reason": (
                    f"Ambiguous torn fragment: matches multiple distinct generic medicines '{top_salt}' ({top_score:.1f}%) "
                    f"and '{second_salt}' ({second_score:.1f}%) within 10% similarity margin."
                ),
                "confidence": round(top_score, 1),
                "score_gap": round(gap, 1),
                "top_candidates": [top_salt, second_salt],
                "detected_strengths": [s["raw"] for s in ocr_strengths],
                "ocr_text": ocr_text
            }

    # Gate 3: Strength Verification
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT strength, strength_clean FROM medicines WHERE generic_name = ?", (top_salt,))
    rows = cur.fetchall()

    db_strength_vals = set()
    for s_raw, s_clean in rows:
        for s in extract_strengths_from_text(f"{s_raw} {s_clean}"):
            db_strength_vals.add(s["val"])

    ocr_strength_vals = {s["val"] for s in ocr_strengths}

    if not ocr_strength_vals:
        conn.close()
        return {
            "status": "NOT_SURE",
            "gate_failed": "GATE_3_STRENGTH_MISSING",
            "reason": (
                f"Medicine appears to be '{top_salt}', "
                "but dosage strength (mg/ml) was not clearly readable on the strip."
            ),
            "confidence": round(top_score, 1),
            "expected_strength": f"Known strengths for {top_salt}",
            "detected_strengths": [],
            "ocr_text": ocr_text
        }

    if db_strength_vals and not (db_strength_vals & ocr_strength_vals):
        conn.close()
        valid_examples = [r[0] for r in rows if r[0]][:5]
        return {
            "status": "NOT_SURE",
            "gate_failed": "GATE_3_STRENGTH_MISMATCH",
            "reason": (
                f"Strength mismatch for '{top_salt}': strip shows {[s['raw'] for s in ocr_strengths]}, "
                f"which does not match known strengths ({', '.join(valid_examples) if valid_examples else 'standard'})."
            ),
            "confidence": round(top_score, 1),
            "expected_strength": ", ".join(valid_examples),
            "detected_strengths": [s["raw"] for s in ocr_strengths],
            "ocr_text": ocr_text
        }

    # Fetch sample manufacturer & price
    cur.execute("""
        SELECT manufacturer, price 
        FROM medicines 
        WHERE generic_name = ? AND manufacturer IS NOT NULL AND manufacturer != ''
        LIMIT 1
    """, (top_salt,))
    mfg_row = cur.fetchone()
    conn.close()

    mfg = mfg_row[0] if mfg_row else "Generic Medicine"
    price = mfg_row[1] if mfg_row else 0.0
    matched_strength = ocr_strengths[0]["raw"] if ocr_strengths else ""

    brand_disp = f"{top_salt} {matched_strength}".strip()
    if vlm_data and vlm_data.get("brand_name") and vlm_data["brand_name"].lower() != top_salt.lower():
        brand_disp = f"{vlm_data['brand_name']} ({top_salt} {matched_strength})".strip()

    return {
        "status": "VERIFIED",
        "brand_name": brand_disp,
        "generic_name": top_salt,
        "strength": matched_strength,
        "manufacturer": mfg,
        "price": price,
        "confidence": round(top_score, 1),
        "match_type": "GENERIC_SALT_RECOVERY",
        "detected_strengths": [s["raw"] for s in ocr_strengths],
        "ocr_text": ocr_text
    }

CLINICAL_VARIANTS = {
    "sp", "mr", "p", "pg", "th", "d", "dsr", "cv", "duo", "plus", "forte",
    "sr", "er", "cr", "dt", "md", "od", "ds", "xl", "xt", "af", "az", "ap",
    "oz", "tz", "dx", "ls", "ax", "tc", "cc", "dm", "cz", "lc", "am", "at",
    "h", "ch", "ct", "tm", "mt", "nt", "pt", "s", "gel", "spas"
}

def evaluate_brand_and_variant(brand_name: str, clean_ocr_norm: str) -> tuple[float, bool]:
    """
    Evaluates brand name and variant suffix match:
    - Exact brand + variant (e.g., Zerodol-SP / zerodol sp in OCR): +20.0 boost, brand_ok=True.
    - Contradicted variant (e.g., Zerodol-P or Zerodol-MR when OCR has Zerodol-SP): -40.0 penalty, brand_ok=False.
    - Missing variant (e.g. plain Zerodol when OCR has Zerodol-SP): -35.0 penalty, brand_ok=False.
    - Brand with no variant on strip with no variant: +10.0 boost, brand_ok=True.
    """
    b_norm = re.sub(r'[^a-zA-Z0-9\s]', ' ', brand_name).lower().strip()
    b_norm = re.sub(r'\s+', ' ', b_norm)
    b_tokens = b_norm.split()
    if not b_tokens:
        return 0.0, False

    base_brand = b_tokens[0]
    base_in_ocr = bool(re.search(r'\b' + re.escape(base_brand) + r'\b', clean_ocr_norm))
    if not base_in_ocr:
        return -35.0, False

    # Check if OCR text has any clinical variant suffix attached to or following base_brand
    variant_in_ocr = None
    for cv in sorted(CLINICAL_VARIANTS, key=len, reverse=True):
        if re.search(r'\b' + re.escape(base_brand) + r'[\s\-_]+' + re.escape(cv) + r'\b', clean_ocr_norm):
            variant_in_ocr = cv
            break
        elif re.search(r'\b' + re.escape(base_brand) + r'\b[\w\s]{0,20}\b' + re.escape(cv) + r'\b', clean_ocr_norm):
            variant_in_ocr = cv
            break

    if len(b_tokens) >= 2:
        cand_var_tokens = b_tokens[1:]
        # Check exact full phrase in OCR (e.g. "zerodol sp" or "augmentin 625 duo")
        if re.search(r'\b' + re.escape(b_norm) + r'\b', clean_ocr_norm):
            return 20.0, True

        # Check if all variant tokens appear in OCR text (e.g. "Allegra ... 180mg" or "Augmentin ... 625 ... Duo")
        all_in_ocr = all(re.search(r'\b' + re.escape(vt) + r'\b', clean_ocr_norm) for vt in cand_var_tokens)
        if all_in_ocr:
            return 15.0, True

        # Contradicted variant suffix (e.g. Augmentin 1000 Duo when OCR has 625 Duo, or Zerodol-P when OCR has SP)
        return -40.0, False
    else:
        # Candidate is plain brand with no variant suffix (e.g. 'Zerodol')
        if variant_in_ocr:
            # OCR explicitly contains a clinical variant suffix that this candidate lacks
            return -35.0, False
        return 10.0, True

def check_salt_in_ocr(salt: str, clean_ocr_norm: str) -> bool:
    """Checks whether an active salt appears in OCR text or matches fuzzy/stem >= 80%."""
    salt_clean = re.sub(r'[^a-zA-Z0-9\s]', '', salt).lower().strip()
    if not salt_clean:
        return False
    if salt_clean in clean_ocr_norm:
        return True
    if fuzz.partial_ratio(salt_clean, clean_ocr_norm) >= 80.0:
        return True
    for word in salt_clean.split():
        if len(word) >= 5:
            if word in clean_ocr_norm:
                return True
            if fuzz.partial_ratio(word, clean_ocr_norm) >= 78.0:
                return True
            if any(fuzz.ratio(word, tok) >= 75.0 for tok in clean_ocr_norm.split() if len(tok) >= 5):
                return True
            if len(word) >= 6 and any(tok.startswith(word[:6]) for tok in clean_ocr_norm.split() if len(tok) >= 6):
                return True
    return False

def evaluate_salt_overlap(generic_name: str, clean_ocr_norm: str, strip_salts: set[str] = None) -> tuple[float, list[str], list[str]]:
    """
    Evaluates active salt overlap:
    - Boosts candidates whose active salts appear on strip (+15.0 for multi-salt, +8.0 for single).
    - Heavily penalizes candidates with active salts absent from strip (-25.0 per missing salt).
    - Heavily penalizes single-salt candidates when the strip physically contains multiple active salts (-25.0).
    """
    if not generic_name:
        return 0.0, [], []

    raw_salts = [s.strip() for s in re.split(r'[\+\/,]', generic_name) if s.strip()]
    matched = []
    missing_from_strip = []

    for salt in raw_salts:
        if check_salt_in_ocr(salt, clean_ocr_norm):
            matched.append(salt)
        else:
            missing_from_strip.append(salt)

    penalty = len(missing_from_strip) * 25.0

    # If strip physically contains multiple active salts (e.g. Paracetamol + Aceclofenac),
    # penalize a single-salt candidate (e.g. plain Aceclofenac) that is missing combination salts
    if strip_salts and len(strip_salts) >= 2 and len(raw_salts) == 1:
        cand_salts_lower = [s.lower() for s in raw_salts]
        missing_strip_salts = [st for st in strip_salts if not any(st in cs or cs in st for cs in cand_salts_lower)]
        if missing_strip_salts:
            penalty += 25.0

    if len(missing_from_strip) == 0 and len(matched) > 0:
        boost = 15.0 if len(matched) >= 2 else 8.0
    else:
        boost = len(matched) * 3.0

    return (boost - penalty), matched, missing_from_strip

def evaluate_strength_overlap(cand: dict, ocr_strengths: list[dict]) -> float:
    """
    Matches extracted strengths against candidate strengths:
    - Multi-strength exact match (+15.0).
    - Single-strength exact match (+8.0).
    - Mismatched / contradicted strength (-25.0 per contradicted strength).
    - Heavily penalizes single-strength candidates when strip physically contains multiple active strengths (-25.0).
    """
    ocr_vals = {s["val"] for s in ocr_strengths}
    cand_strengths = extract_strengths_from_text(f"{cand['brand_name']} {cand['strength']} {cand['strength_clean']}")
    cand_vals = {s["val"] for s in cand_strengths}

    if not ocr_vals or not cand_vals:
        return 0.0

    matched_vals = cand_vals & ocr_vals
    contradicted_vals = cand_vals - ocr_vals

    if contradicted_vals:
        return -25.0 * len(contradicted_vals)
    elif len(ocr_vals) >= 2 and len(cand_vals) == 1 and (ocr_vals - cand_vals):
        # Strip has multiple active strengths (e.g. 100mg + 325mg), but candidate is only single-strength
        return -25.0
    elif cand_vals.issubset(ocr_vals):
        return 15.0 if len(matched_vals) >= 2 else 8.0
    return 0.0

def check_brand_word_presence(brand_name: str, clean_ocr_norm: str) -> bool:
    """
    Checks that distinguishing brand tokens (especially short prefixes like 'B' in 'B Cillin')
    are actually present in the OCR text, rather than falsely matching a generic suffix like 'cillin'.
    """
    b_clean = re.sub(r'\b\d+(?:mg|ml|mcg|g|iu|gm)?\b', '', brand_name, flags=re.I)
    b_words = [w.lower() for w in re.findall(r'[a-zA-Z]+', b_clean) if len(w) >= 1 and w.lower() not in COMMON_STOPWORDS]
    if not b_words:
        return True
    ocr_words = set(re.findall(r'[a-zA-Z]+', clean_ocr_norm.lower()))

    # If the brand has a single-letter or 2-letter prefix (like 'B' in 'B Cillin', 'T' in 'T Cillin'),
    # that distinguishing prefix MUST be in the OCR text
    for bw in b_words:
        if len(bw) <= 2 and bw not in ocr_words:
            return False

    # At least 60% of brand words must be present in OCR text
    present = sum(1 for bw in b_words if bw in ocr_words or any(bw in ow for ow in ocr_words if len(bw) >= 4))
    return (present / len(b_words)) >= 0.6

def safe_match(ocr_text: str, db_path: str = DB_PATH, vlm_data: dict = None) -> dict:
    """
    Performs safe medicine matching strictly enforcing 3 hard safety gates.
    Never hallucinates or guesses.

    Safety Gate 1: Top match confidence must be >= 80%.
    Safety Gate 2: Gap between top matches must be >= 10% if they have DIFFERENT active salt or DIFFERENT strength.
                   If top candidates are different brands of the EXACT SAME salt and strength (e.g. Paracetamol 500mg),
                   it is treated as a safe valid match.
    Safety Gate 3: Strength (mg/ml/mcg) on strip must match candidate strength.
    """
    # If VLM transcription data is provided and ocr_text is empty, construct it from VLM fields
    if vlm_data and (not ocr_text or len(ocr_text.strip()) < 3):
        vlm_tokens = []
        if vlm_data.get("brand_name"):
            vlm_tokens.append(vlm_data["brand_name"])
        if vlm_data.get("generic_salts"):
            vlm_tokens.extend(vlm_data["generic_salts"])
        if vlm_data.get("strengths"):
            vlm_tokens.extend(vlm_data["strengths"])
        if vlm_data.get("raw_text"):
            vlm_tokens.append(vlm_data["raw_text"])
        ocr_text = " ".join(vlm_tokens).strip()

    print(f"[MATCHER] Evaluating text: {ocr_text.strip()[:100] if ocr_text else '(empty)'}")

    if not ocr_text or len(ocr_text.strip()) < 3:
        return {
            "status": "NOT_SURE",
            "gate_failed": "NO_TEXT_EXTRACTED",
            "reason": "No readable text was detected on the strip.",
            "ocr_text": ocr_text,
            "confidence": 0.0
        }

    # Extract tokens for DB query
    words = re.findall(r'[a-zA-Z0-9]+', ocr_text)
    if vlm_data:
        if vlm_data.get("brand_name"):
            words.extend(re.findall(r'[a-zA-Z0-9]+', vlm_data["brand_name"]))
        for salt in vlm_data.get("generic_salts", []):
            words.extend(re.findall(r'[a-zA-Z0-9]+', salt))

    candidates = query_candidates(words, db_path)
    ocr_strengths = extract_strengths_from_text(ocr_text)
    if vlm_data and vlm_data.get("strengths"):
        for st in vlm_data["strengths"]:
            for extracted in extract_strengths_from_text(st):
                if not any(s["val"] == extracted["val"] for s in ocr_strengths):
                    ocr_strengths.append(extracted)
    ocr_strength_vals = {s["val"] for s in ocr_strengths}

    if not candidates:
        torn_res = try_torn_salt_recovery(ocr_text, ocr_strengths, db_path, vlm_data=vlm_data)
        if torn_res is not None:
            return torn_res
        return {
            "status": "NOT_SURE",
            "gate_failed": "NO_CANDIDATE_MATCH",
            "reason": "No matching medicine was found in the Indian medicines database.",
            "ocr_text": ocr_text,
            "detected_strengths": [s["raw"] for s in ocr_strengths],
            "confidence": 0.0
        }

    # Combined Multi-Signal Scoring BEFORE Gate 1 & Gate 2
    scored = []
    clean_ocr_norm = re.sub(r'[^a-zA-Z0-9\s]', ' ', ocr_text).lower()
    clean_ocr_norm = re.sub(r'\s+', ' ', clean_ocr_norm).strip()

    # Identify active generic salts that physically appear on the strip
    strip_salts = set()
    if vlm_data and vlm_data.get("generic_salts"):
        for s in vlm_data["generic_salts"]:
            if s and len(s.strip()) >= 3:
                strip_salts.add(s.strip().lower())

    for c in candidates:
        g = c.get("generic_name") or ""
        for raw_s in re.split(r'[\+\/,]', g):
            s_clean = raw_s.strip().lower()
            if len(s_clean) >= 4 and s_clean not in COMMON_STOPWORDS:
                if re.search(r'\b' + re.escape(s_clean) + r'\b', clean_ocr_norm):
                    strip_salts.add(s_clean)

    for cand in candidates:
        brand = re.sub(r'[^a-zA-Z0-9\s]', ' ', cand["brand_name"]).lower().strip()
        brand = re.sub(r'\s+', ' ', brand)
        generic = re.sub(r'[^a-zA-Z0-9\s]', ' ', cand.get("generic_name") or "").lower().strip()
        generic = re.sub(r'\s+', ' ', generic)

        # 1. Base fuzzy similarity
        score_brand = float(fuzz.token_set_ratio(brand, clean_ocr_norm))
        score_generic = float(fuzz.token_set_ratio(generic, clean_ocr_norm)) if generic else 0.0

        is_brand_match = (score_brand >= 75.0) and check_brand_word_presence(cand["brand_name"], clean_ocr_norm)
        base_score = score_brand if is_brand_match else score_generic

        # 2. Multi-Signal Evidence:
        variant_adj, brand_ok = evaluate_brand_and_variant(cand["brand_name"], clean_ocr_norm)
        salt_adj, matched_salts, missing_salts = evaluate_salt_overlap(
            cand.get("generic_name") or "", 
            clean_ocr_norm, 
            strip_salts=strip_salts
        )
        strength_adj = evaluate_strength_overlap(cand, ocr_strengths)

        # Combined verification score
        combined = base_score + variant_adj + salt_adj + strength_adj
        final_score = max(0.0, min(100.0, combined))

        # Priority score: valid brand matches rank above generic searches
        priority = final_score + (100.0 if (is_brand_match and brand_ok) else 0.0)

        cand_strengths = extract_strengths_from_text(f"{cand['brand_name']} {cand['strength']} {cand['strength_clean']}")
        cand_strength_vals = {s["val"] for s in cand_strengths}

        scored.append({
            "candidate": cand,
            "score": final_score,
            "base_score": base_score,
            "priority_score": priority,
            "is_brand_match": is_brand_match,
            "brand_ok": brand_ok,
            "variant_adj": variant_adj,
            "salt_adj": salt_adj,
            "strength_adj": strength_adj,
            "cand_strength_vals": cand_strength_vals
        })

    # Sort descending by priority_score, then combined score
    scored.sort(key=lambda x: (x["priority_score"], x["score"]), reverse=True)

    # Filter evaluation pool: if brand-matched candidates exist, evaluate those; otherwise evaluate all
    has_any_brand_match = any(s["is_brand_match"] for s in scored)
    pool = [s for s in scored if s["is_brand_match"]] if has_any_brand_match else scored

    top_match = pool[0]
    top_score = top_match["score"]
    cand1 = top_match["candidate"]

    # -------------------------------------------------------------
    # GATE 1: Minimum Confidence Gate (>= 80%)
    # -------------------------------------------------------------
    if top_score < 80.0:
        torn_res = try_torn_salt_recovery(ocr_text, ocr_strengths, db_path, vlm_data=vlm_data)
        if torn_res is not None:
            if torn_res.get("status") == "VERIFIED":
                return torn_res
            if torn_res.get("gate_failed") in ("GATE_2_AMBIGUITY", "GATE_3_STRENGTH_MISMATCH", "GATE_3_STRENGTH_MISSING"):
                return torn_res

        return {
            "status": "NOT_SURE",
            "gate_failed": "GATE_1_LOW_CONFIDENCE",
            "reason": f"Top match confidence is {top_score:.1f}%, which is below the safe 80% threshold.",
            "top_candidate": cand1["brand_name"],
            "confidence": top_score,
            "detected_strengths": [s["raw"] for s in ocr_strengths],
            "ocr_text": ocr_text
        }

    # Group candidates by distinct (brand_name, strength)
    distinct_candidates = []
    seen_keys = set()
    for s in pool:
        key = (s["candidate"]["brand_name"].lower(), s["candidate"]["strength_clean"])
        if key not in seen_keys:
            seen_keys.add(key)
            distinct_candidates.append(s)

    # -------------------------------------------------------------
    # GATE 2: Ambiguity Gap Gate (< 10%)
    # ONLY triggers NOT_SURE when top candidates have DIFFERENT generic salt or DIFFERENT strength!
    # If they are different brands of the exact same active salt & strength, treat as safe match.
    # -------------------------------------------------------------
    cand1_brand = cand1["brand_name"]
    cand1_gen, cand1_st = normalize_composition(cand1)
    cand1_var_adj, cand1_brand_ok = evaluate_brand_and_variant(cand1_brand, clean_ocr_norm)
    cand1_has_variant = len(re.sub(r'[^a-zA-Z0-9\s]', ' ', cand1_brand).split()) >= 2

    for other in distinct_candidates[1:]:
        other_score = other["score"]
        gap = top_score - other_score
        if gap >= 10.0:
            break  # Sorted descending; remaining candidates have gap >= 10%

        cand_other = other["candidate"]
        other_brand = cand_other["brand_name"]
        other_gen, other_st = normalize_composition(cand_other)

        # If top candidate matches the exact variant suffix from the strip (e.g. Zerodol-SP),
        # a candidate that lacks that suffix (e.g. plain Zerodol) is NOT an ambiguous competitor
        other_has_variant = len(re.sub(r'[^a-zA-Z0-9\s]', ' ', other_brand).split()) >= 2
        if cand1_has_variant and cand1_brand_ok and not other_has_variant:
            continue

        # Trigger ambiguity ONLY if generic salt OR strength is different
        if (cand1_gen != other_gen) or (cand1_st != other_st):
            return {
                "status": "NOT_SURE",
                "gate_failed": "GATE_2_AMBIGUITY",
                "reason": (
                    f"Ambiguous match: top candidates '{cand1['brand_name']}' ({top_score:.1f}%) "
                    f"and '{cand_other['brand_name']}' ({other_score:.1f}%) differ by only {gap:.1f}% "
                    f"with different active salt or strength ({cand1.get('generic_name')} {cand1.get('strength')} vs "
                    f"{cand_other.get('generic_name')} {cand_other.get('strength')})."
                ),
                "confidence": top_score,
                "score_gap": round(gap, 1),
                "top_candidates": [cand1["brand_name"], cand_other["brand_name"]],
                "detected_strengths": [s["raw"] for s in ocr_strengths],
                "ocr_text": ocr_text
            }

    # -------------------------------------------------------------
    # GATE 3: Strength Verification Gate (mg/ml/mcg exact match)
    # -------------------------------------------------------------
    cand_strength_vals = top_match["cand_strength_vals"]

    if cand_strength_vals:
        # Candidate has an explicit strength requirement.
        # Check if the OCR text contains the expected strength.
        if not ocr_strength_vals:
            return {
                "status": "NOT_SURE",
                "gate_failed": "GATE_3_STRENGTH_MISSING",
                "reason": (
                    f"Medicine looks like '{cand1['brand_name']}' ({cand1['strength']}), "
                    "but dosage strength (mg/ml) was not clearly readable on the strip."
                ),
                "confidence": top_score,
                "expected_strength": cand1["strength"],
                "detected_strengths": [],
                "ocr_text": ocr_text
            }

        # Check for intersection or exact number match
        has_matching_strength = bool(cand_strength_vals & ocr_strength_vals)
        if not has_matching_strength:
            return {
                "status": "NOT_SURE",
                "gate_failed": "GATE_3_STRENGTH_MISMATCH",
                "reason": (
                    f"Strength mismatch: expected {cand1['strength']} for '{cand1['brand_name']}', "
                    f"but detected {[s['raw'] for s in ocr_strengths]} on the strip."
                ),
                "confidence": top_score,
                "expected_strength": cand1["strength"],
                "detected_strengths": [s["raw"] for s in ocr_strengths],
                "ocr_text": ocr_text
            }

    # -------------------------------------------------------------
    # ALL 3 GATES PASSED -> Safe Verified Match!
    # -------------------------------------------------------------
    is_branded = has_any_brand_match and top_match.get("is_brand_match")
    match_type = "BRANDED" if is_branded else "GENERIC_SALT_RECOVERY"

    brand_disp = cand1["brand_name"]
    if not is_branded:
        if vlm_data and vlm_data.get("brand_name") and vlm_data["brand_name"].lower() != (cand1["generic_name"] or "").lower():
            brand_disp = f"{vlm_data['brand_name']} ({cand1['generic_name']} {cand1['strength'] or ''})".strip()
        else:
            brand_disp = f"{cand1['generic_name']} {cand1['strength'] or ''}".strip()

    return {
        "status": "VERIFIED",
        "brand_name": brand_disp,
        "generic_name": cand1["generic_name"],
        "strength": cand1["strength"] or (f"{list(ocr_strength_vals)[0]}mg" if ocr_strength_vals else ""),
        "manufacturer": cand1["manufacturer"],
        "price": cand1["price"],
        "confidence": round(top_score, 1),
        "match_type": match_type,
        "detected_strengths": [s["raw"] for s in ocr_strengths],
        "ocr_text": ocr_text
    }
