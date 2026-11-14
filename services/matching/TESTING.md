# Prototype validation

Validated locally on Python 3.9.6. Production target Python 3.11+ remains unverified.

## Results

- 10 matching unit tests passed.
- 8 HTTP integration and profile merge tests passed.
- 4 PDF extraction tests passed, for 22 tests in total.
- HTTP tests bind an ephemeral loopback port and close it after completion.

Coverage includes profile-dependent ordering, explicit eligibility failures,
missing information, unknown conditions, bounded scores, token boundaries,
input preservation, confirmed profile conflicts, duplicate opportunity IDs,
invalid JSON, unknown IDs, invalid types, demo delivery, multipart PDF uploads,
PDF text extraction, invalid/blank PDFs and unconfirmed labeled-field drafts.

Run from the repository root:

```bash
.venv/bin/python -B -m unittest discover -s services/matching -p 'test_*.py' -v
```

These tests do not validate browser rendering or interactions, real-world
eligibility accuracy, semantic relevance, Gemini, arbitrary PDF layout fidelity, production
Next.js integration, persistence, authorization or deployment.

## Integration inputs needed

- Member A: representative opportunity JSON and source text, including missing
  or ambiguous requirements; agree whether requirement completeness can be established.
- Member C: confirm result fields, profile review UI and error presentation.
- Member D: approve contracts, Python invocation, upload limits, authentication,
  database reads and deployment configuration.
- Team owner: Gemini project/model and credential configuration through environment
  variables, never through repository files or chat messages.
