"""
main.py — FastAPI Backend untuk Cyberbullying Detection V11 (Multimodal: Text, Audio, Visual, Video)
Endpoints:
  GET  /health               → status server & model
  POST /predict              → prediksi single text (+ audio_prob, visual_prob)
  POST /predict-batch        → prediksi batch texts (JSON)
  POST /predict-pdf          → upload PDF, analisis per segment
  POST /predict-excel        → upload Excel/CSV, analisis per baris
  POST /predict-url          → scrape URL, analisis semua segment
  POST /predict-audio        → upload file audio (speech-to-text + audio analysis + stacking)
  POST /predict-image        → upload file gambar/meme (OCR + visual analysis + stacking)
  POST /predict-video        → upload file video (trimodal extraction: frames + audio + speech)
  POST /predict-multimodal   → fusi multimodal terpadu (upload media + custom text)
  WS   /ws/stream            → WebSocket untuk Chrome Extension real-time
"""
import asyncio
import io
import json
import logging
import os
import time
import zipfile
from contextlib import asynccontextmanager
from typing import Optional

import urllib.parse

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import model_loader
import pdf_parser
import url_scraper
import multimodal_processor

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── WebSocket Manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WS connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info(f"WS disconnected. Total: {len(self.active)}")

    async def broadcast(self, data: dict):
        msg = json.dumps(data, ensure_ascii=False)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

ws_manager = ConnectionManager()

# ── Startup / Shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting Cyberbullying Detection API V12 SOTA (Multimodal Real-Time Engine)...")
    model_loader.initialize()
    logger.info(f"Mode: {model_loader.get_mode().upper()}")
    yield
    logger.info("Shutting down API...")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cyberbullying Detection API V12 SOTA",
    description="Real-time Multimodal Cyberbullying Detection — IndoBERT + IndoBERT-Tweet + mBERT + Audio Transcript + EfficientNet + Tri-modal Stacking MLP",
    version="12.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def fix_vercel_path_middleware(request: Request, call_next):
    """
    Menangani rewrite serverless Vercel:
    Jika Vercel me-rewrite path ke '/api/index.py', ekstrak target asli dari query string
    (__route atau path) dan sesuaikan scope['path'] sebelum routing FastAPI berjalan.
    Juga menghandle pemanggilan dengan prefix '/api/'.
    """
    path = request.scope.get("path", "")
    raw_qs = request.scope.get("query_string", b"").decode("utf-8")
    
    if path in ("/api/index.py", "/api/index.py/"):
        qs_dict = urllib.parse.parse_qs(raw_qs)
        if "__route" in qs_dict and qs_dict["__route"]:
            request.scope["path"] = qs_dict["__route"][0]
        elif "path" in qs_dict and qs_dict["path"]:
            p = qs_dict["path"][0]
            request.scope["path"] = "/" + p.lstrip("/")
        else:
            request.scope["path"] = "/"
    elif path.startswith("/api/"):
        sub_path = path[4:]
        if sub_path:
            request.scope["path"] = sub_path
            
    return await call_next(request)


# ── Pydantic Models ───────────────────────────────────────────────────────────
class TextRequest(BaseModel):
    text: str
    audio_prob: float = 0.5
    visual_prob: float = 0.5

class BatchRequest(BaseModel):
    texts: list[str]
    audio_prob: float = 0.5
    visual_prob: float = 0.5

class URLRequest(BaseModel):
    url: str

class ExtensionRequest(BaseModel):
    text: str
    source_url: str
    platform: str
    comment_id: Optional[str] = None

class FrameRequest(BaseModel):
    image_base64: str
    caption_text: Optional[str] = ""
    source_url: Optional[str] = ""
    platform: Optional[str] = "web"
    is_video_frame: bool = True

