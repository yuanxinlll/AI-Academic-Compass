# Prototype validation

Validated locally on Python 3.9.6. Production target Python 3.11+ remains unverified.

## Results

Latest block 8 validation: 37 test methods passed, including five complete
HTTP-handler flow scenarios over in-memory streams. Gemini transport is mocked;
confirmation is simulated. This adds current handler coverage without sockets,
not browser automation or real-provider end-to-end verification.

Latest qualification change: 32 non-network test methods passed. One method
contains 12 explicit expected qualification cases. Positive eligibility is tested
only with trusted internal review; unknown/compound requirements remain pending.

Latest handoff change: 29 non-network tests passed, including 6 additional worker
and validation tests. Real subprocesses exercised matching and PDF input/output.
The user reported a successful live Gemini connection check; this is separate
from the agent-run mocked tests and does not establish arbitrary resume accuracy.

Latest Gemini adapter change: 23 non-network tests passed (10 matching, 4 PDF,
7 mocked Gemini and 2 merge tests). HTTP tests were not rerun for this change
because permission for temporary loopback ports was declined. Previous HTTP
results below describe the preceding commit only. No live Gemini request ran.

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
