// content.js — Real-Time Cyberbullying Detection Content Script
// Mendukung Facebook, YouTube, Twitter/X, Instagram, TikTok, Threads & Universal Web

(() => {
  'use strict';

  // Prevent multiple initializations on the same frame
  if (window.__CBD_INITIALIZED__) {
    return;
  }
  window.__CBD_INITIALIZED__ = true;

  const PROCESSED = new WeakSet();
  let   autoScan  = true;
  let   observer  = null;
  const platform  = detectPlatform();

  // ── Platform Detection ──────────────────────────────────────────
  function detectPlatform() {
    const h = location.hostname.toLowerCase();
    if (h.includes('facebook.com'))                      return 'facebook';
    if (h.includes('youtube.com'))                       return 'youtube';
    if (h.includes('twitter.com') || h.includes('x.com')) return 'twitter';
    if (h.includes('instagram.com'))                     return 'instagram';
    if (h.includes('tiktok.com'))                        return 'tiktok';
    if (h.includes('threads.net'))                       return 'threads';
    return 'generic';
  }

  // ── Selectors per platform ─────────────────────────────────────
  const SELECTORS = {
    facebook: [
      'div[role="dialog"] div[dir="auto"]',
      'div[role="dialog"] span[dir="auto"]',
      'div[data-pagelet*="Tahoe"] div[dir="auto"]',
      'div[data-pagelet*="Tahoe"] span[dir="auto"]',
      'div[data-ad-rendering-role="story_message"]',
      'div[data-ad-comet-preview="message"]',
      'div[data-ad-preview="message"]',
      'div[role="article"] div[dir="auto"]',
      'div[role="article"] span[dir="auto"]',
      'div[data-pagelet*="FeedUnit"] div[dir="auto"]',
      'div[aria-label*="Comment" i] div[dir="auto"]',
      'div[aria-label*="Comment" i] span[dir="auto"]',
      'div[aria-label*="Komentar" i] div[dir="auto"]',
      'div[aria-label*="Komentar" i] span[dir="auto"]',
      'ul li div[dir="auto"]',
      'div[role="feed"] div[dir="auto"]',
      'div[data-sigil*="feed_story"] div',
      'div[data-sigil*="comment-body"]',
      'div.story_body_container',
      'article[data-ft]'
    ].join(', '),

    youtube: [
      '#content-text',
      'ytd-comment-view-model #content-text',
      'yt-attributed-string#content-text',
      'ytd-comment-renderer #content-text',
      '#comment-content #content-text',
      'ytm-comment-thread-renderer .comment-text',
      'ytm-comment-renderer #content-text'
    ].join(', '),

    twitter: [
      '[data-testid="tweetText"]',
      'article[data-testid="tweet"] div[lang]',
      'article[data-testid="tweet"] div[dir="auto"]',
      '[data-testid="tweetText"] span'
    ].join(', '),

    instagram: [
      '._a9zs span',
      '.x9f619 span._ap3a',
      '._aacl._aaco._aacu._aacx._aad7._aade',
      'ul div[role="button"] ~ div span',
      'article div span',
      'div[role="dialog"] ul span'
    ].join(', '),

    tiktok: [
      '[data-e2e="comment-level-1"] [data-e2e="comment-text"]',
      '[data-e2e="comment-level-2"] [data-e2e="comment-text"]',
      '[data-e2e="search-card-comment"]',
      '.tiktok-q47mfk-SpanText',
      '.css-xm2h10-SpanText'
    ].join(', '),

    threads: [
      '[data-pressable-container="true"] span',
      'article div[dir="auto"]',
      'article span[dir="auto"]'
    ].join(', '),

    generic: [
      'article p',
      '.comment-body',
      '.comment-content',
      '.comment-text',
      '.post-content',
      '.message-content',
      'div.comment',
      'blockquote',
      'p'
    ].join(', ')
  };

  // ── Expand button selectors ────────────────────────────────────
  const EXPAND_SELECTORS = {
    facebook: [
      '[data-testid="UFI2CommentsCount/root"]',
      'div[aria-label*="Comment" i] div[role="button"]',
      'div[aria-label*="Komentar" i] div[role="button"]',
      'span:contains("Lihat komentar lainnya")',
      'span:contains("View more comments")',
      '[data-visualcompletion="ignore-dynamic"] div[role="button"]'
    ],
    youtube: [
      'yt-formatted-string#more-replies',
      'button#more-replies',
      'ytd-continuation-item-renderer paper-button',
      '#load-more-button',
      'ytd-button-renderer#continuation-button button'
    ],
    twitter: [
      '[data-testid="tweet-text-show-more-link"]',
      '[role="button"]'
    ],
    instagram: [
      'button[type="button"]._abl-',
      'div._aabd button',
      'ul li button'
    ],
    tiktok: [
      '[data-e2e="view-more-arrow"]',
      '.css-1wkmkjd-DivReplyContainer button'
    ]
  };

  // ── Filter Out UI Utility Strings & Usernames ──────────────────
  const IGNORED_TEXTS = new Set([
    'suka', 'like', 'likes', 'balas', 'reply', 'replies', 'bagikan', 'share', 'laporkan', 'report',
    'ikuti', 'follow', 'following', 'see more', 'lihat selengkapnya', 'lihat lainnya',
    'edit', 'hapus', 'delete', 'pinned', 'tersemat', 'top comments', 'komentar teratas',
    'all comments', 'semua komentar', 'terbaru', 'newest', 'friends', 'memories', 'saved',
    'groups', 'reels', 'marketplace', 'feeds', 'events', 'ads manager', 'birthdays',
    'meta ai', 'shortcuts', 'pintasan', 'post', 'postingan', 'search results', 'hasil pencarian',
    'most relevant', 'relevan', 'translate all comments', 'terjemahkan semua komentar',
    'by author', 'penulis', 'author', 'top fan', 'penggemar berat', 'replying to', 'membalas',
    'write a comment...', 'tulis komentar...', 'write a reply...', 'tulis balasan...',
    '1d', '2d', '3d', '4d', '5d', '6d', '7d', '1w', '2w', '3w', '1h', '2h', '3h', '4h', '5h', '6h',
    '12h', '18h', '24h', '1m', '2m', '5m', '10m', '30m', '45m', '1s', 'just now', 'baru saja'
  ]);

  function isMeaningfulComment(text) {
    if (!text) return false;
    const clean = text.trim().toLowerCase();
    if (clean.length < 5 || clean.length > 3000) return false;
    if (IGNORED_TEXTS.has(clean)) return false;
    if (!/[a-zA-Z]/.test(clean)) return false;

    // Check for author / time / badge prefixes (e.g. "· 1d", "by author")
    if (/^[·•\s]*\d+[smhdw][·•\s]*$/i.test(clean)) return false;
    if (/^by author|^penulis/i.test(clean)) return false;

    // Abaikan label 1-2 kata pendek kecuali kata toxic/kasar
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length <= 2 && clean.length < 18) {
      const toxicShort = [
        'bodoh', 'idiot', 'tolol', 'bego', 'mati', 'anjing', 'babi', 'goblok',
        'sampah', 'lonte', 'bangsat', 'bajingan', 'bully', 'hina', 'sialan',
        'mati aja', 'anak haram', 'muka jelek'
      ];
      if (!toxicShort.some(t => clean.includes(t))) {
        return false;
      }
    }
    return true;
  }

  // ── Extract Candidates Nodes ───────────────────────────────────
  function getCommentNodes() {
    const sel = SELECTORS[platform] || SELECTORS.generic;
    const allMatches = Array.from(document.querySelectorAll(sel));

    const candidates = allMatches.filter(el => {
      if (el.dataset.cbdTagged) return false;
      if (el.closest('.cbd-badge') || el.classList.contains('cbd-badge')) return false;

      // Ignore buttons, navs, headers, inputs
      const tag = el.tagName.toLowerCase();
      if (['button', 'input', 'textarea', 'nav', 'header', 'footer', 'script', 'style'].includes(tag)) {
        return false;
      }

      // Ignore Author Profiles / Usernames / Links / Avatars
      if (el.closest('a[role="link"], a[href*="facebook.com/"], a[href*="profile.php"], a[href*="/user/"], [data-hovercard], .x1i10hfl[href], strong')) {
        return false;
      }

      // Ignore Buttons, Menus, Dropdowns, Tabs, Filters
      if (el.closest('[role="button"], [role="tab"], [role="menuitem"], [aria-haspopup], [aria-expanded], [aria-label*="Balas" i], [aria-label*="Reply" i], [aria-label*="Suka" i], [aria-label*="Like" i]')) {
        return false;
      }

      // Ignore sidebar / left navigation menu
      if (el.closest('[role="navigation"], [role="banner"], [role="menu"], [data-pagelet*="LeftRail"], [data-pagelet*="ChatTab"], nav, header, footer, aside, [aria-label*="shortcuts" i], [aria-label*="pintasan" i]')) {
        return false;
      }

      // Ignore headings/titles (like "Ida Susanti's post", "Search results")
      if (el.closest('h1, h2, h3, [role="heading"]')) {
        return false;
      }

      // Ignore sidebar shortcut links
      if (el.closest('a[role="link"][href*="friends"], a[role="link"][href*="saved"], a[role="link"][href*="memories"], a[role="link"][href*="groups"], a[role="link"][href*="reels"], a[role="link"][href*="marketplace"], a[role="link"][href*="events"]')) {
        return false;
      }

      const txt = (el.innerText || el.textContent || '').trim();
      if (!isMeaningfulComment(txt)) return false;

      // Ensure this element is a fine-grained container (no large descendant elements with same text)
      const hasSubChildWithSameText = Array.from(el.children).some(child => {
        const cTxt = (child.innerText || child.textContent || '').trim();
        return cTxt.length >= 10 && cTxt === txt;
      });

      return !hasSubChildWithSameText;
    });

    return candidates;
  }

  // ── Inject Visual Badge ────────────────────────────────────────
  function injectBadge(el, result) {
    if (el.dataset.cbdTagged) return;
    el.dataset.cbdTagged = 'true';

    const isBully = !!result.is_bullying;
    const conf    = Math.round((result.confidence || 0.5) * 100);
    const txt     = (el.innerText || el.textContent || '').trim();

    // Do not clutter UI with safe badges on short sentences (< 20 chars)
    if (!isBully && txt.length < 20) return;

    const keywords = (result.keywords_hit && result.keywords_hit.length > 0)
      ? ` | Kata Kunci: ${result.keywords_hit.join(', ')}`
      : '';

    const badge = document.createElement('span');
    badge.className = `cbd-badge ${isBully ? 'cbd-badge-bully' : 'cbd-badge-safe'}`;

    if (isBully) {
      badge.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        margin-left: 8px !important;
        margin-top: 3px !important;
        margin-bottom: 3px !important;
        padding: 3px 9px !important;
        background: #fee2e2 !important;
        border: 1.5px solid #ef4444 !important;
        border-radius: 999px !important;
        color: #991b1b !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1.4 !important;
        vertical-align: middle !important;
        box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25) !important;
        cursor: help !important;
        z-index: 100 !important;
        white-space: nowrap !important;
      `;
      badge.innerHTML = `⚠️ CYBERBULLY (${conf}%)`;
      badge.title = `[CyberBully Detector V11] Terindikasi Perundungan Siber (${conf}%)${keywords}`;
    } else {
      badge.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        margin-left: 6px !important;
        margin-top: 2px !important;
        margin-bottom: 2px !important;
        padding: 2px 7px !important;
        background: #ecfdf5 !important;
        border: 1px solid #10b981 !important;
        border-radius: 999px !important;
        color: #065f46 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        line-height: 1.3 !important;
        vertical-align: middle !important;
        z-index: 100 !important;
        white-space: nowrap !important;
      `;
      badge.innerHTML = `✅ Aman (${conf}%)`;
      badge.title = `[CyberBully Detector V11] Konten Dinilai Aman (${conf}%)`;
    }

    try {
      el.appendChild(badge);
    } catch {}
  }

  // ── Highlight Bullying Container ───────────────────────────────
  function highlightContainer(el) {
    try {
      const container = el.closest(
        'div[role="article"], div[data-pagelet*="FeedUnit"], ytd-comment-view-model, ytd-comment-renderer, article, li, div[data-testid="cellInnerDiv"], div[data-ad-preview="message"]'
      ) || el.parentElement;

      if (container && !container.dataset.cbdHighlighted) {
        container.dataset.cbdHighlighted = 'true';
        container.style.borderLeft = '4px solid #ef4444 !important';
        container.style.backgroundColor = 'rgba(239, 68, 68, 0.05) !important';
        container.style.borderRadius = '6px !important';
        container.style.transition = 'all 0.2s ease !important';
      }
    } catch {}
  }

  // ── Process Single Element ─────────────────────────────────────
  async function processElement(el) {
    if (PROCESSED.has(el)) return;
    const text = (el.innerText || el.textContent || '').trim();
    if (!isMeaningfulComment(text)) return;
    PROCESSED.add(el);

    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'predict', text, platform, url: location.href },
          response => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(response || { is_bullying: false, confidence: 0.5 });
          }
        );
      });

      injectBadge(el, result);
      if (result.is_bullying) {
        highlightContainer(el);
      }
    } catch (e) {
      // Backend not reached or skip
    }
  }

  // ── Scan Entire Page (Batch Mode) ──────────────────────────────
  async function scanPage() {
    const nodes = getCommentNodes();
    const results = [];

    const items = nodes
      .filter(el => !PROCESSED.has(el))
      .map(el => ({ el, text: (el.innerText || el.textContent || '').trim() }))
      .filter(item => isMeaningfulComment(item.text))
      .slice(0, 150);

    if (items.length === 0) {
      return { results: [] };
    }

    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action:   'predictBatch',
            texts:    items.map(t => t.text),
            platform: platform,
            url:      location.href
          },
          response => resolve(response || { results: [] })
        );
      });

      const batchResults = resp.results || [];

      items.forEach((item, idx) => {
        const result = batchResults[idx] || { is_bullying: false, confidence: 0.5 };
        PROCESSED.add(item.el);
        injectBadge(item.el, result);
        if (result.is_bullying) {
          highlightContainer(item.el);
        }
        results.push({ text: item.text, ...result });
      });

    } catch (e) {
      // Fallback: Individual predict
      for (const item of items.slice(0, 20)) {
        await processElement(item.el);
      }
    }

    return { results };
  }

  // ── Extract Media Context & Captions (Dialog / Feed / Subtitle) ───
  function extractMediaContext(el) {
    let collectedTexts = [];

    // 1. Direct container (feed unit / article / card / dialog)
    const container = el.closest('[role="dialog"], article, div[role="article"], div[data-pagelet*="FeedUnit"], div[role="main"], ytd-watch-flexy, ytd-reel-video-renderer') || el.parentElement;
    if (container) {
      const cText = (container.innerText || container.textContent || '').trim();
      if (cText.length > 10) collectedTexts.push(cText);
    }

    // 2. Facebook Modal Dialog / Tahoe panel on screen
    const dialogModal = document.querySelector('[role="dialog"], div[aria-label*="reel" i], div[aria-label*="video" i], div[data-pagelet*="Tahoe"]');
    if (dialogModal) {
      const dText = (dialogModal.innerText || dialogModal.textContent || '').trim();
      if (dText.length > 15 && !collectedTexts.includes(dText)) {
        collectedTexts.push(dText);
      }
    }

    // 3. Post captions, spans, headings, and hashtags with dir="auto"
    const descNodes = Array.from(document.querySelectorAll('div[data-ad-preview="message"], div[dir="auto"], h1, h2, span[dir="auto"]'))
      .map(d => (d.innerText || d.textContent || '').trim())
      .filter(t => t.length > 25 && !t.startsWith('http') && !t.includes('Comments') && !t.includes('Komentar'));
    if (descNodes.length > 0) {
      collectedTexts.push(...descNodes.slice(0, 4));
    }

    // 4. Subtitles
    const subEls = Array.from(document.querySelectorAll('.ytp-caption-segment, .caption-window, div[aria-label*="caption" i], div[aria-label*="subtitle" i]'));
    const subText = subEls.map(s => (s.innerText || '').trim()).filter(Boolean).join(' ');
    if (subText) {
      collectedTexts.push(`[Subtitle]: ${subText}`);
    }

    // 5. Fallback: entire page body text snippet
    if (collectedTexts.length === 0 && document.body) {
      collectedTexts.push(document.body.innerText.substring(0, 1000));
    }

    // Merge, deduplicate
    const unique = Array.from(new Set(collectedTexts));
    const merged = unique.join(' | ').replace(/\s+/g, ' ').trim();
    return merged.substring(0, 800);
  }

  // ── Inject Floating Badge on Video / Meme Image ───────────────
  function injectMediaOverlay(mediaEl, result, isVideo = true) {
    const parent = mediaEl.parentElement;
    if (!parent) return;

    // Remove existing overlay if any to allow fresh update
    const old = parent.querySelector('.cbd-media-overlay');
    if (old) old.remove();

    mediaEl.dataset.cbdMediaTagged = 'true';

    const isBully = !!result.is_bullying;
    const conf = Math.round((result.confidence || 0.5) * 100);
    const keywords = (result.keywords_hit && result.keywords_hit.length > 0)
      ? ` · ${result.keywords_hit.join(', ')}`
      : '';

    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Highlight container border for bullying videos/media
    if (isBully) {
      parent.style.outline = '4px solid #EF4444 !important';
      parent.style.boxShadow = '0 0 24px rgba(239, 68, 68, 0.6) !important';
      parent.style.borderRadius = '10px !important';
    } else {
      parent.style.outline = 'none !important';
      parent.style.boxShadow = 'none !important';
    }

    const overlay = document.createElement('div');
    overlay.className = `cbd-media-overlay ${isBully ? 'cbd-media-bully' : 'cbd-media-safe'}`;
    overlay.style.cssText = `
      position: absolute !important;
      top: 14px !important;
      left: 14px !important;
      z-index: 99999 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 3px !important;
      padding: 8px 14px !important;
      border-radius: 9px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      line-height: 1.35 !important;
      pointer-events: auto !important;
      backdrop-filter: blur(10px) !important;
      box-shadow: 0 4px 18px rgba(0,0,0,0.45) !important;
      ${isBully
        ? 'background: rgba(220, 38, 38, 0.95) !important; color: #FFFFFF !important; border: 1.5px solid #FCA5A5 !important;'
        : 'background: rgba(5, 150, 105, 0.90) !important; color: #FFFFFF !important; border: 1.5px solid #6EE7B7 !important;'
      }
    `;

    const icon = isVideo ? '🎥' : '🖼️';
    const tag = isBully ? '⚠️ PERUNDUNGAN & KEKERASAN' : '✅ MEDIA AMAN';
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;font-size:12.5px;">
        <span>${icon}</span>
        <span>${tag} (${conf}%)</span>
      </div>
      <div style="font-size:10.5px;font-weight:600;opacity:0.95;margin-top:2px;">
        Trimodal AI (Teks + Visual + Audio)${keywords}
      </div>
    `;

    try {
      parent.appendChild(overlay);
    } catch {}
  }

  // ── Capture and Scan Video Frames & Meme Images ─────────────────
  async function scanMediaFrames() {
    const results = [];

    // 1. Scan Videos (Scan all visible videos)
    const videos = Array.from(document.querySelectorAll('video'))
      .filter(v => v.offsetWidth > 60 || v.offsetHeight > 60);

    for (const v of videos.slice(0, 6)) {
      try {
        const canvas = document.createElement('canvas');
        const w = Math.min(v.videoWidth || 640, 640);
        const h = Math.min(v.videoHeight || 360, 360);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(v, 0, 0, w, h);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.65);

        // Rich Context & Caption Extraction
        const fullCaption = extractMediaContext(v);

        const res = await new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'predictFrame',
            imageBase64,
            captionText: fullCaption,
            url: location.href,
            platform,
            isVideo: true
          }, resolve);
        });

        if (res && !res.error) {
          injectMediaOverlay(v, res, true);
          results.push({ type: 'video', ...res });
        }
      } catch (err) {
        console.warn('[CBD] Video frame capture error:', err);
      }
    }

    // 2. Scan Meme / Post Images
    const imgs = Array.from(document.querySelectorAll('img'))
      .filter(img => {
        if (img.naturalWidth < 160 || img.naturalHeight < 140) return false;
        return !!img.closest('article, div[role="article"], div[data-pagelet*="FeedUnit"], main, [role="dialog"]');
      });

    for (const img of imgs.slice(0, 6)) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.naturalWidth, 640);
        canvas.height = Math.min(img.naturalHeight, 640);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.65);

        const fullCaption = extractMediaContext(img);

        const res = await new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'predictFrame',
            imageBase64,
            captionText: fullCaption,
            url: location.href,
            platform,
            isVideo: false
          }, resolve);
        });

        if (res && !res.error) {
          injectMediaOverlay(img, res, false);
          results.push({ type: 'image', ...res });
        }
      } catch (err) {
        console.warn('[CBD] Image OCR capture error:', err);
      }
    }

    return { results, total_media: results.length };
  }

  // ── Extract Clean Comments List for Dashboard ───────────────────
  function getCleanCommentsList() {
    const nodes = getCommentNodes();
    const texts = Array.from(new Set(
      nodes.map(el => (el.innerText || el.textContent || '').trim())
           .filter(t => isMeaningfulComment(t))
    ));
    return texts;
  }

  // ── Expand All Comments & Replies Recursively to the Root ───────
  async function expandAllCommentsDeep(maxPasses = 4) {
    let totalClicked = 0;

    for (let pass = 0; pass < maxPasses; pass++) {
      let passClicked = 0;

      const clickableCandidates = Array.from(document.querySelectorAll(`
        div[role="button"],
        span[role="button"],
        button,
        a[role="button"],
        div[aria-label*="Comment" i] div[role="button"],
        div[aria-label*="Komentar" i] div[role="button"],
        div[aria-label*="Balas" i],
        div[aria-label*="Reply" i],
        .x1i10hfl[role="button"],
        ytd-button-renderer#more-replies,
        #more-replies,
        .css-1wkmkjd-DivReplyContainer button
      `));

      for (const btn of clickableCandidates) {
        if (!btn || btn.offsetParent === null) continue;
        if (btn.dataset.cbdExpanded) continue;

        const text = (btn.textContent || btn.innerText || btn.getAttribute('aria-label') || '').toLowerCase().trim();

        const isExpandTrigger = 
          text.includes('lihat komentar') ||
          text.includes('view more comments') ||
          text.includes('view comment') ||
          (text.includes('lihat') && text.includes('balasan')) ||
          (text.includes('view') && text.includes('repl')) ||
          text.includes('balasan sebelumnya') ||
          text.includes('previous replies') ||
          text.includes('previous comments') ||
          text.includes('more replies') ||
          text.includes('more comments') ||
          text.includes('lihat selengkapnya') ||
          text.includes('see more') ||
          text.includes('see translation') ||
          text.includes('lihat terjemahan');

        if (isExpandTrigger) {
          btn.dataset.cbdExpanded = 'true';
          try {
            btn.click();
            passClicked++;
            totalClicked++;
            await sleep(120);
          } catch {}
        }
      }

      if (passClicked === 0) break;
      await sleep(350);
    }

    console.log(`[CyberBully Detector] Deep expanded ${totalClicked} buttons.`);
    return { ok: true, clicked: totalClicked };
  }

  // ── MutationObserver (Auto-Scan) ───────────────────────────────
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(debounce(() => {
      if (!autoScan) return;
      const unhandled = getCommentNodes().slice(0, 30);
      unhandled.forEach(el => processElement(el));
    }, 800));

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ── Message Dispatcher ─────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ping') {
      sendResponse({ ok: true, platform, url: location.href });
      return true;
    }
    if (msg.action === 'scanPage') {
      scanPage()
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ results: [], error: err.message }));
      return true;
    }
    if (msg.action === 'expandAll' || msg.action === 'expandAllDeep') {
      expandAllCommentsDeep()
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ ok: false }));
      return true;
    }
    if (msg.action === 'toggleAuto') {
      autoScan = !!msg.enabled;
      if (autoScan) startObserver();
      else if (observer) observer.disconnect();
      sendResponse({ ok: true, autoScan });
      return true;
    }
    if (msg.action === 'scanMedia') {
      scanMediaFrames()
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ results: [], error: err.message }));
      return true;
    }
    if (msg.action === 'getCleanText') {
      try {
        const texts = getCleanCommentsList();
        sendResponse({
          ok: true,
          title: document.title,
          url: location.href,
          platform: platform,
          texts: texts,
          total: texts.length,
          combined_text: texts.join('\n\n')
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }
    if (msg.action === 'getDashboardDataset') {
      try {
        const texts = getCleanCommentsList();
        sendResponse({
          ok: true,
          title: document.title,
          url: location.href,
          platform: platform,
          texts: texts,
          total: texts.length,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }
    if (msg.action === 'getPageSource') {
      try {
        const doctype = document.doctype
          ? `<!DOCTYPE ${document.doctype.name}${document.doctype.publicId ? ` PUBLIC "${document.doctype.publicId}"` : ''}${document.doctype.systemId ? ` "${document.doctype.systemId}"` : ''}>\n`
          : '<!DOCTYPE html>\n';
        const html = document.documentElement ? document.documentElement.outerHTML : document.body.innerHTML;
        sendResponse({
          ok: true,
          title: document.title || 'Page Source',
          url: location.href,
          platform: platform,
          html: doctype + html,
          length: html.length,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }
  });

  // ── Init Auto-Scan ─────────────────────────────────────────────
  chrome.storage.local.get('autoScan', data => {
    autoScan = data.autoScan !== false;
    if (autoScan) {
      startObserver();
      // Initial sweep
      setTimeout(() => {
        if (autoScan) {
          const initialNodes = getCommentNodes().slice(0, 25);
          initialNodes.forEach(el => processElement(el));
        }
      }, 2500);
    }
  });

  // ── Helpers ────────────────────────────────────────────────────
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const sleep = ms => new Promise(res => setTimeout(res, ms));

  console.log(`[CyberBully Detector V11] Content Script loaded for ${platform} (${location.href})`);
})();