# ── Helper ────────────────────────────────────────────────────────────────────
def _enrich_result(result: dict, text: str, idx: int = 0) -> dict:
    """Tambahkan metadata tambahan ke hasil prediksi."""
    result["text_preview"] = text[:140] + "..." if len(text) > 140 else text
    result["text_length"]  = len(text)
    result["index"]        = idx
    result["timestamp"]    = time.time()
    return result

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/api/health")
async def health():
    return {
        "status":               "online",
        "model_loaded":         model_loader.is_loaded(),
        "mode":                 model_loader.get_mode(),
        "threshold":            model_loader.THRESHOLD_TEXT,
        "threshold_multimodal": model_loader.THRESHOLD_FULL,
        "modalities":           ["text_indobert", "text_indobertweet", "text_mbert", "audio_transcript", "visual_effnet", "trimodal_mlp_stacking"],
        "primary_model":        "full_mlp_seed44",
        "fallback_model":       "text_mlp_seed44",
        "version":              model_loader.VERSION,
    }

@app.post("/predict")
@app.post("/api/predict")
async def predict(req: TextRequest):
    if not req.text.strip():
        raise HTTPException(400, "Text kosong")
    result = model_loader.predict(req.text, req.audio_prob, req.visual_prob)
    return _enrich_result(result, req.text)

@app.post("/predict-batch")
@app.post("/api/predict-batch")
async def predict_batch(req: BatchRequest):
    if not req.texts:
        raise HTTPException(400, "List texts kosong")
    results = []
    for i, text in enumerate(req.texts[:500]):  # max 500 per batch
        if text and str(text).strip():
            r = model_loader.predict(str(text), req.audio_prob, req.visual_prob)
            results.append(_enrich_result(r, str(text), i))
    return {
        "total":           len(results),
        "bullying_count":  sum(1 for r in results if r.get("is_bullying")),
        "results":         results,
    }

@app.post("/predict-pdf")
@app.post("/api/predict-pdf")
async def predict_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Hanya file PDF yang didukung")
    file_bytes = await file.read()
    segments   = pdf_parser.extract_texts_from_pdf(file_bytes)
    if not segments:
        raise HTTPException(422, "Tidak ada teks yang bisa diekstrak dari PDF")
    results = []
    for seg in segments:
        text = seg["text"]
        r    = model_loader.predict(text)
        r    = _enrich_result(r, text, seg["segment"])
        r["page"]    = seg["page"]
        r["segment"] = seg["segment"]
        results.append(r)
    return {
        "filename":       file.filename,
        "total_segments": len(results),
        "bullying_count": sum(1 for r in results if r.get("is_bullying")),
        "results":        results,
    }

@app.post("/predict-excel")
@app.post("/api/predict-excel")
async def predict_excel(
    file: UploadFile = File(...),
    column: str = Form("text"),
):
    fname = file.filename.lower()
    if not (fname.endswith(".xlsx") or fname.endswith(".xls") or fname.endswith(".csv")):
        raise HTTPException(400, "Hanya file Excel (.xlsx/.xls) atau CSV yang didukung")
    file_bytes = await file.read()
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8-sig")
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        raise HTTPException(422, f"Gagal membaca file: {e}")

    # Cari kolom teks
    if column not in df.columns:
        candidates = [c for c in df.columns if any(kw in c.lower() for kw in ["text","teks","komentar","comment","content","isi"])]
        if candidates:
            column = candidates[0]
        else:
            column = df.columns[0]  # fallback

    texts = df[column].dropna().astype(str).tolist()
    results = []
    for i, text in enumerate(texts[:1000]):
        if text.strip():
            r = model_loader.predict(text)
            r = _enrich_result(r, text, i + 1)
            r["row"] = i + 1
            results.append(r)

    return {
        "filename":       file.filename,
        "column_used":    column,
        "total_rows":     len(results),
        "bullying_count": sum(1 for r in results if r.get("is_bullying")),
        "results":        results,
    }

