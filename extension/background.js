// background.js â€” Service Worker untuk CyberBully Detector Extension

// API Base: production HF Space (fallback ke localhost untuk pengembangan lokal)
const HF_SPACE_URL = 'https://muzakir17-cyberbully-v12.hf.space';
const API_BASE = HF_SPACE_URL; // Untuk produksi. Ubah ke 'http://localhost:8000' untuk dev lokal.

// â”€â”€ Request Queue (hindari spam API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const queue      = [];
let isProcessing = false;
const BATCH_SIZE = 10;
const DELAY_MS   = 100;
let bullyCount   = 0;

// â”€â”€ Listen dari content scripts & popup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'predict') {
    queue.push({
      text: msg.text,
      platform: msg.platform,
      url: msg.url,
      tabId: sender.tab?.id,
      sendResponse
    });
    processQueue();
    return true; // async response
  }

  if (msg.action === 'predictBatch') {
    handleBatch(msg.texts || [], msg.platform, msg.url, sender.tab?.id)
      .then(results => sendResponse({ results }))
      .catch(err => {
        console.error('[CBD BG] Batch predict error:', err);
        sendResponse({ results: [], error: err.message });
      });
    return true;
  }

  if (msg.action === 'predictFrame') {
    fetch(`${API_BASE}/predict-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: msg.imageBase64,
        caption_text: msg.captionText || '',
        source_url: msg.url || '',
        platform: msg.platform || 'web',
        is_video_frame: msg.isVideo !== false
      }),
      signal: AbortSignal.timeout(15000),
    })
    .then(r => r.json())
    .then(data => {
      if (data.is_bullying) {
        bullyCount++;
        chrome.action.setBadgeText({ text: bullyCount > 99 ? '99+' : String(bullyCount) });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      }
      sendResponse(data);
    })
    .catch(err => {
      console.error('[CBD BG] Frame predict error:', err);
      sendResponse({ error: err.message, is_bullying: false, confidence: 0.5 });
    });
    return true;
  }

  if (msg.action === 'resetBadge') {
    bullyCount = 0;
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }
});

// â”€â”€ Queue Processor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const batch = queue.splice(0, BATCH_SIZE);
    const texts = batch.map(item => item.text);

    try {
      const resp = await fetch(`${API_BASE}/predict-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, audio_prob: 0.5, visual_prob: 0.5 }),
        signal: AbortSignal.timeout(12000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const results = data.results || [];

        batch.forEach((item, idx) => {
          const result = results[idx] || { is_bullying: false, confidence: 0.5, label: 'Non-Bullying' };
          
          // Send response back to content script
          try {
            item.sendResponse && item.sendResponse(result);
          } catch {}

          // Send to popup
          chrome.runtime.sendMessage({
            action:      'newResult',
            text:        item.text,
            is_bullying: result.is_bullying,
            confidence:  result.confidence,
            platform:    item.platform,
          }).catch(() => {});

          // Forward to dashboard live stream
          forwardToDashboard(item.text, result, item.platform, item.url);

          // Update extension icon badge
          if (result.is_bullying) {
            bullyCount++;
            chrome.action.setBadgeText({ text: bullyCount > 99 ? '99+' : String(bullyCount) });
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
          }
        });

      } else {
        batch.forEach(item => {
          try {
            item.sendResponse && item.sendResponse({ is_bullying: false, confidence: 0.5, error: `API error ${resp.status}` });
          } catch {}
        });
      }
    } catch (e) {
      batch.forEach(item => {
        try {
          item.sendResponse && item.sendResponse({ is_bullying: false, confidence: 0.5, error: e.message });
        } catch {}
      });
    }

    if (queue.length > 0) await sleep(DELAY_MS);
  }

  isProcessing = false;
}

// â”€â”€ Batch handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function handleBatch(texts, platform, url, tabId) {
  if (!texts || texts.length === 0) return [];

  const resp = await fetch(`${API_BASE}/predict-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: texts.slice(0, 150), audio_prob: 0.5, visual_prob: 0.5 }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const results = data.results || [];

  // Update badge counter & forward bullying items to dashboard
  results.forEach(r => {
    if (r.is_bullying) {
      bullyCount++;
      forwardToDashboard(r.text_preview || r.text || '', r, platform, url);
    }
  });

  if (bullyCount > 0) {
    chrome.action.setBadgeText({ text: bullyCount > 99 ? '99+' : String(bullyCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }

  return results;
}

// â”€â”€ Forward ke Dashboard Extension Endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function forwardToDashboard(text, result, platform, url) {
  try {
    await fetch(`${API_BASE}/extension/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:       (text || '').substring(0, 500),
        source_url: url || '',
        platform:   platform || 'web',
        comment_id: null,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

// â”€â”€ Utils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sleep = ms => new Promise(res => setTimeout(res, ms));


