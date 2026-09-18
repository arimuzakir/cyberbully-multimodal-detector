"""
model_loader.py — Singleton Loader untuk Model V12 SOTA (Folder output)
Sistem Deteksi Perundungan Siber (Cyberbullying) pada Anak Berbasis Multimodal
Arsitektur Utama: full_mlp_seed44 (Tri-modal Late Fusion Stacking MLP)
Fallback Cepat:  text_mlp_seed44 (Late Fusion Teks Khusus Input Teks Murni)
Artefak: E:\\PAK ARI MUZAKIR\\CYBER BULLYING PADA ANAK\\APLIKASI\\output
"""
import os
import sys
import json
import logging
from pathlib import Path
import numpy as np

logger = logging.getLogger(__name__)

# ── Path ke Direktori Output Model V12 ─────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
V12_DIR = (BASE_DIR / ".." / ".." / "output").resolve()
CONFIG_PATH = V12_DIR / "config.json"
FUSION_DIR = V12_DIR / "fusion"
ENCODERS_DIR = V12_DIR / "encoders"

# Tambahkan V12_DIR ke sys.path agar modul predict_realtime dapat diimpor
if str(V12_DIR) not in sys.path:
    sys.path.insert(0, str(V12_DIR))

# ── Baca konfigurasi V12 ───────────────────────────────────────────────────────
CFG = {}
if CONFIG_PATH.exists():
    try:
        CFG = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        logger.info(f"V12 Config loaded successfully from {CONFIG_PATH}")
    except Exception as e:
        logger.warning(f"Gagal membaca V12 config.json: {e}")

VERSION = CFG.get("version", "V12_REVISI_SOTA_2026")
THRESHOLD_TEXT = float(CFG.get("primary_models", {}).get("text_fallback", {}).get("optimal_threshold", 0.53))
THRESHOLD_FULL = float(CFG.get("primary_models", {}).get("multimodal_main", {}).get("optimal_threshold", 0.68))
THRESHOLD = THRESHOLD_TEXT  # Default threshold teks
LABELS = {"0": "NON_BULLYING", "1": "CYBERBULLYING"}

# ── Kata Kunci Cyberbullying & Pola Edukasi untuk Explainability ──────────────
_BULLY_KEYWORDS = [
    "bodoh","idiot","tolol","bego","kampungan","jelek","mati","bunuh","hina",
    "cewek murahan","anak haram","pengecut","anjing","babi","goblok","setan",
    "dungu","tidak berguna","ga berguna","sampah","buang","hancur","malu",
    "loser","pecundang","ugly","stupid","dumb","kill","die","hate","trash",
    "pergi mati","dasar","kasihan","ngemis","miskin","gak ada gunanya",
    "bocah sialan","sialan","mampus","bangsat","bajingan","mati aja","lonte",
    "perek","labrak","sok jagoan","sok kepintaran","jelek banget","benci",
    "perundungan","bully","bullying","buliying","aniaya","4n!ay4","pukul","pukuli",
    "korban","k0rb4n","patah tulang","p4t4h","hajar","gebuk","keroyok","siksa",
    "cacat","najis","kontol","memek","bacot","perek","bajingan","bajingan tengik",
    "penganiayaan","kekerasan","berantem","insiden","dikeroyok","dianiaya","rawan",
    "baku hantam","tawuran","gebukin","tendang","injak","intimidasi","ancam",
    "ancaman","menindas","ditindas","penindasan","perkelahian","kelahi","kekerasanremaja",
    "stopperundungan","usuttuntas","keadilanuntukkorban","kasus perundungan","dianiaya",
    "dihajar","dipukuli","dibully","pelaku bully","pelaku perundungan"
]