@app.post("/predict-url")
@app.post("/api/predict-url")
async def predict_url(req: URLRequest):
    if not req.url.strip():
        raise HTTPException(400, "URL kosong")
    scraped = url_scraper.scrape_url(req.url)
    if scraped.get("error") and not scraped.get("segments"):
        raise HTTPException(422, f"Gagal scraping: {scraped['error']}")
    segments = scraped.get("segments", [])
    results = []
    for seg in segments:
        text = seg["text"]
        if text.startswith("[INFO]"):
            results.append({"index": seg["index"], "text": text, "is_info": True,
                            "is_bullying": False, "confidence": 0.0, "label": "Info"})
            continue
        r = model_loader.predict(text)
        r = _enrich_result(r, text, seg["index"])
        results.append(r)

    bullying_results = [r for r in results if r.get("is_bullying")]
    return {
        "url":            req.url,
        "platform":       scraped.get("platform", "generic"),
        "total_segments": len(results),
        "bullying_count": len(bullying_results),
        "results":        results,
    }

# ── ENDPOINTS MULTIMODAL KHUSUS (AUDIO / IMAGE / VIDEO) ───────────────────────

@app.post("/predict-audio")
@app.post("/api/predict-audio")
async def predict_audio(file: UploadFile = File(...)):
    """Menganalisis file audio untuk deteksi speech, nada akustik, dan trimodal stacking."""
    file_bytes = await file.read()
    audio_data = multimodal_processor.process_audio(file_bytes, filename=file.filename)
    
    text_to_analyze = audio_data.get("transcribed_text") or "Audio speech stream."
    audio_prob = audio_data.get("audio_prob", 0.5)
    
    # Prediksi menggunakan fusi Text + Audio dengan V12 Neural Transcript Encoder
    res = model_loader.predict(
        text_to_analyze,
        audio_prob=audio_prob,
        visual_prob=0.5,
        audio_transcript=audio_data.get("transcribed_text")
    )
    res = _enrich_result(res, text_to_analyze)
    res["multimodal_details"] = audio_data
    res["modality_type"] = "Audio / Speech"
    return res

@app.post("/predict-image")
@app.post("/api/predict-image")
async def predict_image(file: UploadFile = File(...)):
    """Menganalisis gambar/meme/screenshot dengan OCR dan visual classifier."""
    file_bytes = await file.read()
    image_data = multimodal_processor.process_image(file_bytes, filename=file.filename)
    
    text_to_analyze = image_data.get("extracted_text") or "Gambar media visual."
    visual_prob = image_data.get("visual_prob", 0.5)
    
    # Prediksi menggunakan fusi Text + Visual
    res = model_loader.predict(text_to_analyze, audio_prob=0.5, visual_prob=visual_prob)
    res = _enrich_result(res, text_to_analyze)
    res["multimodal_details"] = image_data
    res["modality_type"] = "Visual / Image OCR"
    return res

@app.post("/predict-video")
@app.post("/api/predict-video")
async def predict_video(file: UploadFile = File(...)):
    """Menganalisis file video secara Trimodal penuh: Keyframes + Audio Speech + Text Subtitles."""
    file_bytes = await file.read()
    video_data = multimodal_processor.process_video(file_bytes, filename=file.filename)
    
    text_to_analyze = video_data.get("combined_text") or "Video multimodal stream."
    audio_prob = video_data.get("audio_prob", 0.5)
    visual_prob = video_data.get("visual_prob", 0.5)
    speech_text = video_data.get("extracted_speech") or video_data.get("combined_text")
    
    # Prediksi fusi Trimodal Lengkap (Text + Audio + Visual) via V12 full_mlp_seed44
    res = model_loader.predict(
        text_to_analyze,
        audio_prob=audio_prob,
        visual_prob=visual_prob,
        audio_transcript=speech_text
    )
    res = _enrich_result(res, text_to_analyze)
    res["multimodal_details"] = video_data
    res["modality_type"] = "Trimodal Video (Audio + Visual + Text)"
    return res

