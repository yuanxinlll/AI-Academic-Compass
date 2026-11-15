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


def keys():
    """GEMINI_API_KEY plus optional GEMINI_API_KEYS (comma-separated, e.g. teammates' keys)."""
    out = []
    for k in [os.environ.get('GEMINI_API_KEY', '')] + os.environ.get('GEMINI_API_KEYS', '').split(','):
        k = k.strip()
        if k and k not in out:
            out.append(k)
    if not out:
        raise ValueError('Missing setting: GEMINI_API_KEY')
    return out


_exhausted = set()  # (key, model) pairs that hit quota this run
last_model = None   # the model that answered the most recent call (recorded in provenance)


def call(body):
    """POST generateContent; on quota/overload try the next model, then the next key."""
    from urllib.error import HTTPError
    last = None
    for key in keys():
        for model in models():
            if (key, model) in _exhausted:
                continue
            try:
                result = json.loads(post_json(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                    body, {'x-goog-api-key': key}))
                global last_model
                last_model = model
                return result
            except HTTPError as error:
                if error.code not in (429, 500, 503):
                    raise
                if error.code == 429:
                    _exhausted.add((key, model))
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
