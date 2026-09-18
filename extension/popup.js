// popup.js â€” CyberBully Detector Extension Popup Logic

const API_BASE = 'https://muzakir17-cyberbully-v12.hf.space'; // Production HF Space

let stats = { scanned: 0, bullying: 0, safe: 0 };
let recentItems = [];

// â”€â”€ DOM Initialization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', async () => {
  // Bind Event Listeners (Fix Manifest V3 CSP Inline script block)
  bindEvents();

  // Load initial data
  await checkAPI();
  await detectPlatform();
  await loadStats();
  loadToggleState();
});

function bindEvents() {
  const btnScanAll = document.getElementById('btn-scan-all') || document.getElementById('btn-scan');
  if (btnScanAll) btnScanAll.addEventListener('click', scanAllNow);

  const btnSendDash = document.getElementById('btn-send-dashboard');
  if (btnSendDash) btnSendDash.addEventListener('click', sendToDashboardNow);

  const btnExpand = document.getElementById('btn-expand');
  if (btnExpand) btnExpand.addEventListener('click', expandAll);

  const btnCopyClean = document.getElementById('btn-copy-clean');
  if (btnCopyClean) btnCopyClean.addEventListener('click', copyCleanComments);

  const btnViewSource = document.getElementById('btn-view-source');
  if (btnViewSource) btnViewSource.addEventListener('click', viewPageSource);

  const autoToggle = document.getElementById('auto-toggle');
  if (autoToggle) autoToggle.addEventListener('change', toggleAuto);

  const btnClear = document.getElementById('btn-clear');
  if (btnClear) btnClear.addEventListener('click', clearRecent);
}

// â”€â”€ Ensure Content Script is Injected â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function ensureContentScript(tabId) {
  try {
    // Try pinging first
    const ping = await chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => null);
    if (ping && ping.ok) return true;

    // Not loaded yet -> inject programmatically
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    // Give it a tiny moment to register listeners
    await new Promise(r => setTimeout(r, 200));
    return true;
  } catch (err) {
    console.warn('[CBD] Cannot inject content script into tab:', err);
    return false;
  }
}

// â”€â”€ API Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function checkAPI() {
  const dot = document.getElementById('api-dot');
  const mode = document.getElementById('footer-mode');
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const data = await r.json();
      dot.className = 'api-dot online';
      dot.title = `API Online (${data.mode === 'real' ? 'Model Asli' : 'Simulated Multimodal'})`;
      mode.textContent = data.mode === 'real' ? 'ðŸŸ¢ Model Aktif' : 'ðŸŸ¡ Simulated AI';
    } else {
      dot.className = 'api-dot offline';
      dot.title = 'API Offline';
      mode.textContent = 'ðŸ”´ API Offline';
    }
  } catch {
    dot.className = 'api-dot offline';
    dot.title = 'API Offline (Jalankan start_all.bat)';
    mode.textContent = 'ðŸ”´ API Offline';
  }
}

// â”€â”€ Platform Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function detectPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url   = tab?.url || '';
    const platformBadge = document.getElementById('platform-badge');
    const platformUrl   = document.getElementById('platform-url');

    platformUrl.textContent = url.length > 45 ? url.substring(0, 45) + '...' : (url || 'â€”');

    if (url.includes('facebook.com'))       platformBadge.textContent = 'Æ’ Facebook â€” Postingan & Komentar';
    else if (url.includes('youtube.com'))   platformBadge.textContent = 'â–¶ YouTube â€” Komentar & Reply';
    else if (url.includes('twitter.com') || url.includes('x.com'))
                                            platformBadge.textContent = 'ð• Twitter/X â€” Tweet & Balasan';
    else if (url.includes('instagram.com')) platformBadge.textContent = 'ðŸ“· Instagram â€” Post & Komentar';
    else if (url.includes('tiktok.com'))    platformBadge.textContent = 'â™ª TikTok â€” Komentar';
    else if (url.includes('threads.net'))   platformBadge.textContent = 'ðŸ§µ Threads â€” Diskusi & Balasan';
    else if (url.startsWith('http'))        platformBadge.textContent = 'ðŸŒ Website Publik â€” Artikel & Komentar';
    else {
      platformBadge.textContent = 'âš ï¸ Halaman Sistem Browser';
      platformBadge.style.color = '#d97706';
    }
  } catch (e) {
    document.getElementById('platform-badge').textContent = 'â“ Tidak terdeteksi';
  }
}