@app.post("/predict-multimodal")
@app.post("/api/predict-multimodal")
async def predict_multimodal(
    custom_text: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    image_file: Optional[UploadFile] = File(None),
    video_file: Optional[UploadFile] = File(None),
):
    """Menerima kombinasi teks, audio, gambar, dan video secara bersamaan."""
    audio_prob = 0.5
    visual_prob = 0.5
    collected_texts = []
    speech_transcripts = []
    details = {}

    if custom_text and custom_text.strip():
        collected_texts.append(f"[Teks Input]: {custom_text.strip()}")

    if audio_file:
        ab = await audio_file.read()
        a_data = multimodal_processor.process_audio(ab, audio_file.filename)
        audio_prob = a_data.get("audio_prob", 0.5)
        if a_data.get("transcribed_text"):
            collected_texts.append(f"[Speech Audio]: {a_data['transcribed_text']}")
            speech_transcripts.append(a_data['transcribed_text'])
        details["audio"] = a_data

    if image_file:
        ib = await image_file.read()
        i_data = multimodal_processor.process_image(ib, image_file.filename)
        visual_prob = i_data.get("visual_prob", 0.5)
        if i_data.get("extracted_text"):
            collected_texts.append(f"[OCR Image]: {i_data['extracted_text']}")
        details["visual"] = i_data

    if video_file:
        vb = await video_file.read()
        v_data = multimodal_processor.process_video(vb, video_file.filename)
        audio_prob = max(audio_prob, v_data.get("audio_prob", 0.5))
        visual_prob = max(visual_prob, v_data.get("visual_prob", 0.5))
        if v_data.get("combined_text"):
            collected_texts.append(f"[Video Content]: {v_data['combined_text']}")
        if v_data.get("extracted_speech"):
            speech_transcripts.append(v_data['extracted_speech'])
        details["video"] = v_data

    combined_text = " | ".join(collected_texts) if collected_texts else "Multimodal input stream."
    combined_speech = " | ".join(speech_transcripts) if speech_transcripts else None

    res = model_loader.predict(
        combined_text,
        audio_prob=audio_prob,
        visual_prob=visual_prob,
        audio_transcript=combined_speech
    )
    res = _enrich_result(res, combined_text)
    res["multimodal_details"] = details
    res["modality_type"] = "Trimodal Combined (Late Fusion Stacking)"
    return res

# ── Extension Real-Time Endpoint ──────────────────────────────────────────────
@app.post("/extension/predict")
@app.post("/api/extension/predict")
async def extension_predict(req: ExtensionRequest):
    """Endpoint khusus untuk Chrome Extension — prediksi + broadcast ke WS clients."""
    result = model_loader.predict(req.text)
    result = _enrich_result(result, req.text)
    result["source_url"]  = req.source_url
    result["platform"]    = req.platform
    result["comment_id"]  = req.comment_id
    await ws_manager.broadcast(result)
    return result

@app.post("/predict-frame")
@app.post("/api/predict-frame")
async def predict_frame(req: FrameRequest):
    """Menerima snapshot frame video atau meme dalam format base64 dari Chrome Extension untuk deteksi Trimodal."""
    import base64
    img_b64 = req.image_base64
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]
    
    try:
        img_bytes = base64.b64decode(img_b64)
    except Exception as e:
        raise HTTPException(400, f"Invalid base64 image: {e}")
    
    # Process visual & OCR
    image_data = multimodal_processor.process_image(img_bytes, filename="live_frame.jpg")
    visual_prob = image_data.get("visual_prob", 0.5)
    extracted_text = image_data.get("extracted_text") or ""
    
    # Combine caption + OCR text
    combined_texts = []
    if req.caption_text and req.caption_text.strip():
        combined_texts.append(f"[Caption/Post]: {req.caption_text.strip()}")
    if extracted_text and not extracted_text.startswith("Visual content"):
        combined_texts.append(f"[OCR Frame]: {extracted_text}")
    
    text_to_analyze = " | ".join(combined_texts) if combined_texts else "Snapshot visual media stream."
    
    # Prediksi menggunakan fusi Trimodal (Text + Visual + neutral Audio)
    res = model_loader.predict(text_to_analyze, audio_prob=0.5, visual_prob=visual_prob)
    res = _enrich_result(res, text_to_analyze)
    res["multimodal_details"] = image_data
    res["modality_type"] = "Video Keyframe (Trimodal)" if req.is_video_frame else "Image Meme (OCR+Visual)"
    res["source_url"] = req.source_url
    res["platform"] = req.platform
    
    # Broadcast to dashboard WebSocket
    await ws_manager.broadcast(res)
    return res

