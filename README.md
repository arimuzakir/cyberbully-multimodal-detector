# Deteksi Perundungan Siber (Cyberbullying) pada Anak Berbasis Multimodal

Repositori ini memuat implementasi sistem klasifikasi dan deteksi perundungan siber (*child-directed cyberbullying*) berbasis pembelajaran mesin multimodal (*Multimodal Deep Learning*) dan fusi *late fusion stacking MLP*.

Sistem ini merupakan luaran aplikasi dari penelitian artikel ilmiah:  
**"Coverage-Aware Learning from Fragmented Multimodal Evidence for Child-Directed Cyberbullying Detection"**  
**Peneliti Utama:** Dr. Ari Muzakir, S.Kom., M.Cs.

---

## Ringkasan Model & Evaluasi SOTA V12

Sistem mengimplementasikan arsitektur Tri-modal Late Fusion Stacking MLP yang dilatih pada dataset multimodal terfragmentasi dengan metrik evaluasi tervalidasi:

| Komponen | Spesifikasi & Model |
| :--- | :--- |
| **Kanal Teks Utama** | IndoBERT (`indobenchmark/indobert-base-p2`) & IndoBERT-Tweet |
| **Kanal Audio / Ucapan** | Transkripsi Speech-to-Text & Deteksi Nada Agresif |
| **Kanal Visual** | OCR Teks Ekstraksi & Visual Aggression Features |
| **Arsitektur Fusi** | Tri-modal Late Fusion Stacking MLP (`full_mlp_seed44`) |
| **Fallback Teks** | Dual-Encoder Text MLP (`text_mlp_seed44`) |
| **Threshold Optimal** | Teks: **0.53** \| Multimodal Penuh: **0.68** |
| **Hugging Face Model** | [muzakir17/cyberbully-v12-models](https://huggingface.co/muzakir17/cyberbully-v12-models) |

---

## Fitur Aplikasi

1. **Uji Manual Real-Time**: Masukan teks bebas dengan analisis probabilitas per modalitas dan visualisasi speedometer gauge.
2. **Uji Multimodal (Upload)**: Dukungan unggah file Dokumen PDF laporan, rekaman Audio, Gambar/Meme (OCR), dan Video pendek.
3. **Penyaring Konten Media Sosial (Social)**: Ekstraksi dan audit komentar publik secara terstruktur.
4. **Ekstensi Google Chrome**: Deteksi otomatis kalimat perundungan langsung pada halaman peramban web media sosial.

---

## Struktur Repositori

```text
├── api/             # Vercel Serverless Function entrypoint (index.py)
├── backend/         # FastAPI core engine, multimodal processor, & pdf parser
├── frontend/        # Antarmuka web modern (HTML, CSS, JS)
├── extension/       # Ekstensi Chrome Manifest V3 untuk pemindaian web real-time
├── requirements.txt # Dependensi serverless Python
├── vercel.json      # Konfigurasi perutean Vercel Serverless Function
└── README.md        # Dokumentasi resmi penelitian
```

---

## Lisensi & Sitasi Akademik

Proyek penelitian ini dikembangkan untuk kebutuhan riset akademik pencegahan dan mitigasi perundungan siber pada anak di Indonesia.
