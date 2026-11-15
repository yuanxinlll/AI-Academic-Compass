"""Stateless v1.1 FastAPI service. Vercel project root: services; Python >=3.11.

No database connection, profile persistence, public API routes or credential logs.
"""

import hmac
import json
import os
import sys
from pathlib import Path
from email.parser import BytesParser
from email.policy import default

from fastapi import FastAPI, Request
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'ai'))
sys.path.insert(0, str(ROOT / 'matching'))
from resume import parse_pdf, ResumeError
from gemini import GeminiError
from contract_adapter import match_v11, adapt_resume_draft

app = FastAPI(title='Academic Compass Internal AI', docs_url=None, redoc_url=None, openapi_url=None)
PDF_LIMIT = 4 * 1024 * 1024
REQUEST_LIMIT = PDF_LIMIT + 65536


def error_response(status, code, message):
    return JSONResponse({'error': {'code': code, 'message': message}}, status_code=status)


@app.exception_handler(StarletteHTTPException)
async def http_error(request, error):
    code = 'NOT_FOUND' if error.status_code == 404 else 'METHOD_NOT_ALLOWED' if error.status_code == 405 else 'REQUEST_ERROR'
    return error_response(error.status_code, code, str(error.detail))


class BodyLimitError(Exception):
    pass


@app.middleware('http')
async def internal_auth(request, call_next):
    token = os.environ.get('INTERNAL_TOKEN')
    if not token:
        return error_response(503, 'SERVICE_NOT_CONFIGURED', 'Internal service authentication is not configured.')
    supplied = request.headers.get('x-internal-token', '')
    if not hmac.compare_digest(supplied.encode(), token.encode()):
        return error_response(401, 'UNAUTHORIZED', 'A valid internal token is required.')
    try:
        return await call_next(request)
    except Exception:
        return error_response(500, 'INTERNAL_ERROR', 'The internal service could not complete the request.')


async def limited_body(request):
    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > REQUEST_LIMIT:
            raise BodyLimitError()
    return bytes(content)


@app.post('/internal/match')
async def internal_match(request: Request):
    try:
        body = await limited_body(request)
        data = json.loads(body)
        if not isinstance(data, dict):
            raise ValueError('Request must be a JSON object.')
        return await run_in_threadpool(match_v11, data.get('profile'), data.get('opportunities'))
    except BodyLimitError:
        return error_response(413, 'REQUEST_TOO_LARGE', 'The request body exceeds the service limit.')
    except (ValueError, TypeError, UnicodeError, KeyError):
        return error_response(400, 'INVALID_INPUT', 'Provide a valid v1.1 profile and opportunity array.')


@app.post('/internal/resume/parse')
async def internal_resume(request: Request):
    try:
        content_type = request.headers.get('content-type', '')
        if not content_type.startswith('multipart/form-data') or '\r' in content_type or '\n' in content_type:
            return error_response(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use multipart/form-data with a PDF file field.')
        body = await limited_body(request)
        message = BytesParser(policy=default).parsebytes(
            ('Content-Type: ' + content_type + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + body)
        parts = list(message.iter_parts())
        files = [p for p in parts if p.get_param('name', header='content-disposition') == 'file']
        consent = [p for p in parts if p.get_param('name', header='content-disposition') == 'use_ai']
        if len(files) != 1 or len(consent) > 1:
            return error_response(400, 'INVALID_UPLOAD', 'Provide exactly one file and at most one use_ai field.')
        value = (consent[0].get_payload(decode=True) or b'').decode().strip().lower() if consent else 'false'
        if value not in ('true', 'false'):
            return error_response(400, 'INVALID_INPUT', 'use_ai must be true or false.')
        pdf = files[0].get_payload(decode=True) or b''
        if len(pdf) > PDF_LIMIT:
            raise BodyLimitError()
        parsed = await run_in_threadpool(parse_pdf, pdf, use_ai=value == 'true')
        adapted = adapt_resume_draft(parsed)
        return {'extracted': adapted['extracted']}
    except BodyLimitError:
        return error_response(413, 'FILE_TOO_LARGE', 'The PDF size limit is 4 MB.')
    except (ResumeError, GeminiError) as error:
        return error_response(error.status, error.code, str(error))
    except (ValueError, TypeError, UnicodeError):
        return error_response(400, 'INVALID_UPLOAD', 'The upload request is invalid.')
