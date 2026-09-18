/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   app.js â€” CyberBully Detector V11 Frontend Logic (Multimodal Engine)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// ── Unified API Base (Vercel Serverless & Local Dev) ─────────────
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || window.location.port === '5500') {
    return 'http://localhost:8000';
  }
  // Di Vercel: frontend & backend FastAPI terpadu di domain yang sama (zero CORS!)
  return window.location.origin;
})();

// ── WebSocket Helper ─────────────────────────────────────────────
function connectWebSocket() {
  try {
    const isLocal = (typeof window !== 'undefined') &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5500');
    if (!isLocal) {
      // Di cloud Vercel Serverless, update real-time ditangani langsung via REST API
      return;
    }
    const wsUrl = 'ws://localhost:8000/ws/stream';

    wsConn = new WebSocket(wsUrl);
    wsConn.onopen = () => {
      console.log('âš¡ WebSocket stream connected to', wsUrl);
    };
    wsConn.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'ping') return;
        console.log('Live WS event received:', msg);
        if (typeof addLiveCard === 'function') addLiveCard(msg);
      } catch (e) {}
    };
    wsConn.onclose = () => { setTimeout(connectWebSocket, 10000); };
    wsConn.onerror = () => {};
  } catch (e) {
    console.warn('WS Init notice:', e);
  }
}

// â”€â”€ Wake-Up Overlay (HF Spaces Cold Start) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _wakeUpOverlay = null;
let _retryTimer    = null;
let _retrySec      = 0;

function _showWakeOverlay() {
  if (_wakeUpOverlay) return;
  _wakeUpOverlay = document.createElement('div');
  _wakeUpOverlay.id = 'hf-wake-overlay';
  _wakeUpOverlay.innerHTML = `
    <div style="
      position:fixed;inset:0;z-index:99999;
      background:rgba(10,14,26,0.93);
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      font-family:'Inter',sans-serif;
    ">
      <div style="font-size:52px;margin-bottom:16px;">ðŸ›¡ï¸</div>
      <h2 style="color:#f0f6ff;margin:0 0 8px;font-size:1.4rem;">Membangunkan AI Engine...</h2>
      <p style="color:#94a3b8;font-size:0.95rem;margin:0 0 24px;text-align:center;max-width:340px;">
        Server sedang dalam mode tidur (free tier).<br>Tunggu sebentar, sistem akan aktif dalam <b id="wake-countdown">60</b> detik.
      </p>
      <div style="width:280px;height:6px;background:#1e293b;border-radius:99px;overflow:hidden;">
        <div id="wake-bar" style="height:100%;background:linear-gradient(90deg,#059669,#10b981);width:0%;transition:width 5s linear;border-radius:99px;"></div>
      </div>
      <p style="color:#64748b;font-size:0.78rem;margin:16px 0 0;">Retry otomatis setiap 5 detik...</p>
    </div>
  `;
  document.body.appendChild(_wakeUpOverlay);
  _retrySec = 60;
  _tickWakeOverlay();
}

function _tickWakeOverlay() {
  const el = document.getElementById('wake-countdown');
  const bar = document.getElementById('wake-bar');
  if (el) el.textContent = Math.max(0, _retrySec);
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '0%';
    setTimeout(() => { bar.style.transition = 'width 5s linear'; bar.style.width = '100%'; }, 50);
  }
  _retrySec = Math.max(0, _retrySec - 5);
}

function _hideWakeOverlay() {
  if (_wakeUpOverlay) {
    _wakeUpOverlay.style.opacity = '0';
    _wakeUpOverlay.style.transition = 'opacity 0.5s ease';
    setTimeout(() => { if (_wakeUpOverlay) { _wakeUpOverlay.remove(); _wakeUpOverlay = null; } }, 600);
  }
  if (_retryTimer) { clearInterval(_retryTimer); _retryTimer = null; }
}

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let currentTab       = 'manual';
let currentMediaType = 'video';

let pdfFile          = null;
let excelFile        = null;
let excelData        = [];

let videoFile        = null;
let audioFile        = null;
let imageFile        = null;

let mediaRecorder    = null;
let recordedChunks   = [];
let recordInterval   = null;
let recordSeconds    = 0;

let scoresChart      = null;
let modelEvalChart   = null;
let currentEvalTab   = 'metrics';
let wsConn           = null;
let batchAllRows     = [];
let liveCount        = 0;

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', () => {
  checkAPIStatus();
  initTabs();
  initUploadZones();
  initSliders();
  initCharCounter();
  initModelEvalChart();
  
  // Standby visualization for result panels
  if (document.getElementById('gauge-canvas')) {
    drawGauge(0, false);
  }
  if (document.getElementById('scores-chart')) {
    renderScoresChart({});
  }

  connectWebSocket();
  setInterval(checkAPIStatus, 15000);

  // Check if opened from Extension
  if (window.location.search.includes('import=extension')) {
    switchSocialTab('paste');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('dashboardImport', data => {
        if (data && data.dashboardImport && data.dashboardImport.texts) {
          const texts = data.dashboardImport.texts;
          const input = document.getElementById('raw-content-input');
          if (input) input.value = texts.join('\n');
          setTimeout(analyzeRawContent, 300);
        }
      });
    }
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// API Status Check
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function checkAPIStatus() {
  const dot   = document.getElementById('status-dot');
  const text  = document.getElementById('status-text');
  const badge = document.getElementById('model-mode-badge');
  try {
    const resp = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (resp.ok) {
      const data = await resp.json();
      // API online â€” hide wake overlay if showing
      _hideWakeOverlay();
      if (dot)   dot.className = 'status-dot online';
      if (text)  text.textContent = 'API Online';
      if (badge) {
        const isReal = data.mode && data.mode.includes('real');
        badge.textContent = isReal ? 'ðŸŸ¢ Real Trimodal V12' : 'ðŸŸ¡ Simulated + Stacking';
        badge.style.background = isReal ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)';
      }
    } else {
      _handleOffline(dot, text, badge);
    }
  } catch (e) {
    _handleOffline(dot, text, badge);
  }
}