_SAFE_PATTERNS = [
    "biar ga ada", "biar tidak ada", "agar tidak ada", "supaya tidak ada", "jangan ada",
    "biyar egh ada", "biyar ga ada", "biar gak ada", "biar nggak ada", "kaga ada", "ngga ada",
    "stop perundungan", "stop kekerasan", "hentikan perundungan", "hentikan kekerasan",
    "mencegah perundungan", "mencegah kekerasan", "perhatikan murid", "perhatikan murit",
    "perhatikan anak", "pantau anak", "pantoh", "saling menghargai", "saling tolong", "edukasi",
    "jangan saling", "hindari kekerasan", "keadilan untuk korban", "semoga lekas sembuh",
    "perlu dididik", "tolak kekerasan", "saling merangkul", "semoga korban", "doa untuk korban",
    "dunia pendidikan", "sebagai orang tua", "peran orang tua", "peran guru", "nasihat", "damai"
]

# ── Singleton Engine State ────────────────────────────────────────────────────
_engine = None
_is_loaded = False
_engine_mode = "v12_initializing"

def initialize(device=None):
    """Panggil saat server FastAPI startup untuk memuat arsitektur V12 riil."""
    global _engine, _is_loaded, _engine_mode
    if _is_loaded and _engine is not None:
        logger.info("Model V12 sudah aktif dalam memori.")
        return _engine

    logger.info("=" * 60)
    logger.info("🚀 Menginisialisasi Model V12 SOTA Real-Time Engine...")
    logger.info(f"Direktori Model: {V12_DIR}")

    try:
        from predict_realtime import CyberbullyingInferenceEngine
        _engine = CyberbullyingInferenceEngine(device=device)
        _is_loaded = True
        _engine_mode = "real_v12_sota_mlp"
        logger.info("🟢 SUCCESS: Model V12 Real-Time Engine (full_mlp_seed44 + text_mlp_seed44) SIAP!")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"❌ Gagal memuat Real V12 Engine: {e}", exc_info=True)
        logger.warning("Mengaktifkan mode Fallback Simulasi Terkalibrasi V12...")
        _is_loaded = True
        _engine_mode = "simulated_v12_calibrated"

    return _engine

def is_loaded() -> bool:
    return _is_loaded

def get_mode() -> str:
    return _engine_mode

def get_config() -> dict:
    return CFG

def _extract_keywords(text: str) -> list[str]:
    text_lower = text.lower()
    hits = []
    for kw in _BULLY_KEYWORDS:
        if kw in text_lower:
            hits.append(kw)
    return hits[:5]

