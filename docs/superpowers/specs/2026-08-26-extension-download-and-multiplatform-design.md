# Design Document: Extension Download & Multi-Platform Compatibility (iOS, Windows, macOS, Android)

## Overview
Implementasi fitur unduh ekstensi browser (Chrome / Edge / Brave / Kiwi) secara instan (1-klik download format `.zip` serta panduan instalasi visual) dan optimalisasi menyeluruh agar aplikasi web berjalan sempurna di seluruh platform: Web, iOS (iPhone/iPad Safari), macOS, Windows, Linux, dan semua perangkat mobile (Android).

## User Goals & Requirements
1. **Tombol Download Extension:**
   - Tersedia tombol "📥 Unduh Ekstensi" di Header / Navbar semua halaman (`index.html`, `manual.html`, `upload.html`, `social.html`).
   - Kartu / Banner Ekstensi khusus di Beranda (`index.html`) dengan tombol Download ZIP langsung dan tombol "Panduan Pasang" yang memicu Modal Interaktif.
   - Modal Interaktif dengan langkah-langkah jelas bergambar/ikon untuk instalasi di Desktop (Chrome, Edge, Brave, Opera) dan Mobile (Kiwi Browser / Firefox Android).
   - Packaging otomatis file ZIP ekstensi (`cyberbully-extension.zip`) di direktori statis frontend dan endpoint backend `/download-extension`.
2. **Kompatibilitas Multi-Platform (iOS, Windows, macOS, Android):**
   - **iOS Safari Safe:** Mengatur `font-size: 16px` pada input / textarea di mobile untuk mencegah browser auto-zoom yang merusak layout, serta atribut `playsinline` dan `webkit-playsinline` pada video player.
   - **Perekam Mikrofon Multi-OS:** Dukungan perekam suara MediaRecorder dengan deteksi MIME type dinamis (`audio/webm;codecs=opus`, `audio/mp4`, `audio/aac`, atau default browser) agar berfungsi lancar di iOS Safari, macOS, Android, dan Windows.
   - **Ngrok Header Handling:** Penyertaan header `ngrok-skip-browser-warning: true` di seluruh request `fetch()` agar akses publik melalui Ngrok tidak dicegat oleh halaman intersitial di smartphone/browser apapun.
   - **Responsive Ergonomics:** Desain adaptif dari resolusi terkecil (320px) hingga layar lebar (4K), safe-area insets untuk iPhone notch, touch-target minimal 44px, dan scroll horizontal halus pada tabel data.

## Component Architecture & Changes
1. **Backend (`backend/main.py`):**
   - Endpoint `@app.get("/download-extension")`: Mengemas isi folder `extension/` ke zip atau mengirim `cyberbully-extension.zip` sebagai `FileResponse` dengan nama `cyberbully-extension-v11.zip`.
2. **Frontend UI (`frontend/index.html`, `manual.html`, `upload.html`, `social.html`):**
   - Penambahan tombol download di header navbar semua file HTML.
   - Penambahan section / card banner dan modal panduan ekstensi di `index.html`.
   - Update meta tags (viewport cover, mobile-web-app-capable, theme-color).
3. **Frontend Styling (`frontend/style.css`):**
   - Styling tombol download (`.btn-download-ext`), banner ekstensi, dan modal panduan (`.ext-modal-overlay`, `.ext-modal-card`).
   - Media queries responsif komprehensif untuk breakpoints 1024px, 768px, 480px, dan 360px.
   - Aturan pencegahan iOS auto-zoom dan optimasi touch targets (min-height: 44px).
4. **Frontend Logic (`frontend/app.js`):**
   - Fungsi membuka dan menutup modal panduan ekstensi (`openExtensionModal()`, `closeExtensionModal()`).
   - Peningkatan `toggleMicRecord()` dengan fallback MIME types iOS/Android.
   - Penambahan header `ngrok-skip-browser-warning` pada `fetchAPI`, `fetchFormData`, `checkAPIStatus`, dan fungsi fetch lainnya.
5. **Extension Packaging Script:**
   - Script python utilitas untuk build `frontend/cyberbully-extension.zip`.
