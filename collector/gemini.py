"""Small Gemini REST helpers shared by the access, multimodal and enrichment steps."""
import base64
import json
import os
import re

from collector.main import post_json


def _model():
    model = os.environ['GEMINI_MODEL']
    if not all(c.isalnum() or c in '-.' for c in model):
        raise ValueError('Invalid GEMINI_MODEL')
    return model


def generate(parts, *, json_mode=True, search=False):
    """parts: list of {'text': ...} or {'inline_data': {...}}. Returns parsed JSON (json_mode) or text."""
    body = {'contents': [{'parts': parts}]}
    if search:
        # Google Search grounding cannot be combined with JSON mode; we parse JSON from text.
        body['tools'] = [{'google_search': {}}]
    elif json_mode:
        body['generationConfig'] = {'responseMimeType': 'application/json'}
    result = json.loads(post_json(
        f'https://generativelanguage.googleapis.com/v1beta/models/{_model()}:generateContent',
        body, {'x-goog-api-key': os.environ['GEMINI_API_KEY']}))
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