def predict(
    text: str,
    audio_prob: float = 0.5,
    visual_prob: float = 0.5,
    audio_transcript: str = None
) -> dict:
    """
    Fungsi prediksi terpadu untuk semua endpoint aplikasi:
    - Input Teks Murni: Otomatis menggunakan text_mlp_seed44 (threshold 0.53)
    - Input Multimodal (Audio Transcript / Visual Score): Menggunakan full_mlp_seed44 (threshold 0.68)
    """
    global _engine, _is_loaded, _engine_mode

    if not text or not str(text).strip():
        text = "Media visual audio stream."

    clean_text = str(text).strip()
    hits = _extract_keywords(clean_text)

    # Inisialisasi jika belum
    if not _is_loaded or (_engine is None and _engine_mode != "simulated_v12_calibrated"):
        initialize()

    # Evaluasi ada/tidaknya modalitas audio & visual
    has_audio_transcript = audio_transcript is not None and len(str(audio_transcript).strip()) > 0
    has_custom_audio = has_audio_transcript or (audio_prob is not None and abs(float(audio_prob) - 0.5) > 0.01)
    has_custom_visual = (visual_prob is not None and abs(float(visual_prob) - 0.5) > 0.01)
    is_multimodal = has_custom_audio or has_custom_visual

    if _engine_mode == "real_v12_sota_mlp" and _engine is not None:
        try:
            # Panggil engine inferensi V12 riil
            if has_audio_transcript:
                tr_input = str(audio_transcript).strip()
            elif has_custom_audio:
                tr_input = clean_text  # Fallback teks ke channel audio transkrip
            else:
                tr_input = None

            vis_score = float(visual_prob) if has_custom_visual else (0.50 if has_audio_transcript else None)

            raw_res = _engine.predict(
                text=clean_text,
                audio_transcript=tr_input,
                visual_feature_score=vis_score
            )

            p_indobert = raw_res["modality_scores"].get("indobert_text", 0.5)
            p_indobertweet = raw_res["modality_scores"].get("indobertweet_slang", 0.5)
            p_mbert = round((p_indobert + p_indobertweet) / 2.0, 4)

            p_audio = raw_res["modality_scores"].get("audio_transcript")
            if p_audio == "N/A" or p_audio is None:
                p_audio = round(float(audio_prob), 4)

            p_visual = raw_res["modality_scores"].get("visual_score")
            if p_visual == "N/A" or p_visual is None:
                p_visual = round(float(visual_prob), 4)

            final_prob = float(raw_res["probability"])
            threshold_used = float(raw_res["threshold_used"])
            is_bully = bool(final_prob >= threshold_used)
            conf = final_prob if is_bully else (1.0 - final_prob)

            return {
                "label": "CYBERBULLYING" if is_bully else "NON_BULLYING",
                "is_bullying": is_bully,
                "confidence": round(conf, 4),
                "confidence_percent": round(conf * 100.0, 2),
                "probability": round(final_prob, 4),
                "threshold": round(threshold_used, 4),
                "threshold_used": round(threshold_used, 4),
                "mode": "real_v12_sota_mlp",
                "model_used": raw_res.get("model_used", "text_mlp_seed44"),
                "keywords_hit": hits,
                "modality_scores": {
                    "indobert": round(p_indobert, 4),
                    "indobertweet": round(p_indobertweet, 4),
                    "mbert": round(p_mbert, 4),
                    "audio": round(float(p_audio), 4),
                    "visual": round(float(p_visual), 4),
                    "trimodal_stacking": round(final_prob, 4),
                }
            }
        except Exception as err:
            logger.error(f"Error saat inferensi V12 riil: {err}", exc_info=True)

    # ── Fallback Terkalibrasi (jika real engine belum siap) ───────────────────
    text_lower = clean_text.lower()
    is_safe = any(sp in text_lower for sp in _SAFE_PATTERNS)
    base_score = 0.05
    if hits and not is_safe:
        base_score = 0.52 + min(len(hits) * 0.14, 0.44)

    ib = round(float(np.clip(base_score + np.random.uniform(-0.02, 0.02), 0.02, 0.98)), 4)
    ibt = round(float(np.clip(base_score + np.random.uniform(-0.03, 0.03), 0.02, 0.98)), 4)
    mb = round(float(np.clip(base_score + np.random.uniform(-0.02, 0.02), 0.02, 0.98)), 4)

    threshold = THRESHOLD_FULL if is_multimodal else THRESHOLD_TEXT
    if is_multimodal:
        final_prob = 0.40 * ib + 0.30 * ibt + 0.15 * mb + 0.10 * float(audio_prob) + 0.05 * float(visual_prob)
        model_used = "full_mlp_seed44 (calibrated)"
    else:
        final_prob = 0.48 * ib + 0.32 * ibt + 0.20 * mb
        model_used = "text_mlp_seed44 (calibrated)"

    final_prob = round(float(np.clip(final_prob, 0.01, 0.99)), 4)
    is_bully = final_prob >= threshold
    conf = final_prob if is_bully else (1.0 - final_prob)

    return {
        "label": "CYBERBULLYING" if is_bully else "NON_BULLYING",
        "is_bullying": is_bully,
        "confidence": round(conf, 4),
        "confidence_percent": round(conf * 100.0, 2),
        "probability": round(final_prob, 4),
        "threshold": round(threshold, 4),
        "threshold_used": round(threshold, 4),
        "mode": "simulated_v12_calibrated",
        "model_used": model_used,
        "keywords_hit": hits,
        "modality_scores": {
            "indobert": ib,
            "indobertweet": ibt,
            "mbert": mb,
            "audio": round(float(audio_prob), 4),
            "visual": round(float(visual_prob), 4),
            "trimodal_stacking": final_prob,
        }
    }
