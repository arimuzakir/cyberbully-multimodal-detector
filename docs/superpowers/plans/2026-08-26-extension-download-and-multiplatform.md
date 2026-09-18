# Extension Download & Multi-Platform Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tombol download ekstensi browser (1-klik ZIP + modal panduan) dan mengoptimalkan website agar responsif serta bekerja sempurna di Web, iOS (Safari), Windows, macOS, Android, dan semua perangkat mobile.

**Architecture:** Memanfaatkan bundling zip otomatis di backend FastAPI (`/download-extension`) dan file statis frontend, menyematkan komponen UI download + modal panduan di semua halaman, dan menerapkan optimasi mobile universal (iOS Safe font size, MIME type fallback MediaRecorder, ngrok bypass header, safe area padding, touch target 44px).

**Tech Stack:** FastAPI, Python `zipfile`, HTML5/CSS3/Vanilla JS, MediaRecorder API, Viewport Meta & Safe Area Insets.

## Global Constraints
- Target Files: `backend/main.py`, `frontend/index.html`, `frontend/manual.html`, `frontend/upload.html`, `frontend/social.html`, `frontend/style.css`, `frontend/app.js`.
- File Output: `frontend/cyberbully-extension.zip`.
- No disruption to existing multimodal endpoints (`/predict`, `/predict-multimodal`, dll).

---

### Task 1: Extension Packaging & Backend Download Route
**Files:**
- Modify: `backend/main.py`
- Create: `frontend/cyberbully-extension.zip`

- [ ] **Step 1: Write python packaging utility to build `cyberbully-extension.zip`**
- [ ] **Step 2: Add `/download-extension` route in `backend/main.py` with `FileResponse`**
- [ ] **Step 3: Test endpoint and verify ZIP archive integrity**

---

### Task 2: Update HTML Templates (Index, Manual, Upload, Social)
**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/manual.html`
- Modify: `frontend/upload.html`
- Modify: `frontend/social.html`

- [ ] **Step 1: Add Navbar Download Button with download attribute across all 4 HTML files**
- [ ] **Step 2: Add Extension Promo Banner & Interactive Guide Modal to `frontend/index.html`**
- [ ] **Step 3: Update mobile viewport and Apple Web App meta tags in all 4 HTML files**
- [ ] **Step 4: Add `playsinline webkit-playsinline` on video player in `frontend/upload.html`**

---

### Task 3: Multi-Platform & Mobile Responsive CSS System
**Files:**
- Modify: `frontend/style.css`

- [ ] **Step 1: Add CSS styles for `.btn-download-ext`, `.extension-promo-card`, and modal guide components**
- [ ] **Step 2: Add iOS auto-zoom prevention rule (`font-size: 16px` on inputs for mobile)**
- [ ] **Step 3: Enhance responsive layout for 1024px, 768px, 480px, 360px (navbar wrap, cards grid, safe area insets)**
- [ ] **Step 4: Ensure touch targets have min 44px height and table containers have smooth horizontal scroll**

---

### Task 4: Client-Side Logic, iOS Audio Fallback & Ngrok Bypass
**Files:**
- Modify: `frontend/app.js`

- [ ] **Step 1: Implement `openExtensionModal()` and `closeExtensionModal()`**
- [ ] **Step 2: Update `toggleMicRecord()` with robust MIME type detection (`audio/webm`, `audio/mp4`, `audio/aac`, default)**
- [ ] **Step 3: Add `'ngrok-skip-browser-warning': 'true'` to all `fetch` helper calls**

---

### Task 5: End-to-End Verification Across Devices
- [ ] **Step 1: Verify ZIP download on localhost & Ngrok public URL**
- [ ] **Step 2: Verify responsive rendering on desktop and mobile viewport sizes**
- [ ] **Step 3: Confirm all existing features (Manual, Upload Media, Social Links, API status) remain 100% operational**
