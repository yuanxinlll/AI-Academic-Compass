"""JSON stdin/stdout bridge for member D; not a public web server.

Target Python 3.11+. Launch once per request with an explicit working directory.
"""

import base64
import binascii
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "matching"))
from engine import match
from resume import parse_pdf, ResumeError
from gemini import GeminiError


def dispatch(request):
    if not isinstance(request, dict):
        raise ValueError("Request must be a JSON object.")
    operation = request.get("operation")
    if operation == "match":
        return match(request.get("profile"), request.get("opportunities"))
    if operation == "parse_resume":
        encoded = request.get("pdf_base64")
        if not isinstance(encoded, str) or len(encoded) > 2800000:
            raise ValueError("pdf_base64 must encode a PDF no larger than 2 MB.")
        use_ai = request.get("use_ai", False)
        if not isinstance(use_ai, bool):
            raise ValueError("use_ai must be a boolean.")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error):
            raise ValueError("pdf_base64 is invalid.") from None
        return parse_pdf(content, use_ai=use_ai)
    raise ValueError("operation must be match or parse_resume.")


def main():
    try:
        raw = sys.stdin.buffer.read(3000001)
        if len(raw) > 3000000:
            raise ValueError("Worker request exceeds 3 MB.")
        request = json.loads(raw)
        response = {"ok": True, "data": dispatch(request)}
        code = 0
    except (ResumeError, GeminiError) as error:
        response = {"ok": False, "error": {"code": error.code, "message": str(error), "status": error.status}}
        code = 1
    except (ValueError, TypeError, UnicodeError) as error:
        response = {"ok": False, "error": {"code": "INVALID_INPUT", "message": str(error), "status": 400}}
        code = 1
    print(json.dumps(response, allow_nan=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
