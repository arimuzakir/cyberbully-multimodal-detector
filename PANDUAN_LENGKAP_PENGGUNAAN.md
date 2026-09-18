# 🛡️ PANDUAN LENGKAP APLIKASI DETEKSI CYBERBULLYING REAL-TIME V11 (TRIMODAL)
**Berdasarkan Model Multimodal Deep Learning (IndoBERT + IndoBERT-Tweet + mBERT + Whisper + EfficientNet + Late Fusion Stacking)**  
*F1-Score Trimodal: 91.78% | AUC-ROC: 97.34% | Dataset: 15.046 Sampel*

---

## 📁 Struktur Proyek

```
cyberbully-detector/
├── start_all.bat               <-- SCRIPT UTAMA (Klik ganda untuk menjalankan semua)
│
├── backend/                    <-- Backend REST API & WebSocket (FastAPI)
│   ├── main.py                 <-- Server API (Endpoints: /predict, /predict-video, /predict-audio, /predict-image, dll)
│   ├── model_loader.py         <-- Loader Model V11 + Trimodal Late Fusion Stacking
│   ├── multimodal_processor.py <-- Ekstraksi Trimodal (Video keyframes, Audio speech, Image OCR)
│   ├── pdf_parser.py           <-- Ekstraksi teks cerdas PDF per-paragraf
│   ├── url_scraper.py          <-- Web Scraper (YouTube, Twitter, IG, FB, TikTok)
│   ├── requirements.txt        <-- Daftar pustaka Python
│   └── start.bat               <-- Script khusus backend
│
├── frontend/                   <-- Website Dashboard Interaktif (Multimodal)
│   ├── index.html              <-- Halaman antarmuka utama (5 Tab Uji: Manual, Trimodal, PDF, Excel, URL + Live Feed)
│   ├── style.css               <-- Desain Modern Cyberpunk Dark Theme + Media Players & Trimodal Details
│   └── app.js                  <-- Logika client, MediaRecorder Mikrofon, Chart.js, SheetJS, WebSocket
│
└── extension/                  <-- Google Chrome Extension Real-Time
    ├── manifest.json           <-- Manifest v3 Chrome Extension
    ├── popup.html & popup.css  <-- Antarmuka mini ekstensi di browser
    ├── popup.js                <-- Logika popup & tombol scan/expand
    ├── content.js              <-- Script inject pembaca komentar sampai ke akar
    ├── background.js           <-- Background service worker & queue
    └── icons/                  <-- Ikon ekstensi (16px, 48px, 128px)
```

---

## 🚀 Cara Menjalankan Aplikasi (1-Klik)

1. Cukup **klik 2x file `start_all.bat`** di dalam folder `cyberbully-detector/`.
2. Script otomatis akan:
   - Menjalankan Backend FastAPI di `http://localhost:8000`
   - Menjalankan Server Frontend di `http://localhost:5500`
   - Membuka browser langsung ke dashboard testing `http://localhost:5500/index.html`

---

## 🎬 5 Mode Pengujian di Website Dashboard

### 1. 🎬 Tab Trimodal (Video, Audio, Image/Meme) — *Fitur Unggulan*
- **🎥 Video Trimodal:** Upload video (.mp4, .mkv, .mov, .webm). Sistem otomatis mengekstrak frame video (Visual), trek suara (Audio), dan mentranskripsi ucapan serta teks on-screen (Text), lalu melakukan **Late Fusion Stacking** secara simultan.
- **🎙️ Audio & Rekam Mikrofon:** Upload file rekaman suara (.mp3, .wav, .m4a) atau klik tombol **"Rekam Mikrofon"** untuk merekam suara langsung melalui browser. Sistem melakukan Speech-to-Text dan analisis intonasi akustik.
- **🖼️ Gambar / Meme:** Upload gambar meme atau screenshot postingan (.jpg, .png, .webp). Sistem menjalankan OCR untuk membaca teks dalam gambar dan mengevaluasi sentimen visual.
- **Tombol Uji Cepat Media:** Tersedia preset *"🔴 Video Toxic"*, *"🔴 Meme Hinaan"*, dan *"🟢 Media Aman"*.

### 2. ✏️ Tab Input Manual
- Ketik teks/komentar langsung pada textarea.
- Atur slider probabilitas Audio dan Visual secara dinamis untuk menguji respons Late Fusion Stacking.
- Klik **"🔍 Analisis Teks & Stacking"** untuk melihat Gauge Speedometer dan grafik per model.

### 3. 📄 Tab Dokumen PDF
- Upload dokumen PDF, sistem mengekstrak setiap paragraf dan menyajikan hasil pengujian per segmen dalam tabel interaktif.

### 4. 📊 Tab Dataset Excel / CSV
- Upload file dataset `.xlsx`, `.xls`, atau `.csv`.
- Pilih kolom teks dan lakukan batch testing hingga ratusan data sekaligus, dengan opsi **Export Hasil ke CSV**.

### 5. 🌐 Tab URL / Link Source
- Masukkan link YouTube, Twitter/X, Instagram, Facebook, TikTok, atau artikel berita untuk scraping teks dan analisis otomatis.

---

## 🧩 Cara Memasang & Menggunakan Chrome Extension

1. Buka browser **Google Chrome** dan ketik `chrome://extensions` di address bar.
2. Nyalakan toggle **"Developer mode"** di kanan atas.
3. Klik tombol **"Load unpacked"** di kiri atas.
4. Pilih folder: `E:\PAK ARI MUZAKIR\CYBER BULLYING PADA ANAK\APLIKASI\cyberbully-detector\extension`
5. Buka media sosial (YouTube/Twitter/Instagram) untuk melihat badge deteksi 🔴/🟢 di samping komentar secara otomatis, serta gunakan tombol **"📖 Buka Semua Komentar"** untuk membaca seluruh thread balasan sampai ke akar.