// â”€â”€ Load/Save Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadStats() {
  const data = await chrome.storage.local.get(['stats', 'recent']);
  if (data.stats) {
    stats = data.stats;
    updateStatsUI();
  }
  if (data.recent) {
    recentItems = data.recent;
    renderRecent();
  }
}

function updateStatsUI() {
  const elScanned = document.getElementById('stat-scanned');
  const elBully   = document.getElementById('stat-bully');
  const elSafe    = document.getElementById('stat-safe');

  if (elScanned) elScanned.textContent = stats.scanned;
  if (elBully)   elBully.textContent   = stats.bullying;
  if (elSafe)    elSafe.textContent    = stats.safe;
}

function renderRecent() {
  const list = document.getElementById('recent-list');
  if (!list) return;

  if (!recentItems || recentItems.length === 0) {
    list.innerHTML = '<div class="recent-empty">Belum ada deteksi pada sesi ini.</div>';
    return;
  }

  list.innerHTML = recentItems.slice(0, 15).map(item => `
    <div class="recent-item ${item.is_bullying ? 'bullying' : 'safe'}" title="${item.is_bullying ? 'Terdeteksi Cyberbullying' : 'Teks Aman'}">
      <div class="recent-dot"></div>
      <span class="recent-text">${escHtml(item.text)}</span>
      <span class="recent-conf">${(item.confidence * 100).toFixed(0)}%</span>
    </div>
  `).join('');
}

function clearRecent() {
  recentItems = [];
  stats = { scanned: 0, bullying: 0, safe: 0 };
  chrome.storage.local.set({ recent: [], stats });
  updateStatsUI();
  renderRecent();
}

// â”€â”€ Toggle Auto-Scan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadToggleState() {
  chrome.storage.local.get('autoScan', data => {
    const toggle = document.getElementById('auto-toggle');
    if (toggle) toggle.checked = data.autoScan !== false;
  });
}

function toggleAuto() {
  const toggle = document.getElementById('auto-toggle');
  const enabled = toggle ? toggle.checked : true;
  chrome.storage.local.set({ autoScan: enabled });

  chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
    if (tabs[0] && tabs[0].id) {
      await ensureContentScript(tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleAuto', enabled }).catch(() => {});
    }
  });
}

// â”€â”€ Unified 1-Click Complete Pipeline (Expand Deep + Scan Text + Video Media) â”€â”€
async function scanAllNow() {
  const btn = document.getElementById('btn-scan-all') || document.getElementById('btn-scan');
  const btnText = document.getElementById('btn-scan-all-text') || document.getElementById('btn-scan-text') || btn;
  btn.disabled = true;
  const originalText = btnText.textContent;
  btnText.textContent = 'Membuka & Menganalisis...';
  showProgress(15, 'Menghubungkan ke halaman aktif...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showProgress(0, 'âŒ Tab aktif tidak ditemukan.');
      return;
    }

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      showProgress(0, 'âš ï¸ Tidak dapat memindai halaman internal browser.');
      return;
    }

    await ensureContentScript(tab.id);

    // 1. Deep Auto-Expand all comments & replies to the roots
    showProgress(25, '1/3: Membuka seluruh komentar & balasan sampai ke akar...');
    await chrome.tabs.sendMessage(tab.id, { action: 'expandAllDeep' }).catch(() => null);

    // 2. Scan Comments & Text
    showProgress(55, '2/3: Memindai teks seluruh komentar & postingan...');
    const textResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }).catch(() => null);

    // 3. Scan Videos & Media Frames
    showProgress(85, '3/3: Menganalisis frame video & audio/subtitle (Trimodal)...');
    const mediaResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scanMedia' }).catch(() => null);

    let totalFound = 0;
    let newBully = 0;

    // Process Text Results
    if (textResponse && textResponse.results && textResponse.results.length > 0) {
      textResponse.results.forEach(r => {
        recentItems.unshift({
          text: (r.text || '').substring(0, 80),
          confidence: r.confidence || 0.5,
          is_bullying: !!r.is_bullying
        });
        stats.scanned++;
        if (r.is_bullying) { stats.bullying++; newBully++; } else stats.safe++;
        totalFound++;
      });
    }

    // Process Media Results
    if (mediaResponse && mediaResponse.results && mediaResponse.results.length > 0) {
      mediaResponse.results.forEach(r => {
        recentItems.unshift({
          text: `[${r.type === 'video' ? 'ðŸŽ¥ Video' : 'ðŸ–¼ï¸ Media'}] ${(r.text_preview || r.modality_type || '').substring(0, 60)}`,
          confidence: r.confidence || 0.5,
          is_bullying: !!r.is_bullying
        });
        stats.scanned++;
        if (r.is_bullying) { stats.bullying++; newBully++; } else stats.safe++;
        totalFound++;
      });
    }

    if (totalFound > 0) {
      recentItems = recentItems.slice(0, 100);
      await chrome.storage.local.set({ recent: recentItems, stats });
      updateStatsUI();
      renderRecent();
      showProgress(100, `âœ… Sukses! ${totalFound} konten dianalisis (${newBully} perundungan).`);
    } else {
      showProgress(100, 'â„¹ï¸ Tidak ada konten baru yang perlu dipindai.');
    }
  } catch (err) {
    console.error(err);
    showProgress(0, 'âŒ Terjadi kesalahan saat memindai halaman.');
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btnText.textContent = originalText;
      hideProgress();
    }, 2500);
  }
}

