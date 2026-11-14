> v1.1 update: the contract is now confirmed. The authenticated FastAPI service is services/main.py; see ../README.md. Earlier draft blockers below are retained as history and no longer block implementation. Deployment and cross-member acceptance remain pending.

# Integration acceptance record

## Block 8: internal flow validation

Passed 37 test methods locally on Python 3.9.6. Run from the repository root:

```bash
.venv/bin/python -B services/matching/run_checks.py
```

The latest five scenarios serialize complete HTTP requests and pass them through
the real request handler using in-memory connection streams. No listening socket,
personal resume, credential, database or outbound request is needed.

| Scenario | Expected and observed outcome |
| --- | --- |
| PDF upload, local extraction, merge, simulated confirmation, match | Draft is reviewable; explicit time failure is ineligible; all records remain visible |
| PDF upload with opt-in, mocked Gemini, merge, simulated confirmation, match | Validated Gemini draft reaches matching; model transport is invoked once |
| Gemini opt-in without configuration | HTTP 503 with AI_NOT_CONFIGURED |
| Invalid PDF upload | HTTP 415 with UNSUPPORTED_FILE_TYPE |
| Client claims trusted qualification review | Claim is not trusted; eligibility remains needs_verification |

Profile confirmation is simulated in tests; the demo's browser control is not
exercised by these checks. The server is stateless and does not enforce persisted
confirmation. Member D must implement user ownership and confirmation persistence.

## Remaining external acceptance

- Real PDF upload through the browser with the team's Gemini credentials.
- Human review of semantic extraction, including missing facts and evidence.
- A's real opportunity records and manually reviewed qualification references.
- C/D's production integration, authenticated profile persistence and deployment.
- Python 3.11+ verification in the deployment environment.

The user's previously reported live connection PASS establishes that their key
and selected model worked for the check script. It does not replace full PDF or
production acceptance. Internal flow validation is complete; cross-member
integration remains pending the inputs above.
