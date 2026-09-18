"""
pdf_parser.py — Ekstrak teks dari file PDF
Menggunakan pdfplumber (lebih baik dari PyPDF2 untuk teks Indonesia)
"""
import io
import logging

logger = logging.getLogger(__name__)

def extract_texts_from_pdf(file_bytes: bytes) -> list[dict]:
    """
    Ekstrak teks dari PDF, return list segment teks per paragraf.
    Returns: [{"page": 1, "segment": 1, "text": "...", "char_count": 123}, ...]
    """
    try:
        import pdfplumber
    except ImportError:
        logger.error("pdfplumber not installed. Run: pip install pdfplumber")
        return [{"page": 1, "segment": 1, "text": "pdfplumber not installed", "char_count": 0}]

    results = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                raw_text = page.extract_text()
                if not raw_text:
                    continue
                # Split per paragraf (pisah di double newline atau single newline panjang)
                paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
                if not paragraphs:
                    paragraphs = [p.strip() for p in raw_text.split("\n") if len(p.strip()) > 20]
                for seg_num, para in enumerate(paragraphs, 1):
                    if len(para) > 10:  # filter teks terlalu pendek
                        results.append({
                            "page":       page_num,
                            "segment":    seg_num,
                            "text":       para,
                            "char_count": len(para),
                        })
    except Exception as e:
        logger.error(f"PDF parsing error: {e}")
        results = [{"page": 1, "segment": 1, "text": f"Error: {str(e)}", "char_count": 0}]

    logger.info(f"PDF extracted: {len(results)} segments")
    return results