// â”€â”€ Expand All Comments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function expandAll() {
  const btn = document.getElementById('btn-expand');
  const btnText = document.getElementById('btn-expand-text');
  btn.disabled = true;
  btnText.textContent = 'Membuka seluruh komentar...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await ensureContentScript(tab.id);
      await chrome.tabs.sendMessage(tab.id, { action: 'expandAll' }).catch(() => {});
    }
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btnText.textContent = 'Buka Semua Komentar & Balasan';
    }, 2000);
  }
}

// â”€â”€ View Page Source (Live DOM) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function viewPageSource() {
  const btn = document.getElementById('btn-view-source');
  const btnText = document.getElementById('btn-source-text');
  btn.disabled = true;
  btnText.textContent = 'Mengambil...';
  showProgress(30, 'Mengambil Page Source DOM...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showProgress(0, 'âŒ Tab tidak ditemukan.');
      return;
    }

    await ensureContentScript(tab.id);
    showProgress(70, 'Mengekstrak struktur HTML...');

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageSource' }).catch(() => null);

    if (response && response.ok && response.html) {
      await chrome.storage.local.set({ activeSource: response });
      showProgress(100, 'Membuka Source Viewer...');
      chrome.tabs.create({ url: chrome.runtime.getURL('source-viewer.html') });
    } else {
      showProgress(0, 'âš ï¸ Gagal mengambil DOM live. Membuka native view-source...');
      if (tab.url && tab.url.startsWith('http')) {
        chrome.tabs.create({ url: `view-source:${tab.url}` });
      }
    }
  } catch (err) {
    console.error(err);
    showProgress(0, 'âŒ Gagal membuka page source.');
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btnText.textContent = 'View Page Source';
      hideProgress();
    }, 2000);
  }
}