function _handleOffline(dot, text, badge) {
  setOffline(dot, text, badge);
  // Show wake overlay only on production (HF Space might be sleeping)
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5500';
  if (!isLocal) {
    _showWakeOverlay();
    _tickWakeOverlay();
    if (!_retryTimer) {
      _retryTimer = setInterval(() => {
        _tickWakeOverlay();
        checkAPIStatus();
      }, 5000);
    }
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Extension Guide Modal (Windows, macOS, iOS, Android)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openExtensionModal() {
  const modal = document.getElementById('ext-guide-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeExtensionModal() {
  const modal = document.getElementById('ext-guide-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function switchGuideTab(os) {
  const tabs = ['desktop', 'mobile', 'ios'];
  tabs.forEach(t => {
    const btn = document.getElementById(`mtab-${t}`);
    const pane = document.getElementById(`gpane-${t}`);
    if (btn) btn.classList.toggle('active', t === os);
    if (pane) pane.style.display = t === os ? 'block' : 'none';
  });
}

function setOffline(dot, text, badge) {
  if (dot) dot.className = 'status-dot offline';
  if (text) text.textContent = 'API Offline';
  if (badge) {
    badge.textContent = 'ðŸ”´ Tidak Terhubung';
    badge.style.background = 'rgba(239,68,68,0.1)';
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 3 Simple Cards Selection Logic (Homepage Mode Switcher)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function selectCardMode(mode) {
  // 1. Update active card styling
  document.querySelectorAll('.simple-action-card').forEach(card => {
    card.classList.remove('active');
  });
  const activeCard = document.getElementById(`card-trigger-${mode}`);
  if (activeCard) activeCard.classList.add('active');

  // 2. Hide all workspace contents and show target
  const contents = ['manual', 'doc', 'web'];
  contents.forEach(m => {
    const el = document.getElementById(`mode-content-${m}`);
    if (el) el.style.display = m === mode ? 'block' : 'none';
  });

  // 3. Update dynamic workstation headers
  const tagEl = document.getElementById('active-card-tag');
  const titleEl = document.getElementById('active-card-title');
  const subEl = document.getElementById('active-card-subtitle');

  if (mode === 'manual') {
    tagEl.textContent = 'MODE 1: INPUT MANUAL';
    titleEl.textContent = 'Analisis Teks Manual';
    subEl.textContent = 'Ketik atau paste teks komentar untuk langsung dianalisis oleh model Trimodal AI';
  } else if (mode === 'doc') {
    tagEl.textContent = 'MODE 2: UPLOAD FILE & MEDIA';
    titleEl.textContent = 'Upload File Video, Audio, Dokumen Excel, CSV & PDF';
    subEl.textContent = 'Unggah berbagai format multimedia dan dataset untuk analisis multimodal otomatis';
  } else if (mode === 'web') {
    tagEl.textContent = 'MODE 3: DARI LINK / SOSMED';
    titleEl.textContent = 'Scraper Link Media Sosial & Ekstensi Real-Time';
    subEl.textContent = 'Paste link konten YouTube, Twitter, IG, atau Facebook';
  }

  // 4. Smooth scroll into workstation
  const ws = document.getElementById('workspace-container');
  if (ws) {
    ws.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function switchDocSubTab(type) {
  document.querySelectorAll('#mode-content-doc .sub-tab-btn').forEach(b => {
    b.classList.toggle('active', b.id === `subtab-${type}`);
  });
  document.querySelectorAll('.doc-subzone').forEach(z => {
    z.style.display = z.id === `doc-subzone-${type}` ? 'block' : 'none';
  });
}

function switchWebSubTab(type) {
  document.querySelectorAll('#mode-content-web .sub-tab-btn').forEach(b => {
    b.classList.toggle('active', b.id === `subtab-${type}`);
  });
  document.querySelectorAll('.web-subzone').forEach(z => {
    z.style.display = z.id === `web-subzone-${type}` ? 'block' : 'none';
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Tab Navigation (Legacy & Filter Chips fallback)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-content-${tab}`);
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Media Type Switcher (Trimodal Tab)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function switchMediaType(type) {
  currentMediaType = type;
  document.querySelectorAll('.media-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.media === type);
  });
  document.querySelectorAll('.media-subzone').forEach(z => {
    z.style.display = z.id === `subzone-${type}` ? 'block' : 'none';
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Char Counter & Sliders
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initCharCounter() {
  const ta = document.getElementById('manual-text');
  const cc = document.getElementById('char-count');
  if (ta && cc) {
    ta.addEventListener('input', () => {
      cc.textContent = ta.value.length;
    });
  }
}

function initSliders() {
  const ap = document.getElementById('audio-prob');
  const av = document.getElementById('audio-val');
  if (ap && av) {
    ap.addEventListener('input', function() {
      av.textContent = parseFloat(this.value).toFixed(2);
    });
  }

  const vp = document.getElementById('visual-prob');
  const vv = document.getElementById('visual-val');
  if (vp && vv) {
    vp.addEventListener('input', function() {
      vv.textContent = parseFloat(this.value).toFixed(2);
    });
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Upload Zones (drag & drop)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initUploadZones() {
  setupDrop('pdf-dropzone', 'pdf-input');
  setupDrop('excel-dropzone', 'excel-input');
  setupDrop('video-dropzone', 'video-input');
  setupDrop('audio-dropzone', 'audio-input');
  setupDrop('image-dropzone', 'image-input');
}

function setupDrop(zoneId, inputId) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Media Upload Handlers (Video, Audio, Image)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function handleVideoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  videoFile = file;
  document.getElementById('video-filename').textContent = file.name;
  const player = document.getElementById('video-player');
  player.src = URL.createObjectURL(file);
  document.getElementById('video-preview-box').style.display = 'block';
  document.getElementById('video-dropzone').style.display = 'none';
}

function clearVideo() {
  videoFile = null;
  document.getElementById('video-input').value = '';
  document.getElementById('video-player').src = '';
  document.getElementById('video-preview-box').style.display = 'none';
  document.getElementById('video-dropzone').style.display = 'block';
}

function handleAudioUpload(input) {
  const file = input.files[0];
  if (!file) return;
  audioFile = file;
  document.getElementById('audio-filename').textContent = file.name;
  const player = document.getElementById('audio-player');
  player.src = URL.createObjectURL(file);
  document.getElementById('audio-preview-box').style.display = 'block';
  document.getElementById('audio-dropzone').style.display = 'none';
}

function clearAudio() {
  audioFile = null;
  document.getElementById('audio-input').value = '';
  document.getElementById('audio-player').src = '';
  document.getElementById('audio-preview-box').style.display = 'none';
  document.getElementById('audio-dropzone').style.display = 'block';
}

function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  imageFile = file;
  document.getElementById('image-filename').textContent = file.name;
  const img = document.getElementById('image-preview');
  img.src = URL.createObjectURL(file);
  document.getElementById('image-preview-box').style.display = 'block';
  document.getElementById('image-dropzone').style.display = 'none';
}

function clearImage() {
  imageFile = null;
  document.getElementById('image-input').value = '';
  document.getElementById('image-preview').src = '';
  document.getElementById('image-preview-box').style.display = 'none';
  document.getElementById('image-dropzone').style.display = 'block';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Live Microphone Recording (Multi-Platform: iOS Safari, Android, Mac, Windows)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function toggleMicRecord() {
  const btn = document.getElementById('btn-record-mic');
  const timer = document.getElementById('record-time');

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    // Stop recording
    mediaRecorder.stop();
    btn.classList.remove('recording');
    document.getElementById('record-btn-text').textContent = 'Rekam Mikrofon';
    clearInterval(recordInterval);
    timer.style.display = 'none';
  } else {
    // Start recording with multi-platform MIME detection
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser Anda tidak mendukung akses mikrofon atau tidak dalam protokol aman (HTTPS).');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];

      let selectedMime = '';
      let fileExt = 'webm';

      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          selectedMime = 'audio/webm;codecs=opus';
          fileExt = 'webm';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          selectedMime = 'audio/webm';
          fileExt = 'webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          selectedMime = 'audio/mp4';
          fileExt = 'mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          selectedMime = 'audio/aac';
          fileExt = 'aac';
        }
      }

      const recorderOptions = selectedMime ? { mimeType: selectedMime } : {};
      mediaRecorder = new MediaRecorder(stream, recorderOptions);
      const actualMime = mediaRecorder.mimeType || selectedMime || 'audio/webm';

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: actualMime });
        const ext = actualMime.includes('mp4') ? 'mp4' : (actualMime.includes('aac') ? 'aac' : fileExt);
        audioFile = new File([blob], `mic_recording.${ext}`, { type: actualMime });
        document.getElementById('audio-filename').textContent = `ðŸŽ¤ mic_recording.${ext}`;
        const player = document.getElementById('audio-player');
        if (player) {
          player.src = URL.createObjectURL(blob);
          document.getElementById('audio-preview-box').style.display = 'block';
          document.getElementById('audio-dropzone').style.display = 'none';
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      btn.classList.add('recording');
      document.getElementById('record-btn-text').textContent = 'â¹ Berhenti Rekam';
      timer.style.display = 'inline';
      recordSeconds = 0;
      timer.textContent = '00:00';
      recordInterval = setInterval(() => {
        recordSeconds++;
        const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
        const s = String(recordSeconds % 60).padStart(2, '0');
        timer.textContent = `${m}:${s}`;
      }, 1000);
    } catch(err) {
      showToast('âŒ Gagal mengakses mikrofon: ' + err.message, 'error');
    }
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Quick Test Presets
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function setQuickTest(type) {
  const ta = document.getElementById('manual-text');
  if (type === 'bully') {
    ta.value = 'Dasar bodoh dan tidak berguna! Pergi aja dari sini, muka lo jelek banget, semua orang benci lo!';
    document.getElementById('audio-prob').value = 0.85;
    document.getElementById('audio-val').textContent = '0.85';
    document.getElementById('visual-prob').value = 0.78;
    document.getElementById('visual-val').textContent = '0.78';
  } else {
    ta.value = 'Selamat ulang tahun ya! Semoga selalu sehat, bahagia, dan sukses di setiap langkah hidupmu.';
    document.getElementById('audio-prob').value = 0.15;
    document.getElementById('audio-val').textContent = '0.15';
    document.getElementById('visual-prob').value = 0.10;
    document.getElementById('visual-val').textContent = '0.10';
  }
  document.getElementById('char-count').textContent = ta.value.length;
}

function setQuickMediaTest(preset) {
  const captionInput = document.getElementById('multimodal-text-caption');
  if (preset === 'bully_video') {
    switchMediaType('video');
    captionInput.value = "Rekaman video labrak: 'Jangan sok kepintaran kamu ya anak baru sialan!'";
  } else if (preset === 'bully_meme') {
    switchMediaType('image');
    captionInput.value = "Meme ejekan fisik: 'Muka kayak sendal jepit mau ikutan ekskul model'";
  } else {
    switchMediaType('video');
    captionInput.value = "Video pembelajaran sekolah: 'Ayo saling menghargai dan berteman dengan baik.'";
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// URL Platform Examples
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function setUrlExample(platform) {
  const examples = {
    youtube:   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    twitter:   'https://twitter.com/example/status/1',
    instagram: 'https://www.instagram.com/p/example/',
    facebook:  'https://www.facebook.com/example/posts/1',
    tiktok:    'https://www.tiktok.com/@example/video/1',
  };
  document.getElementById('url-input').value = examples[platform] || '';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANALYZE: Manual Text
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function analyzeManual() {
  const text = document.getElementById('manual-text').value.trim();
  if (!text) { showToast('âš ï¸ Masukkan teks terlebih dahulu!', 'warn'); return; }
  const audioEl  = document.getElementById('audio-prob');
  const visualEl = document.getElementById('visual-prob');
  const audio  = audioEl ? parseFloat(audioEl.value) : 0.50;
  const visual = visualEl ? parseFloat(visualEl.value) : 0.50;

  showLoading('Menganalisis teks...');
  try {
    const resp = await fetchAPI('/predict', 'POST', { text, audio_prob: audio, visual_prob: visual });
    showSingleResult(resp, text);
  } catch(e) {
    showToast(`âŒ Error: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANALYZE: Trimodal Media (Video, Audio, Image)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function analyzeTrimodal() {
  const caption = document.getElementById('multimodal-text-caption').value.trim();
  
  if (!videoFile && !audioFile && !imageFile && !caption) {
    showToast('âš ï¸ Pilih file Video, Audio, Gambar, atau masukkan teks caption!', 'warn');
    return;
  }

  showLoading('Mengekstrak frame video, audio speech, dan melakukan fusi Trimodal Stacking...');
  try {
    const fd = new FormData();
    if (caption) fd.append('custom_text', caption);
    if (videoFile) fd.append('video_file', videoFile);
    if (audioFile) fd.append('audio_file', audioFile);
    if (imageFile) fd.append('image_file', imageFile);

    const resp = await fetchFormData('/predict-multimodal', fd);
    showSingleResult(resp, caption || resp.text_preview);
  } catch(e) {
    showToast(`âŒ Error Multimodal: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function analyzeVideoDirect() {
  if (!videoFile) {
    showToast('âš ï¸ Silakan drop atau pilih file Video terlebih dahulu!', 'warn');
    return;
  }
  const caption = document.getElementById('video-caption') ? document.getElementById('video-caption').value.trim() : '';
  showLoading('Mengekstrak frame video, mendeteksi speech & menganalisis...');
  try {
    const fd = new FormData();
    fd.append('video_file', videoFile);
    if (caption) fd.append('custom_text', caption);
    const resp = await fetchFormData('/predict-video', fd);
    showSingleResult(resp, caption || resp.text_preview || videoFile.name);
  } catch(e) {
    showToast(`âŒ Error Video: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function analyzeAudioDirect() {
  if (!audioFile && recordedChunks.length === 0) {
    showToast('âš ï¸ Silakan upload file Audio atau rekam suara melalui Mikrofon!', 'warn');
    return;
  }
  showLoading('Memproses Whisper Speech-to-Text & analisis akustik audio...');
  try {
    const fd = new FormData();
    if (audioFile) {
      fd.append('audio_file', audioFile);
    } else if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      fd.append('audio_file', blob, 'recorded_audio.webm');
    }
    const resp = await fetchFormData('/predict-audio', fd);
    showSingleResult(resp, resp.text_preview || 'Audio Voice Sample');
  } catch(e) {
    showToast(`âŒ Error Audio: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function analyzeImageDirect() {
  if (!imageFile) {
    showToast('âš ï¸ Silakan drop atau pilih file Gambar terlebih dahulu!', 'warn');
    return;
  }
  showLoading('Mengekstrak OCR teks & menganalisis sentimen visual gambar...');
  try {
    const fd = new FormData();
    fd.append('image_file', imageFile);
    const resp = await fetchFormData('/predict-image', fd);
    showSingleResult(resp, resp.text_preview || imageFile.name);
  } catch(e) {
    showToast(`âŒ Error Gambar: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANALYZE: PDF
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function handlePDFUpload(input) {
  const file = input.files[0];
  if (!file) return;
  pdfFile = file;
  document.getElementById('pdf-filename').textContent = file.name;
  document.getElementById('pdf-info').style.display = 'block';
  document.getElementById('pdf-dropzone').style.display = 'none';
  document.getElementById('btn-pdf-analyze').disabled = false;
}

function clearPDF() {
  pdfFile = null;
  document.getElementById('pdf-input').value = '';
  document.getElementById('pdf-info').style.display = 'none';
  document.getElementById('pdf-dropzone').style.display = 'block';
  document.getElementById('btn-pdf-analyze').disabled = true;
}

async function analyzePDF() {
  if (!pdfFile) return;
  showLoading(`Membaca PDF: ${pdfFile.name}...`);
  try {
    const fd = new FormData();
    fd.append('file', pdfFile);
    const resp = await fetchFormData('/predict-pdf', fd);
    showBatchResults(resp.results, `PDF: ${resp.filename}`, resp.bullying_count, resp.total_segments);
  } catch(e) {
    showToast(`âŒ Error: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANALYZE: Excel / CSV
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function handleExcelUpload(input) {
  const file = input.files[0];
  if (!file) return;
  excelFile = file;
  document.getElementById('excel-filename').textContent = file.name;
  document.getElementById('excel-info').style.display = 'block';
  document.getElementById('excel-dropzone').style.display = 'none';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const colSel = document.getElementById('excel-column');
      colSel.innerHTML = '';
      if (excelData.length > 0) {
        const cols = Object.keys(excelData[0]);
        cols.forEach(col => {
          const opt = document.createElement('option');
          opt.value = col;
          opt.textContent = col;
          if (/text|teks|komen|comment|content|isi/i.test(col)) opt.selected = true;
          colSel.appendChild(opt);
        });
        const previewCol = colSel.value;
        const sample = excelData.slice(0,3).map(r => r[previewCol]).join(' | ');
        document.getElementById('excel-preview-text').textContent = `${excelData.length} baris Â· Preview: ${sample}`;
      }
      document.getElementById('btn-excel-analyze').disabled = false;
    } catch(err) {
      showToast('âŒ Gagal membaca file Excel/CSV', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

document.addEventListener('DOMContentLoaded', () => {
  const colSel = document.getElementById('excel-column');
  if (colSel) {
    colSel.addEventListener('change', function() {
      if (excelData.length > 0) {
        const sample = excelData.slice(0,3).map(r => r[this.value]).join(' | ');
        document.getElementById('excel-preview-text').textContent = `${excelData.length} baris Â· Preview: ${sample}`;
      }
    });
  }
});

function clearExcel() {
  excelFile = null;
  excelData = [];
  document.getElementById('excel-input').value = '';
  document.getElementById('excel-info').style.display = 'none';
  document.getElementById('excel-dropzone').style.display = 'block';
  document.getElementById('btn-excel-analyze').disabled = true;
}

async function analyzeExcel() {
  if (!excelFile || excelData.length === 0) return;
  const column = document.getElementById('excel-column').value;
  const texts = excelData.map(row => String(row[column] || '')).filter(t => t.trim());

  showLoading(`Menganalisis ${texts.length} baris dari ${excelFile.name}...`);
  try {
    const resp = await fetchAPI('/predict-batch', 'POST', { texts, audio_prob: 0.5, visual_prob: 0.5 });
    showBatchResults(resp.results, `Excel: ${excelFile.name} [${column}]`, resp.bullying_count, resp.total);
  } catch(e) {
    showToast(`âŒ Error: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANALYZE: URL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function analyzeURL() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { showToast('âš ï¸ Masukkan URL terlebih dahulu!', 'warn'); return; }

  showLoading('Scraping URL media...');
  try {
    const resp = await fetchAPI('/predict-url', 'POST', { url });
    showBatchResults(resp.results, `URL: ${resp.platform.toUpperCase()} Â· ${url.substring(0, 60)}...`, resp.bullying_count, resp.total_segments);
  } catch(e) {
    showToast(`âŒ Error scraping: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANALYZE: RAW HTML / TEXT COMMENTS FROM EXTENSION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function switchSocialTab(tab) {
  const btnUrl = document.getElementById('tab-btn-url');
  const btnPaste = document.getElementById('tab-btn-paste');
  const contentUrl = document.getElementById('social-content-url');
  const contentPaste = document.getElementById('social-content-paste');

  if (tab === 'url') {
    if (btnUrl) {
      btnUrl.style.background = 'var(--bg-card)';
      btnUrl.style.color = 'var(--text-main)';
      btnUrl.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
    }
    if (btnPaste) {
      btnPaste.style.background = 'transparent';
      btnPaste.style.color = 'var(--text-muted)';
      btnPaste.style.boxShadow = 'none';
    }
    if (contentUrl) contentUrl.style.display = 'block';
    if (contentPaste) contentPaste.style.display = 'none';
  } else {
    if (btnPaste) {
      btnPaste.style.background = 'var(--bg-card)';
      btnPaste.style.color = 'var(--text-main)';
      btnPaste.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
    }
    if (btnUrl) {
      btnUrl.style.background = 'transparent';
      btnUrl.style.color = 'var(--text-muted)';
      btnUrl.style.boxShadow = 'none';
    }
    if (contentUrl) contentUrl.style.display = 'none';
    if (contentPaste) contentPaste.style.display = 'block';
  }
}

function setRawExample(type) {
  const input = document.getElementById('raw-content-input');
  if (!input) return;

  if (type === 'comments') {
    input.value = [
      'Perundungan Pelajar SMP di Karangtalun, Orang Tua Diimbau Tingkatkan Pengawasan',
      'The face of 3 bullying perpetrators in SMK, disgusting behaviour!',
      'Muka jelek kayak gini kok berani tampil di sosmed sih, mending mati aja',
      'Terima kasih atas konten edukasinya yang sangat bermanfaat',
      'Viral, Lagi dan lagi, kasus perundungan siswa SMP kembali terjadi di lingkungan sekolah',
      'Dasar anak haram ga berguna, minggir lu dari sini',
      'Keren banget semangat terus ya belajarnya!'
    ].join('\n');
  } else if (type === 'html') {
    input.value = `<div class="feed-container">
  <div class="user-post">
    <h3>Berita Cilacap</h3>
    <p>Aksi Perundungan Parah: Haruskah Aturan Sekolah Diperketat?</p>
  </div>
  <div class="comment-item">
    <span class="user">Agus</span>
    <span class="comment-text">Dasar bocah gila lu, mati aja sekalian di jalanan!</span>
  </div>
  <div class="comment-item">
    <span class="user">Siti</span>
    <span class="comment-text">Semoga korban segera mendapatkan perlindungan dan keadilan.</span>
  </div>
  <div class="comment-item">
    <span class="user">Rian</span>
    <span class="comment-text">Lu goblok banget sih jadi orang, ga ada otaknya sama sekali</span>
  </div>
</div>`;
  }
}

async function analyzeRawContent() {
  const rawInput = document.getElementById('raw-content-input')?.value || '';
  if (!rawInput.trim()) {
    showToast('âš ï¸ Masukkan atau paste teks / kode HTML terlebih dahulu!', 'warn');
    return;
  }

  let texts = [];

  // Check if input is HTML
  if (/<[a-z][\s\S]*>/i.test(rawInput)) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawInput, 'text/html');

      // Remove script, style, nav, header, footer
      doc.querySelectorAll('script, style, nav, header, footer, noscript, svg').forEach(el => el.remove());

      // Extract all meaningful text nodes from block elements
      const elements = doc.querySelectorAll('p, span, div, li, h1, h2, h3, h4, blockquote, article, section');
      const seen = new Set();

      elements.forEach(el => {
        const t = (el.innerText || el.textContent || '').trim();
        if (t.length >= 6 && !seen.has(t)) {
          const hasIdenticalChild = Array.from(el.children).some(c => (c.textContent || '').trim() === t);
          if (!hasIdenticalChild) {
            seen.add(t);
            texts.push(t);
          }
        }
      });

      if (texts.length === 0) {
        const bodyText = doc.body.innerText || doc.body.textContent || '';
        texts = bodyText.split('\n').map(t => t.trim()).filter(t => t.length >= 5);
      }
    } catch (err) {
      console.warn('HTML parse error, fallback to line split:', err);
      texts = rawInput.split('\n').map(t => t.trim()).filter(t => t.length >= 4);
    }
  } else {
    texts = rawInput.split('\n').map(t => t.trim()).filter(t => t.length >= 4);
  }

  texts = Array.from(new Set(texts)).slice(0, 200);

  if (texts.length === 0) {
    showToast('âš ï¸ Tidak ada teks valid yang dapat diekstrak.', 'warn');
    return;
  }

  showLoading(`Menganalisis ${texts.length} data teks / HTML terekstrak...`);
  try {
    const resp = await fetchAPI('/predict-batch', 'POST', { texts, audio_prob: 0.5, visual_prob: 0.5 });
    showBatchResults(resp.results, `ðŸ“‹ Hasil Ekstraksi (${texts.length} Konten)`, resp.bullying_count, resp.total);
    showToast(`âœ… Berhasil menganalisis ${texts.length} teks/komentar!`, 'success');
  } catch (e) {
    showToast(`âŒ Error: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Display: Single Result (with Multimodal Inspection)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function showSingleResult(data, originalText) {
  const welcomeEl = document.getElementById('welcome-state');
  if (welcomeEl) welcomeEl.style.display = 'none';

  const resultEl = document.getElementById('single-result');
  if (resultEl) resultEl.style.display = 'block';

  const isBully = Boolean(data.is_bullying);
  const conf    = Number(data.confidence || 0);
  const scores  = data.modality_scores || {};

  // Label badge
  const badge = document.getElementById('result-label-badge');
  if (badge) {
    badge.textContent = isBully ? 'â— CYBERBULLYING' : 'â— NON-BULLYING';
    badge.className = `label-pill ${isBully ? 'bullying' : 'safe'}`;
    badge.style.background = '';
    badge.style.color = '';
    badge.style.border = '';
  }

  // Modality & Meta badge
  const modBadge = document.getElementById('result-modality-badge');
  if (modBadge) modBadge.textContent = data.modality_type ? data.modality_type.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim() : 'Text Multimodal';

  const modeBadge = document.getElementById('result-mode-badge');
  if (modeBadge) modeBadge.textContent = `Engine: ${data.mode || 'Trimodal'}`;

  const timeEl = document.getElementById('result-time');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('id-ID');

  const threshEl = document.getElementById('gauge-threshold-label');
  if (threshEl) threshEl.textContent = `Threshold: ${data.threshold || 0.45}`;

  // Gauge
  drawGauge(conf, isBully);
  const gaugeVal = document.getElementById('gauge-value');
  if (gaugeVal) gaugeVal.textContent = `${(conf * 100).toFixed(1)}%`;

  // Bar chart (All 5 Modalities + Trimodal Late Fusion Stacking)
  renderScoresChart(scores);

  // Multimodal Extraction Details
  const mmBox = document.getElementById('multimodal-details-box');
  const mmGrid = document.getElementById('multimodal-items-grid');
  const mmDetails = data.multimodal_details;
  
  if (mmBox && mmGrid) {
    if (mmDetails && Object.keys(mmDetails).length > 0) {
      mmBox.style.display = 'block';
      let cardsHtml = '';

      if (mmDetails.video || mmDetails.modality === 'trimodal_video') {
        const v = mmDetails.video || mmDetails;
        cardsHtml += `
          <div class="multimodal-item-card">
            <div class="multimodal-item-title">ðŸŽ¥ Video Keyframes & Info</div>
            <div class="multimodal-item-desc">${v.video_info ? `Frames: ${v.video_info.total_frames || 4} | Size: ${v.video_info.filesize_mb || 0}MB` : 'Frame stream processed'}</div>
            ${v.extracted_speech ? `<div style="margin-top:4px;color:#047857;"><strong>ðŸŽ™ï¸ Speech:</strong> ${escHtml(v.extracted_speech)}</div>` : ''}
            ${v.extracted_ocr ? `<div style="margin-top:2px;color:#059669;"><strong>ðŸ–¼ï¸ OCR Subtitles:</strong> ${escHtml(v.extracted_ocr)}</div>` : ''}
          </div>
        `;
      }

      if (mmDetails.audio || mmDetails.modality === 'audio') {
        const a = mmDetails.audio || mmDetails;
        cardsHtml += `
          <div class="multimodal-item-card">
            <div class="multimodal-item-title">ðŸŽ™ï¸ Audio Speech-to-Text & Acoustic Cue</div>
            <div class="multimodal-item-desc">${a.transcribed_text ? `"${escHtml(a.transcribed_text)}"` : 'Audio acoustic stream evaluated'}</div>
            ${a.cues && a.cues.length ? `<div style="font-size:0.7rem;color:#d97706;margin-top:2px;">${a.cues.join(' Â· ')}</div>` : ''}
          </div>
        `;
      }

      if (mmDetails.visual || mmDetails.modality === 'visual') {
        const img = mmDetails.visual || mmDetails;
        cardsHtml += `
          <div class="multimodal-item-card">
            <div class="multimodal-item-title">ðŸ–¼ï¸ Visual OCR & Image Sentiment</div>
            <div class="multimodal-item-desc">${img.extracted_text ? `"${escHtml(img.extracted_text)}"` : 'Image visual feature space analyzed'}</div>
            ${img.visual_cues && img.visual_cues.length ? `<div style="font-size:0.7rem;color:#d97706;margin-top:2px;">${img.visual_cues.join(' Â· ')}</div>` : ''}
          </div>
        `;
      }

      mmGrid.innerHTML = cardsHtml || '<div class="multimodal-item-card">Media multimodal berhasil diproses.</div>';
    } else {
      mmBox.style.display = 'none';
    }
  }

  // Text preview
  const preview = originalText || data.text_preview || '';
  const textPrevEl = document.getElementById('result-text-preview');
  if (textPrevEl) {
    textPrevEl.textContent = preview.length > 300 ? preview.substring(0, 300) + '...' : preview;
    textPrevEl.style.fontStyle = 'normal';
    textPrevEl.style.color = 'var(--text-main)';
  }

  // Keywords
  const kwBox  = document.getElementById('keywords-box');
  const kwList = document.getElementById('keywords-list');
  const hits   = data.keywords_hit || [];
  if (kwBox && kwList) {
    if (hits.length > 0) {
      kwBox.style.display = 'block';
      kwList.innerHTML = hits.map(kw => `<span class="preset-chip chip-red" style="font-size:11px;">${kw}</span>`).join(' ');
    } else {
      kwBox.style.display = 'none';
    }
  }

  // Edukasi Pencegahan Cyberbullying Kontekstual
  const eduContainer = document.getElementById('education-guidance-container');
  if (eduContainer) {
    eduContainer.innerHTML = generateCyberbullyingEducation(isBully, conf, preview, data.modality_type);
  }
}


// â”€â”€ Gauge (Canvas arc) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawGauge(value, isBully) {
  const canvas = document.getElementById('gauge-canvas');
  const ctx    = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.85;
  const r  = 110;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const startAngle = Math.PI;
  const endAngle   = 2 * Math.PI;

  // Background arc (PipelinePro Neutral Border #E4E4E7)
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Threshold mark (PipelinePro Tertiary Orange #F97316)
  const thresholdAngle = startAngle + 0.45 * Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, thresholdAngle - 0.015, thresholdAngle + 0.015);
  ctx.strokeStyle = '#F97316';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Value arc
  const valAngle = startAngle + value * Math.PI;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  if (isBully) {
    gradient.addColorStop(0, '#F59E0B');
    gradient.addColorStop(0.45, '#F97316');
    gradient.addColorStop(1, '#EF4444');
  } else {
    gradient.addColorStop(0, '#06B6D4');
    gradient.addColorStop(0.5, '#4F46E5');
    gradient.addColorStop(1, '#22C55E');
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valAngle);
  ctx.lineWidth = 18;
  ctx.strokeStyle = gradient;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Needle
  const needleAngle = Math.PI + value * Math.PI;
  const nx = cx + (r - 22) * Math.cos(needleAngle);
  const ny = cy + (r - 22) * Math.sin(needleAngle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = isBully ? '#EF4444' : '#4F46E5';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#18181B';
  ctx.fill();
}

// â”€â”€ Model Evaluation Comparison Chart (Default Right Panel) â”€â”€â”€â”€â”€â”€
function initModelEvalChart() {
  const canvas = document.getElementById('model-eval-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (modelEvalChart) modelEvalChart.destroy();

  const labels = ['IndoBERT', 'Indo-Tweet', 'Transcript', 'HEALNet 2024', 'Tri-modal MLP'];
  modelEvalChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'F1-Score (%)',
          data: [88.08, 85.43, 84.06, 88.46, 88.42],
          backgroundColor: '#059669', // Emerald Green
          borderRadius: 5,
        },
        {
          label: 'Akurasi (%)',
          data: [89.07, 86.66, 85.48, 89.44, 89.43],
          backgroundColor: '#D97706', // Amber Gold
          borderRadius: 5,
        },
        {
          label: 'AUC-ROC (%)',
          data: [94.80, 93.10, 92.50, 95.80, 95.76],
          backgroundColor: '#78716C', // Warm Stone
          borderRadius: 5,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            font: { family: 'Inter', size: 11, weight: '600' },
            color: '#1C1917'
          }
        },
        tooltip: {
          backgroundColor: '#1C1917',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont: { family: 'Source Code Pro', size: 12 },
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}%`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#78716C',
            font: { family: 'Inter', size: 10.5, weight: '600' }
          },
          grid: { display: false }
        },
        y: {
          min: 80,
          max: 100,
          ticks: {
            color: '#78716C',
            font: { family: 'Source Code Pro', size: 10 },
            callback: v => `${v}%`
          },
          grid: { color: '#E7E0D5' }
        }
      }
    }
  });
}

function showEvaluationChart() {
  document.getElementById('single-result').style.display = 'none';
  document.getElementById('welcome-state').style.display = 'block';
  setTimeout(() => {
    if (modelEvalChart) {
      modelEvalChart.resize();
    } else {
      initModelEvalChart();
    }
  }, 50);
}

// â”€â”€ Professional Simple Bar Chart Diagram â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let scoresChartInstance = null;

function renderScoresChart(scores = {}, modality = 'auto') {
  const canvas = document.getElementById('scores-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Determine if pure text or multimodal
  const isPureText = modality === 'text' || 
                     window.location.pathname.includes('manual.html') ||
                     (modality === 'auto' && !scores.audio && !scores.visual && !scores.image);

  let labels = [];
  let rawValues = [];

  const isEmpty = Object.keys(scores).length === 0;

  if (isPureText) {
    labels = [
      'IndoBERT',
      'Indo-Tweet',
      'mBERT',
      'Ensemble Fusion'
    ];
    rawValues = [
      scores.indobert          || 0,
      scores.indobertweet      || 0,
      scores.mbert             || 0,
      scores.trimodal_stacking || 0,
    ];
  } else {
    labels = [
      'IndoBERT',
      'Indo-Tweet',
      'mBERT',
      'Whisper (Audio)',
      'EffNet (Visual)',
      'Trimodal Fusion'
    ];
    rawValues = [
      scores.indobert          || 0,
      scores.indobertweet      || 0,
      scores.mbert             || 0,
      scores.audio             || 0,
      scores.visual            || 0,
      scores.trimodal_stacking || 0,
    ];
  }

  // Adjust container height dynamically
  const chartContainer = canvas.parentElement;
  if (chartContainer) {
    chartContainer.style.height = isPureText ? '180px' : '220px';
  }

  // Calibrated threshold based on model mode (0.53 for text fallback, 0.68 for trimodal)
  const currentThreshold = Number(scores.threshold || (isPureText ? 0.53 : 0.68));

  // Colors per bar based on probability threshold
  const championIndex = rawValues.length - 1;
  const barColors = rawValues.map((val, idx) => {
    if (isEmpty) return '#D6D3D1';
    if (idx === championIndex) {
      return val >= currentThreshold ? '#DC2626' : '#047857'; // Champion
    }
    return val >= currentThreshold ? '#EF4444' : '#059669';   // Base models
  });

  // Custom Chart.js Plugin for vertical bar chart (threshold line & top value labels)
  const proChartPlugin = {
    id: 'proChartPlugin',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart;

      // 1. Draw Horizontal Dashed Threshold Line
      const thresholdY = y.getPixelForValue(currentThreshold);
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.moveTo(left, thresholdY);
      ctx.lineTo(right, thresholdY);
      ctx.stroke();

      // Threshold tag at right
      ctx.fillStyle = '#D97706';
      ctx.font = '600 9.5px "Source Code Pro", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${(currentThreshold * 100).toFixed(0)}% THRESHOLD`, right, thresholdY - 5);
      ctx.restore();

      // 2. Draw inline value badges above each bar
      const datasetMeta = chart.getDatasetMeta(0);
      datasetMeta.data.forEach((bar, index) => {
        const val = rawValues[index];
        const text = isEmpty ? '0%' : `${(val * 100).toFixed(1)}%`;
        const barX = bar.x;
        const barY = bar.y;

        ctx.save();
        ctx.font = '700 11px "Source Code Pro", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        if (index === championIndex) {
          ctx.fillStyle = val >= 0.45 ? '#DC2626' : '#047857';
        } else {
          ctx.fillStyle = val >= 0.45 ? '#DC2626' : '#059669';
        }

        // Draw label right above the bar top
        const labelY = Math.max(barY - 4, top + 10);
        ctx.fillText(text, barX, labelY);
        ctx.restore();
      });
    }
  };

  if (scoresChartInstance) {
    scoresChartInstance.destroy();
  }

  scoresChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: rawValues,
          backgroundColor: barColors,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          barThickness: isPureText ? 36 : 24,
          maxBarThickness: 44,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: isEmpty ? 0 : 350,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: { top: 22, right: 12, left: 0, bottom: 0 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(28, 25, 23, 0.94)',
          titleFont: { family: 'Inter', size: 12, weight: '700' },
          bodyFont: { family: 'Source Code Pro', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: items => items[0].label,
            label: item => {
              const val = item.raw;
              const status = val >= 0.45 ? 'Cyberbullying' : 'Aman';
              return ` Probabilitas: ${(val * 100).toFixed(1)}% (${status})`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: {
            color: '#292524',
            font: { family: 'Inter', size: 11, weight: '600' },
            padding: 6,
          }
        },
        y: {
          min: 0,
          max: 1.0,
          grid: {
            color: '#EAE3D9',
            drawBorder: false,
          },
          ticks: {
            color: '#78716C',
            font: { family: 'Source Code Pro', size: 10, weight: '600' },
            stepSize: 0.2,
            callback: v => `${(v * 100).toFixed(0)}%`
          }
        }
      }
    },
    plugins: [proChartPlugin]
  });
}

// â”€â”€ Minimalist Step Timeline Education Generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function generateCyberbullyingEducation(isBully, conf, text = '', modality = 'text') {
  if (isBully) {
    const lower = (text || '').toLowerCase();
    let subcategory = 'Ujaran Kasar di Media Sosial';
    let contextNote = 'Konten mengandung indikasi perundungan berdasarkan analisis NLP.';
    if (/bodoh|goblok|tolol|idiot|bego|cacat|buta|jelek|gendut|buruk/i.test(lower)) {
      subcategory = 'Pelecehan Verbal & Body Shaming';
      contextNote = 'Terdeteksi kata-kata merendahkan fisik atau kemampuan seseorang.';
    } else if (/mati|bunuh|hajar|pukul|awas|bakar|ancam/i.test(lower)) {
      subcategory = 'Intimidasi & Ancaman Kekerasan';
      contextNote = 'Terdeteksi ancaman atau ajakan kekerasan yang membahayakan.';
    } else if (/lonte|pelacur|bitch|anjing|babi|bangsat|sialan/i.test(lower)) {
      subcategory = 'Pencemaran Nama Baik & Ujaran Kebencian';
      contextNote = 'Terdeteksi kata-kata ofensif yang melanggar norma dan etika komunikasi.';
    }

    const steps = [
      { num: '01', title: 'Dokumentasikan Bukti',   desc: 'Ambil tangkapan layar postingan, identitas akun pelaku, tautan URL, dan waktu kejadian sebagai bukti sah.' },
      { num: '02', title: 'Hindari Membalas Emosional', desc: 'Hentikan interaksi langsung dengan pelaku untuk mencegah eskalasi konflik di ruang publik.' },
      { num: '03', title: 'Laporkan & Blokir Akun', desc: 'Gunakan fitur Report / Laporkan pada platform terkait, lalu aktifkan pemblokiran akun pelaku.' },
      { num: '04', title: 'Konsultasi & Cari Dukungan', desc: 'Bicarakan kejadian ini kepada pihak sekolah, konselor, atau orang tua untuk penanganan lanjutan.' },
    ];

    const stepsHtml = steps.map((s, i) => `
      <div class="edu-step">
        <div class="edu-step-line-col">
          <div class="edu-step-circle danger-step" style="font-family:var(--font-mono);font-size:11px;">${s.num}</div>
          ${i < steps.length - 1 ? '<div class="edu-step-connector danger-line"></div>' : ''}
        </div>
        <div class="edu-step-content">
          <div class="edu-step-title">${s.title}</div>
          <div class="edu-step-desc">${s.desc}</div>
        </div>
      </div>`).join('');

    return `
      <div class="edu-timeline-wrap">
        <div class="edu-timeline-header">
          <div class="edu-timeline-header-icon danger-bg" style="font-family:var(--font-mono);font-weight:800;font-size:13px;color:#B91C1C;">!</div>
          <div>
            <div class="edu-timeline-title">Panduan Mitigasi: ${subcategory}</div>
            <div class="edu-timeline-subtitle" style="color:#DC2626">${contextNote}</div>
          </div>
          <span class="edu-badge-pill danger">Tindakan Diperlukan</span>
        </div>
        <div class="edu-steps">${stepsHtml}</div>
        <div class="edu-hotline-strip">
          <span class="edu-hotline-label">Layanan Bantuan:</span>
          <span class="edu-hotline-chip">Hotline SAPA 129</span>
          <span class="edu-hotline-chip">WhatsApp 08111-129-129</span>
          <span class="edu-hotline-chip">aduankonten.id</span>
        </div>
      </div>`;
  } else {
    const pctAman = ((1 - conf) * 100).toFixed(1);
    const steps = [
      { num: '01', title: 'Prinsip T.H.I.N.K',       desc: 'Sebelum membagikan konten, pastikan bernilai True (Benar), Helpful (Bermanfaat), Inspiring, Necessary, dan Kind (Santun).' },
      { num: '02', title: 'Peran Upstander Aktif',   desc: 'Bila melihat perundungan daring di sekitar, dukung korban secara privat dan bantu laporkan konten yang melanggar.' },
      { num: '03', title: 'Proteksi Data & Privasi', desc: 'Jaga kerahasiaan identitas pribadi dan hindari menyebarkan informasi sensitif di kolom komentar terbuka.' },
    ];

    const stepsHtml = steps.map((s, i) => `
      <div class="edu-step">
        <div class="edu-step-line-col">
          <div class="edu-step-circle success-step" style="font-family:var(--font-mono);font-size:11px;">${s.num}</div>
          ${i < steps.length - 1 ? '<div class="edu-step-connector success-line"></div>' : ''}
        </div>
        <div class="edu-step-content">
          <div class="edu-step-title">${s.title}</div>
          <div class="edu-step-desc">${s.desc}</div>
        </div>
      </div>`).join('');

    return `
      <div class="edu-timeline-wrap">
        <div class="edu-timeline-header">
          <div class="edu-timeline-header-icon success-bg" style="font-family:var(--font-mono);font-weight:800;font-size:13px;color:#047857;">âœ“</div>
          <div>
            <div class="edu-timeline-title">Literasi Digital: Budaya Komunikasi Positif</div>
            <div class="edu-timeline-subtitle" style="color:#059669">Teks bebas dari indikasi perundungan (${pctAman}% aman).</div>
          </div>
          <span class="edu-badge-pill success">Lingkungan Positif</span>
        </div>
        <div class="edu-steps">${stepsHtml}</div>
      </div>`;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Display: Batch Results
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function showBatchResults(results, sourceLabel, bullyCount, total) {
  batchAllRows = results || [];
  document.getElementById('batch-section').style.display = 'block';
  document.getElementById('batch-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

  const safe = total - bullyCount;
  const rate = total > 0 ? ((bullyCount / total) * 100).toFixed(1) : 0;
  document.getElementById('batch-summary').textContent = `${sourceLabel}`;

  document.getElementById('batch-stats-row').innerHTML = `
    <div class="bstat-card total"><div class="bstat-val">${total}</div><div class="bstat-lbl">Total Data</div></div>
    <div class="bstat-card danger"><div class="bstat-val">${bullyCount}</div><div class="bstat-lbl">ðŸ”´ Bullying</div></div>
    <div class="bstat-card safe"><div class="bstat-val">${safe}</div><div class="bstat-lbl">ðŸŸ¢ Aman</div></div>
    <div class="bstat-card rate"><div class="bstat-val">${rate}%</div><div class="bstat-lbl">Rasio Bullying</div></div>
  `;

  renderBatchTable(batchAllRows);
}

function renderBatchTable(rows) {
  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = '';
  rows.forEach((r, i) => {
    const isBully = r.is_bullying;
    const s = r.modality_scores || {};
    const conf = (r.confidence * 100).toFixed(1);
    const tr = document.createElement('tr');
    if (isBully) tr.classList.add('row-bully');
    tr.innerHTML = `
      <td style="font-family:var(--font-mono);color:var(--text-muted)">${r.row || r.index || (i+1)}</td>
      <td title="${escHtml(r.text_preview || '')}">${escHtml((r.text_preview || 'â€”').substring(0, 70))}${(r.text_preview || '').length > 70 ? '...' : ''}</td>
      <td>${isBully
        ? '<span class="badge-bully">ðŸ”´ Bullying</span>'
        : '<span class="badge-safe">ðŸŸ¢ Aman</span>'
      }</td>
      <td>
        <div class="conf-bar-wrap">
          <div class="conf-bar" style="width:${conf}px;max-width:70px;background:${isBully ? '#ef4444' : '#10b981'}"></div>
          <span class="conf-val">${conf}%</span>
        </div>
      </td>
      <td style="font-family:var(--font-mono);font-size:0.75rem">${pct(s.indobert)}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem">${pct(s.indobertweet)}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem">${pct(s.mbert)}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem">${pct(s.audio)}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem">${pct(s.visual)}</td>
      <td style="font-family:var(--font-mono);font-size:0.78rem;font-weight:700;color:${isBully ? '#fca5a5' : '#6ee7b7'}">${pct(s.trimodal_stacking)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function pct(val) {
  return val != null ? `${(val * 100).toFixed(1)}%` : 'â€”';
}

function filterBatchTable() {
  const search = document.getElementById('batch-search').value.toLowerCase();
  const filter = document.getElementById('batch-filter').value;
  let rows = batchAllRows;
  if (filter === 'bullying') rows = rows.filter(r => r.is_bullying);
  if (filter === 'safe')     rows = rows.filter(r => !r.is_bullying);
  if (search) rows = rows.filter(r => (r.text_preview || '').toLowerCase().includes(search));
  renderBatchTable(rows);
}

function exportCSV() {
  if (!batchAllRows.length) return;
  const headers = ['No', 'Teks / Konten', 'Label', 'Confidence', 'IndoBERT', 'IndoBERT-Tweet', 'mBERT', 'Audio', 'Visual', 'Trimodal Stacking'];
  const csvRows = [headers.join(',')];
  batchAllRows.forEach((r, i) => {
    const s = r.modality_scores || {};
    csvRows.push([
      i + 1,
      `"${(r.text_preview || '').replace(/"/g, '""')}"`,
      r.label,
      r.confidence,
      s.indobert          || 0,
      s.indobertweet      || 0,
      s.mbert             || 0,
      s.audio             || 0,
      s.visual            || 0,
      s.trimodal_stacking || 0,
    ].join(','));
  });
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cyberbully_trimodal_results_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WebSocket (live feed from extension) â€” social.html
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function connectWebSocket() {
  // Note: top-level connectWebSocket() already handles production vs local.
  // This function is kept for social.html backward compatibility.
  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5500';
    if (!isLocal) {
      console.log('Vercel Serverless environment: Live cards updated via direct REST API.');
      return;
    }
    const wsUrl = 'ws://localhost:8000/ws/stream';
    wsConn = new WebSocket(wsUrl);
    wsConn.onopen    = () => console.log('WS live feed connected:', wsUrl);
    wsConn.onmessage = e => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'ping') return;
        addLiveCard(data);
      } catch {}
    };
    wsConn.onclose = () => setTimeout(connectWebSocket, 5000);
    wsConn.onerror = () => wsConn.close();
  } catch {}
}

function addLiveCard(data) {
  const grid  = document.getElementById('live-feed-grid');
  const empty = document.getElementById('live-empty');
  if (empty) empty.remove();

  liveCount++;
  const isBully = data.is_bullying;
  const card    = document.createElement('div');
  card.className = `live-card ${isBully ? 'bullying' : 'safe'}`;
  card.innerHTML = `
    <div class="live-card-header">
      <span class="live-platform-chip">${data.platform || 'web'}</span>
      <span class="live-conf">${(data.confidence * 100).toFixed(1)}%</span>
    </div>
    <p class="live-text">${escHtml(data.text_preview || data.text || 'â€”')}</p>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.5rem">
      <span>${isBully ? '<span class="badge-bully">ðŸ”´ Bullying</span>' : '<span class="badge-safe">ðŸŸ¢ Aman</span>'}</span>
      <span class="live-time">${new Date().toLocaleTimeString('id-ID')}</span>
    </div>
  `;

  grid.insertBefore(card, grid.firstChild);
  const cards = grid.querySelectorAll('.live-card');
  if (cards.length > 50) cards[cards.length - 1].remove();
}

function clearFeed() {
  const grid = document.getElementById('live-feed-grid');
  grid.innerHTML = `
    <div class="live-empty" id="live-empty">
      <span>ðŸ”Œ</span>
      <p>Belum ada data dari Extension. Install dan aktifkan Chrome Extension, lalu buka halaman media sosial.</p>
    </div>
  `;
  liveCount = 0;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Loading & API Helpers (Modern Multi-Stage Animated Progress)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let loadingProgressTimer = null;
let currentProgress = 0;

function showLoading(msg = 'Menganalisis Data...') {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;

  const txtEl    = document.getElementById('loading-text');
  const stepTag  = document.getElementById('loading-step-tag');
  const stageLbl = document.getElementById('loading-stage-lbl');
  const pctEl    = document.getElementById('loading-pct');
  const fillEl   = document.getElementById('loading-progress-fill');

  if (txtEl) txtEl.textContent = msg;
  overlay.style.display = 'flex';

  const ws = document.getElementById('welcome-state');
  if (ws) ws.style.display = 'none';

  // Animate progress smoothly across pipeline stages
  currentProgress = 15;
  if (fillEl) fillEl.style.width = '15%';
  if (pctEl) pctEl.textContent = '15%';
  if (stepTag) stepTag.textContent = 'Step 1/3: Tokenization & Embedding';
  if (stageLbl) stageLbl.textContent = 'Membaca dan memvalidasi input...';

  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  loadingProgressTimer = setInterval(() => {
    if (currentProgress < 90) {
      currentProgress += Math.floor(Math.random() * 12) + 6;
      if (currentProgress > 90) currentProgress = 90;

      if (fillEl) fillEl.style.width = `${currentProgress}%`;
      if (pctEl) pctEl.textContent = `${currentProgress}%`;

      if (currentProgress >= 35 && currentProgress < 70) {
        if (stepTag) stepTag.textContent = 'Step 2/3: Model Inferencing (IndoBERT + Whisper)';
        if (stageLbl) stageLbl.textContent = 'Mengekstrak fitur modalitas teks/audio...';
      } else if (currentProgress >= 70) {
        if (stepTag) stepTag.textContent = 'Step 3/3: Late Fusion Meta-Stacking';
        if (stageLbl) stageLbl.textContent = 'Menghitung probabilitas staking...';
      }
    }
  }, 160);
}

function hideLoading() {
  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  const fillEl   = document.getElementById('loading-progress-fill');
  const pctEl    = document.getElementById('loading-pct');
  const stepTag  = document.getElementById('loading-step-tag');
  const stageLbl = document.getElementById('loading-stage-lbl');

  if (fillEl) fillEl.style.width = '100%';
  if (pctEl) pctEl.textContent = '100%';
  if (stepTag) stepTag.textContent = 'âœ“ Analisis Selesai';
  if (stageLbl) stageLbl.textContent = 'Menampilkan hasil...';

  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }, 220);
}

async function fetchAPI(endpoint, method, body) {
  const resp = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function fetchFormData(endpoint, formData) {
  const resp = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'ngrok-skip-browser-warning': 'true'
    },
    body: formData,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function showToast(msg, type = 'info') {
  const colors = { info: '#3b82f6', warn: '#f59e0b', error: '#ef4444', success: '#10b981' };
  const toast  = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
    background:#0d1321;border:1px solid ${colors[type]};
    color:#f0f6ff;border-radius:10px;padding:0.75rem 1.2rem;
    font-size:0.88rem;font-family:var(--font-body);
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
    animation:fadeSlide 0.3s ease;max-width:340px;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


