"""
url_scraper.py — Scrape konten teks dari URL media sosial & web umum
Platform didukung: YouTube, Twitter/X, Instagram, Facebook, TikTok, Generic
"""
import re
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
}

def _detect_platform(url: str) -> str:
    url_lower = url.lower()
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    if "twitter.com" in url_lower or "x.com" in url_lower:
        return "twitter"
    if "instagram.com" in url_lower:
        return "instagram"
    if "facebook.com" in url_lower or "fb.com" in url_lower:
        return "facebook"
    if "tiktok.com" in url_lower:
        return "tiktok"
    return "generic"

def _clean_text(text: str) -> str:
    """Bersihkan whitespace berlebihan."""
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def _scrape_generic(html: str) -> list[str]:
    """Fallback: ambil semua <p> tag."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        # Hapus script dan style
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        texts = []
        for p in soup.find_all(["p", "span", "div"], limit=200):
            t = _clean_text(p.get_text())
            if len(t) > 30:
                texts.append(t)
        return list(dict.fromkeys(texts))[:100]  # deduplicate
    except Exception as e:
        logger.error(f"Generic scrape error: {e}")
        return []

def _scrape_youtube(html: str, url: str) -> list[str]:
    """YouTube: ambil judul + deskripsi (komentar butuh JS, tidak bisa dari static HTML)."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        results = []
        # Title
        title_tag = soup.find("title")
        if title_tag:
            results.append(f"[JUDUL] {_clean_text(title_tag.text)}")
        # Deskripsi dari meta tag
        desc = soup.find("meta", {"name": "description"})
        if desc and desc.get("content"):
            results.append(f"[DESKRIPSI] {_clean_text(desc['content'])}")
        # OG description
        og_desc = soup.find("meta", {"property": "og:description"})
        if og_desc and og_desc.get("content"):
            results.append(f"[OG DESC] {_clean_text(og_desc['content'])}")
        results.append("[INFO] Komentar YouTube memerlukan Chrome Extension untuk dibaca secara real-time.")
        return results if results else _scrape_generic(html)
    except Exception as e:
        return [f"Error scraping YouTube: {e}"]

def _scrape_twitter(html: str) -> list[str]:
    """Twitter: ambil tweet text dari meta tags."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        results = []
        og_desc = soup.find("meta", {"property": "og:description"})
        if og_desc and og_desc.get("content"):
            results.append(f"[TWEET] {_clean_text(og_desc['content'])}")
        title = soup.find("meta", {"property": "og:title"})
        if title and title.get("content"):
            results.append(f"[TITLE] {_clean_text(title['content'])}")
        results.append("[INFO] Reply Twitter memerlukan Chrome Extension untuk dibaca secara real-time.")
        return results if results else ["[INFO] Twitter memerlukan login untuk konten lengkap."]
    except Exception as e:
        return [f"Error scraping Twitter: {e}"]

def _scrape_instagram(html: str) -> list[str]:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        results = []
        og_desc = soup.find("meta", {"property": "og:description"})
        if og_desc and og_desc.get("content"):
            results.append(f"[CAPTION] {_clean_text(og_desc['content'])}")
        results.append("[INFO] Komentar Instagram memerlukan Chrome Extension atau login.")
        return results if results else ["[INFO] Instagram memerlukan login untuk konten lengkap."]
    except Exception as e:
        return [f"Error scraping Instagram: {e}"]

def _scrape_facebook(html: str) -> list[str]:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        results = []
        og_desc = soup.find("meta", {"property": "og:description"})
        if og_desc and og_desc.get("content"):
            results.append(f"[POST] {_clean_text(og_desc['content'])}")
        results.append("[INFO] Komentar Facebook memerlukan Chrome Extension atau login.")
        return results if results else ["[INFO] Facebook memerlukan login untuk konten lengkap."]
    except Exception as e:
        return [f"Error scraping Facebook: {e}"]

def _scrape_tiktok(html: str) -> list[str]:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        results = []
        og_desc = soup.find("meta", {"name": "description"})
        if og_desc and og_desc.get("content"):
            results.append(f"[CAPTION] {_clean_text(og_desc['content'])}")
        results.append("[INFO] Komentar TikTok memerlukan Chrome Extension untuk dibaca secara real-time.")
        return results if results else _scrape_generic(html)
    except Exception as e:
        return [f"Error scraping TikTok: {e}"]

def scrape_url(url: str) -> dict:
    """
    Main function: scrape URL dan return structured result.
    Returns: {
        "url": str,
        "platform": str,
        "segments": [{"index": int, "text": str}, ...],
        "error": str or None
    }
    """
    try:
        import requests
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        logger.error(f"Request failed for {url}: {e}")
        return {"url": url, "platform": "unknown", "segments": [], "error": str(e)}

    platform = _detect_platform(url)
    logger.info(f"Scraping {url} as platform={platform}")

    if platform == "youtube":
        texts = _scrape_youtube(html, url)
    elif platform == "twitter":
        texts = _scrape_twitter(html)
    elif platform == "instagram":
        texts = _scrape_instagram(html)
    elif platform == "facebook":
        texts = _scrape_facebook(html)
    elif platform == "tiktok":
        texts = _scrape_tiktok(html)
    else:
        texts = _scrape_generic(html)

    # Filter dan deduplicate
    seen = set()
    unique_texts = []
    for t in texts:
        if t and t not in seen and len(t) > 10:
            seen.add(t)
            unique_texts.append(t)

    segments = [{"index": i+1, "text": t} for i, t in enumerate(unique_texts[:80])]

    return {
        "url":      url,
        "platform": platform,
        "segments": segments,
        "count":    len(segments),
        "error":    None,
    }