// â”€â”€ Scan Video Frames & Meme Images (Trimodal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function scanMediaNow() {
  const btn = document.getElementById('btn-scan-media');
  const btnText = document.getElementById('btn-media-text');
  btn.disabled = true;
  btnText.textContent = 'Memindai Media...';
  showProgress(25, 'Menangkap frame video & OCR meme...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showProgress(0, 'âŒ Tab tidak ditemukan.');
      return;
    }

    await ensureContentScript(tab.id);
    showProgress(60, 'Menganalisis visual & OCR...');

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanMedia' }).catch(() => null);

    if (response && response.results && response.results.length > 0) {
      const results = response.results;
      results.forEach(r => {
        recentItems.unshift({
          text: `[${r.type === 'video' ? 'ðŸŽ¥ Video' : 'ðŸ–¼ï¸ Meme'}] ${(r.text_preview || r.modality_type || '').substring(0, 60)}`,
          confidence: r.confidence || 0.5,
          is_bullying: !!r.is_bullying
        });
        stats.scanned++;
        if (r.is_bullying) stats.bullying++; else stats.safe++;
      });

      await chrome.storage.local.set({ recent: recentItems.slice(0, 100), stats });
      updateStatsUI();
      renderRecent();

      const bullyCount = results.filter(r => r.is_bullying).length;
      showProgress(100, `âœ… ${results.length} media dianalisis (${bullyCount} bully).`);
    } else {
      showProgress(100, 'â„¹ï¸ Tidak ditemukan elemen video/gambar baru.');
    }
  } catch (err) {
    console.error(err);
    showProgress(0, 'âŒ Terjadi kesalahan saat memindai media.');
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btnText.textContent = 'Scan Video & Gambar Meme';
      hideProgress();
    }, 2500);
  }
}

// â”€â”€ Send Entire Page Dataset to Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendToDashboardNow() {
  const btn = document.getElementById('btn-send-dashboard');
  const btnText = document.getElementById('btn-dash-text');
  btn.disabled = true;
  btnText.textContent = 'Menyiapkan Data...';
  showProgress(35, 'Mengumpulkan data komentar & post...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showProgress(0, 'âŒ Tab tidak ditemukan.');
      return;
    }

    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getDashboardDataset' }).catch(() => null);

    if (response && response.ok && response.texts && response.texts.length > 0) {
      // Simpan dataset ke storage agar dibaca dashboard
      await chrome.storage.local.set({ dashboardImport: response });
      showProgress(100, `ðŸš€ Mengirim ${response.total} data ke Dashboard...`);

      // Buka dashboard social.html
      chrome.tabs.create({ url: 'http://localhost:5500/social.html?import=extension' });
    } else {
      showProgress(0, 'âš ï¸ Belum ada teks komentar yang terdeteksi di halaman ini.');
    }
  } catch (err) {
    console.error(err);
    showProgress(0, 'âŒ Gagal mengirim ke dashboard.');
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btnText.textContent = 'Buka & Analisis di Dashboard';
      hideProgress();
    }, 2000);
  }
}

// â”€â”€ Copy Clean Comments Text (Ready to Paste) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function copyCleanComments() {
  const btn = document.getElementById('btn-copy-clean');
  const btnText = document.getElementById('btn-copy-clean-text');
  btn.disabled = true;
  btnText.textContent = 'Menyalin...';
  showProgress(40, 'Mengekstrak teks bersih...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showProgress(0, 'âŒ Tab tidak ditemukan.');
      return;
    }

    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCleanText' }).catch(() => null);

    if (response && response.ok && response.combined_text) {
      await navigator.clipboard.writeText(response.combined_text);
      showProgress(100, `âœ… ${response.total} teks komentar disalin! Siap di-paste.`);
    } else {
      showProgress(0, 'âš ï¸ Tidak ada komentar yang ditemukan.');
    }
  } catch (err) {
    console.error(err);
    showProgress(0, 'âŒ Gagal menyalin teks.');
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btnText.textContent = 'Salin Teks';
      hideProgress();
    }, 2500);
  }
}

// â”€â”€ Progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showProgress(pct, text) {
  const row = document.getElementById('progress-row');
  const fill = document.getElementById('progress-fill');
  const txt = document.getElementById('progress-text');
  if (row) row.style.display = 'flex';
  if (fill) fill.style.width = `${pct}%`;
  if (txt) txt.textContent = text;
}

function hideProgress() {
  const row = document.getElementById('progress-row');
  if (row) row.style.display = 'none';
}

// â”€â”€ Utils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// â”€â”€ Listen for updates from background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'newResult') {
    recentItems.unshift({
      text: (msg.text || '').substring(0, 80),
      confidence: msg.confidence || 0.5,
      is_bullying: !!msg.is_bullying
    });
    stats.scanned++;
    if (msg.is_bullying) stats.bullying++; else stats.safe++;
    if (recentItems.length > 100) recentItems = recentItems.slice(0, 100);
    updateStatsUI();
    renderRecent();
  }
});


