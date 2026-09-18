// source-viewer.js — Dedicated Live DOM Source Viewer

let currentSource = '';
let currentUrl = '';
let currentTitle = '';

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get('activeSource');
  const sourceObj = data.activeSource || {};

  currentSource = sourceObj.html || '<!-- Tidak ada konten source yang ditemukan. Buka halaman web dan klik View Page Source kembali. -->';
  currentUrl    = sourceObj.url || 'about:blank';
  currentTitle  = sourceObj.title || 'Page Source';

  // Set Info & Meta
  document.title = `Source: ${currentTitle}`;
  const elMeta = document.getElementById('sv-meta');
  if (elMeta) elMeta.textContent = `${currentTitle} · Diambil: ${new Date(sourceObj.timestamp || Date.now()).toLocaleTimeString()}`;

  const elLink = document.getElementById('sv-url-link');
  if (elLink) {
    elLink.href = currentUrl;
    elLink.textContent = currentUrl;
  }

  const elSize = document.getElementById('sv-size-badge');
  if (elSize) elSize.textContent = `${(currentSource.length / 1024).toFixed(1)} KB`;

  const lineCount = (currentSource.match(/\n/g) || []).length + 1;
  const elLines = document.getElementById('sv-lines-badge');
  if (elLines) elLines.textContent = `${lineCount.toLocaleString()} baris`;

  const elPlat = document.getElementById('sv-platform-badge');
  if (elPlat) elPlat.textContent = (sourceObj.platform || 'universal').toUpperCase();

  // Render Source Code
  renderSource(currentSource);

  // Setup Event Listeners
  setupEvents();
});

function renderSource(text) {
  const codeEl = document.getElementById('sv-code-content');
  if (codeEl) {
    codeEl.textContent = text;
  }
}

function setupEvents() {
  // Copy button
  const btnCopy = document.getElementById('btn-copy');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentSource);
        showToast('✅ Seluruh source HTML berhasil disalin ke clipboard!');
      } catch {
        showToast('❌ Gagal menyalin.');
      }
    });
  }

  // Download button
  const btnDownload = document.getElementById('btn-download');
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      const blob = new Blob([currentSource], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const safeTitle = (currentTitle || 'page-source').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      a.href     = url;
      a.download = `source_${safeTitle}_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 File HTML berhasil diunduh!');
    });
  }

  // Native view-source button
  const btnNative = document.getElementById('btn-native');
  if (btnNative) {
    btnNative.addEventListener('click', () => {
      if (currentUrl && currentUrl.startsWith('http')) {
        chrome.tabs.create({ url: `view-source:${currentUrl}` });
      } else {
        showToast('⚠️ URL tidak valid untuk native view-source');
      }
    });
  }

  // Search filter
  const searchInput = document.getElementById('sv-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      handleSearch(e.target.value.trim());
    }, 250));
  }
}

function handleSearch(query) {
  const codeEl = document.getElementById('sv-code-content');
  const countEl = document.getElementById('sv-match-count');
  if (!codeEl) return;

  if (!query) {
    codeEl.textContent = currentSource;
    if (countEl) countEl.textContent = '';
    return;
  }

  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const matches = currentSource.match(regex);
    const count = matches ? matches.length : 0;

    if (countEl) countEl.textContent = `${count} cocok`;

    if (count > 0 && count < 2000) {
      const safeText = escHtml(currentSource);
      const highlighted = safeText.replace(new RegExp(`(${escHtml(query)})`, 'gi'), '<mark>$1</mark>');
      codeEl.innerHTML = highlighted;
    } else {
      codeEl.textContent = currentSource;
    }
  } catch {
    codeEl.textContent = currentSource;
  }
}

function showToast(msg) {
  const toast = document.getElementById('sv-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'sv-toast show';
  setTimeout(() => {
    toast.className = 'sv-toast';
  }, 2500);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
