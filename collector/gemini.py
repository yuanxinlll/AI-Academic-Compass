"""Small Gemini REST helpers shared by the access, multimodal and enrichment steps."""
import base64
import json
import os
import re

from collector.main import post_json


def models():
    """Primary model, then fallbacks used when the primary is overloaded (503/429)."""
    names = [os.environ['GEMINI_MODEL']] + [
        m.strip() for m in os.environ.get('GEMINI_FALLBACK_MODELS', 'gemini-3.7-flash,gemini-3.5-flash').split(',')]
    out = []
    for m in names:
        if m and m not in out:
            if not all(c.isalnum() or c in '-.' for c in m):
                raise ValueError('Invalid Gemini model name')
            out.append(m)
    return out


def call(body):
    """POST generateContent, falling back to the next model on overload."""
    from urllib.error import HTTPError
    last = None
    for model in models():
        try:
            return json.loads(post_json(
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                body, {'x-goog-api-key': os.environ['GEMINI_API_KEY']}))
        except HTTPError as error:
            if error.code not in (429, 500, 503):
                raise
            last = error
    raise last


def generate(parts, *, json_mode=True, search=False):
    """parts: list of {'text': ...} or {'inline_data': {...}}. Returns parsed JSON (json_mode) or text."""
    body = {'contents': [{'parts': parts}]}
    if search:
        # Google Search grounding cannot be combined with JSON mode; we parse JSON from text.
        body['tools'] = [{'google_search': {}}]
    elif json_mode:
        body['generationConfig'] = {'responseMimeType': 'application/json'}
    result = call(body)
    candidate = result['candidates'][0]
    if candidate.get('finishReason') not in ('STOP', None):
        raise ValueError('Gemini output was incomplete or blocked')
    text = ''.join(p.get('text', '') for p in candidate.get('content', {}).get('parts', []))
    if not json_mode and not search:
        return text
    if search:
        match = re.search(r'```(?:json)?\s*(.+?)```', text, re.S) or re.search(r'(\[.*\]|\{.*\})', text, re.S)
        return json.loads(match.group(1)) if match else []
    return json.loads(text)


def image_part(data, mime):
    return {'inline_data': {'mime_type': mime, 'data': base64.b64encode(data).decode()}}