# ── WebSocket untuk live stream ke dashboard ──────────────────────────────────
@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_text(json.dumps({"type": "ping"}))
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ws_manager.disconnect(websocket)

# ── Download Extension ZIP ───────────────────────────────────────────────────
EXTENSION_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "extension"))
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
EXTENSION_ZIP = os.path.join(FRONTEND_DIR, "cyberbully-extension.zip")

def build_extension_zip():
    try:
        if os.path.exists(EXTENSION_DIR):
            with zipfile.ZipFile(EXTENSION_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(EXTENSION_DIR):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, EXTENSION_DIR)
                        zipf.write(file_path, arcname)
            logger.info(f"Extension packaged successfully: {EXTENSION_ZIP}")
    except Exception as e:
        logger.error(f"Failed to package extension zip: {e}")

@app.get("/download-extension")
async def download_extension():
    build_extension_zip()
    if os.path.exists(EXTENSION_ZIP):
        return FileResponse(
            EXTENSION_ZIP,
            media_type="application/zip",
            filename="cyberbully-extension-v11.zip"
        )
    raise HTTPException(404, "Extension archive not found")

# ── Static Files & HTML Pages Serving ─────────────────────────────────────────
def _get_html_content(filename: str) -> Optional[str]:
    search_dirs = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend")),
        os.path.abspath(os.path.join(os.getcwd(), "public")),
        os.path.abspath(os.path.join(os.getcwd(), "frontend")),
        os.path.join("/var/task", "public"),
        os.path.join("/var/task", "frontend"),
    ]
    for d in search_dirs:
        target = os.path.join(d, filename)
        if os.path.exists(target):
            try:
                with open(target, "r", encoding="utf-8") as f:
                    return f.read()
            except Exception:
                pass
    return None

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    content = _get_html_content("index.html")
    if content:
        return HTMLResponse(content=content)
    return HTMLResponse("<h1>CyberBully Detector V12 SOTA</h1><p>API Server is running.</p>")

@app.get("/manual.html", response_class=HTMLResponse)
@app.get("/manual", response_class=HTMLResponse)
async def serve_manual():
    content = _get_html_content("manual.html")
    if content:
        return HTMLResponse(content=content)
    raise HTTPException(404, "manual.html not found")

@app.get("/upload.html", response_class=HTMLResponse)
@app.get("/upload", response_class=HTMLResponse)
async def serve_upload():
    content = _get_html_content("upload.html")
    if content:
        return HTMLResponse(content=content)
    raise HTTPException(404, "upload.html not found")

@app.get("/social.html", response_class=HTMLResponse)
@app.get("/social", response_class=HTMLResponse)
async def serve_social():
    content = _get_html_content("social.html")
    if content:
        return HTMLResponse(content=content)
    raise HTTPException(404, "social.html not found")

# Coba mount static directory jika tersedia
for s_dir in [os.path.join(os.getcwd(), "public"), FRONTEND_DIR]:
    if os.path.exists(s_dir):
        try:
            app.mount("/static", StaticFiles(directory=s_dir), name="static")
            break
        except Exception:
            pass

# ── Run ───────────────────────────────────────────────────────────────────────

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
