# Resume parsing and Gemini adapter

Install `requirements.txt` in a project virtual environment. Production target:
Python 3.11+. Local validation currently uses Python 3.9.6.

## Optional Gemini configuration

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in the server environment, then restart
the demo server. Choose an available model supporting generateContent structured
output in your team's Google project. No model ID is assumed here. Do not place
credentials in source files, browser JavaScript, URLs, screenshots or chat.

The adapter uses Google's generateContent REST endpoint, an API-key header,
structured JSON output and a 30-second timeout. No extra SDK is required.

Gemini is called only if the upload explicitly includes `use_ai=true`; configuring
credentials alone does not send uploaded content. The demo's checkbox explains
that extracted resume text is transmitted to Google. Use fictional resumes for
team demonstrations. Source PDFs are processed in memory and are not saved.

Model results are unconfirmed drafts. Validation checks types, enums, dates and
the presence of verbatim source evidence for every non-null field. This does not
prove that an excerpt semantically supports a fact: users must still review it.
Model output never includes eligibility decisions or sensitive identity fields.

Without opt-in, the local parser extracts explicit labels only. Provider errors
are returned with sanitized messages; there is no silent fallback after a failed
Gemini request. Real Gemini access, model compatibility, quota and extraction
accuracy remain unverified until team configuration is available.

References:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
