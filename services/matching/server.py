"""Local demo API. Production target: Python 3.11+; tested locally on 3.9.

Run: python3 -B services/matching/server.py
This server is local-only and is not the production Next.js API.
"""

import json
import sys
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from demo import OPPORTUNITIES, PROFILES
from engine import match, validate_profile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai"))
from resume import parse_pdf, ResumeError
from gemini import GeminiError, configured


def merge_profile(confirmed, draft):
    """Preserve confirmed values and surface conflicts for user review."""
    merged = dict(confirmed)
    conflicts = []
    for field, value in draft.items():
        if value is None:
            continue
        if field not in confirmed or confirmed[field] is None:
            merged[field] = value
        elif confirmed[field] != value:
            conflicts.append({"field": field, "confirmed_value": confirmed[field],
                              "draft_value": value})
    validate_profile(merged)
    return {"profile_draft": merged, "conflicts": conflicts,
            "requires_confirmation": True}


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, value):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/":
            body = Path(__file__).with_name("demo.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/api/demo-data":
            self.respond(200, {"profiles": PROFILES, "opportunities": OPPORTUNITIES,
                               "gemini_configured": configured()})
        elif self.path == "/api/opportunities":
            self.respond(200, {"opportunities": OPPORTUNITIES})
        else:
            self.respond(404, {"error": {"code": "NOT_FOUND", "message": "Route not found."}})

    def do_POST(self):
        if self.path == "/api/resume/parse":
            self.parse_resume()
            return
        if self.path not in ("/api/match", "/api/profile/merge"):
            self.respond(404, {"error": {"code": "NOT_FOUND", "message": "Route not found."}})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 100000:
                raise ValueError("Request body must contain 1 to 100000 bytes.")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Request body must be a JSON object.")
            if self.path == "/api/profile/merge":
                confirmed, draft = data.get("confirmed", {}), data.get("draft", {})
                if not isinstance(confirmed, dict) or not isinstance(draft, dict):
                    raise ValueError("confirmed and draft must be JSON objects.")
                result = merge_profile(confirmed, draft)
            else:
                profile = data.get("profile")
                ids = data.get("opportunity_ids")
                if not isinstance(profile, dict):
                    raise ValueError("profile must be a JSON object.")
                if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids):
                    raise ValueError("opportunity_ids must be a list of strings.")
                known = {o["opportunity_id"]: o for o in OPPORTUNITIES}
                if any(i not in known for i in ids):
                    raise ValueError("Unknown opportunity ID.")
                result = match(profile, [known[i] for i in dict.fromkeys(ids)])
            self.respond(200, result)
        except (ValueError, TypeError, UnicodeError) as error:
            self.respond(400, {"error": {"code": "INVALID_INPUT", "message": str(error)}})

    def parse_resume(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2 * 1024 * 1024 + 16384:
                raise ResumeError("FILE_TOO_LARGE", "The local demo upload limit is 2 MB.", 413)
            content_type = self.headers.get("Content-Type", "")
            if not content_type.startswith("multipart/form-data"):
                raise ResumeError("UNSUPPORTED_MEDIA_TYPE", "Use multipart/form-data with one file field.", 415)
            message = BytesParser(policy=default).parsebytes(
                ("Content-Type: " + content_type + "\r\nMIME-Version: 1.0\r\n\r\n").encode()
                + self.rfile.read(length))
            files = [part for part in message.iter_parts()
                     if part.get_param("name", header="content-disposition") == "file"]
            if len(files) != 1:
                raise ResumeError("INVALID_UPLOAD", "Provide exactly one file field.", 400)
            use_ai = any(part.get_param("name", header="content-disposition") == "use_ai"
                         and part.get_content().strip() == "true" for part in message.iter_parts())
            self.respond(200, parse_pdf(files[0].get_payload(decode=True) or b"", use_ai=use_ai))
        except (ResumeError, GeminiError) as error:
            self.respond(error.status, {"error": {"code": error.code, "message": str(error), "field": "file"}})
        except (ValueError, TypeError):
            self.respond(400, {"error": {"code": "INVALID_UPLOAD", "message": "Invalid upload request."}})

    def log_message(self, format, *args):
        # Do not log profile contents or request bodies.
        pass


if __name__ == "__main__":
    print("Demo: http://127.0.0.1:8765", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
