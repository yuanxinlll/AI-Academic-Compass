"""Local PDF extraction and conservative labeled-field drafts; no AI calls.

Production target: Python 3.11+. Locally verified with Python 3.9.6.
"""

import io
import re
from pypdf import PdfReader


class ResumeError(ValueError):
    def __init__(self, code, message, status=422):
        super().__init__(message)
        self.code = code
        self.status = status


def draft_from_text(text):
    draft = {key: None for key in (
        "university", "major", "education_level", "academic_year",
        "expected_graduation_date", "interests", "skills", "completed_courses",
        "experiences")}
    evidence = []
    # Only explicit labels are supported. Never infer missing background facts.
    labels = {"university": "university", "major": "major", "skills": "skills",
              "interests": "interests", "completed courses": "completed_courses",
              "education level": "education_level"}
    for line in text.splitlines():
        label, separator, value = line.partition(":")
        field = labels.get(label.strip().casefold())
        value = value.strip()
        if not separator or not field or not value:
            continue
        if field == "education_level" and value.casefold() not in (
                "undergraduate", "graduate", "other"):
            continue
        if draft[field] is not None:
            continue
        draft[field] = ([v.strip() for v in value.split(",") if v.strip()]
                        if field in ("skills", "interests", "completed_courses")
                        else value.casefold() if field == "education_level" else value)
        evidence.append({"field": field, "source_text": line[:500]})
    return {"profile_draft": draft, "evidence": evidence,
            "requires_confirmation": True, "parser_mode": "labeled_fields_only",
            "warnings": [{"code": "GEMINI_NOT_CONFIGURED", "message":
                "Gemini is not connected. Only explicitly labeled fields were extracted; review and complete the draft manually."}]}


def parse_pdf(content):
    if len(content) > 2 * 1024 * 1024:
        raise ResumeError("FILE_TOO_LARGE", "The local demo limit is 2 MB.", 413)
    if not content.startswith(b"%PDF-"):
        raise ResumeError("UNSUPPORTED_FILE_TYPE", "Upload a valid PDF file.", 415)
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise ResumeError("ENCRYPTED_PDF", "Upload a PDF without password protection.")
        if not 1 <= len(reader.pages) <= 10:
            raise ResumeError("PDF_PAGE_LIMIT", "Upload a PDF with 1 to 10 pages.")
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except ResumeError:
        raise
    except Exception:
        raise ResumeError("INVALID_PDF", "The PDF could not be read.") from None
    if not text.strip():
        raise ResumeError("PDF_TEXT_UNAVAILABLE", "No text was found. Upload a text-based PDF or complete your profile manually.")
    if len(text) > 100000:
        raise ResumeError("PDF_TEXT_LIMIT", "The extracted text exceeds the local demo limit.")
    return draft_from_text(text)
