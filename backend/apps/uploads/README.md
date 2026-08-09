# Shared upload quarantine core

This app owns temporary untrusted bytes and the scanner evidence needed by
employer and candidate workflows. It does not import either domain and it does
not attach files to a business record by itself.

## Lifecycle and trust

```text
uploading -> quarantined -> scanning -> clean | rejected | error | expired
                                      error -> scanning (bounded retry)
```

- Only a `clean` session has a private `UploadAsset`.
- Existing objects may be registered only as `legacy_trusted`; that path does
  no storage read and never creates scan evidence.
- `rejected`, `error`, `scanning`, `quarantined` and `expired` are never
  attachable or downloadable.
- Quarantine and private storage never expose `.url()`.

## Authoritative domain contract

Domain code must call `claim_clean_upload` with the authenticated owner and an
`expected_purpose`. A clean upload created for another purpose fails closed;
`claim_scope` and `claim_reference` are only immutable idempotency/audit
references, never authorization.

Claimed assets survive upload-session TTL. They become cleanup-eligible only
after the same domain explicitly calls `release_claimed_upload`, the 730-day
minimum retention has elapsed, and no legal hold exists. Unclaimed clean assets
expire with their temporary session. Terminal redacted scan evidence is purged
after its own retention deadline only when no bytes remain. At that boundary,
deleted clean-asset rows are privacy-scrubbed (owner, filename, checksum and
claim references) before their session is removed. An unreleased claim or legal
hold blocks both evidence purge and asset scrubbing.

Public endpoints under `/api/uploads/sessions/` are owner-scoped and return 404
for another owner. They expose state, safe result code and retryability, but no
storage key, checksum, threat signature, scanner version or endpoint. There is
intentionally no generic claim or download endpoint. Status polling has its own
`upload_status` throttle (`120/min`); create/cancel/retry remain in the stricter
`upload_session` write bucket (`30/hour`). Authentication intentionally comes
from the global DRF `IsAuthenticated` default and has an API regression test.

Session creation is fail-closed by a code-owned purpose/role capability map:
employer purposes accept only employer accounts and `candidate_cv` accepts only
candidate accounts. The service locks the owner row before checking the active
session and declared-byte quotas, so concurrent requests cannot bypass either
limit. A clean asset stops consuming temporary quota only after an explicit
business claim. Expiry alone never releases quota while quarantine bytes or an
unclaimed private object remain; cleanup must clear the persisted storage key
first, preventing a storage outage from becoming an unbounded-byte bypass.

## Operations

- `UPLOAD_QUARANTINE_ENABLED=false` is fail closed.
- Production rejects fake scanners, an empty purpose allowlist, missing ClamAV
  host, unsafe DOCX limits, fewer than 730 retention days and invalid leases.
- `python manage.py check_upload_scanner_readiness --json` performs the live
  PING probe without printing endpoint or scanner version.
- Celery routes scan, reconciliation, expiry, cleanup and evidence purge to
  `upload-scan`; the worker must consume that queue.
- DOCX validation reads only bounded ZIP central-directory metadata. Generic,
  encrypted, traversal, duplicate-entry and high-expansion archives are
  rejected before quarantine; Office content is never extracted before scan.

PDF and image pre-scan checks currently validate only the declared MIME, size
and file signature. Parser-specific structural validation for those formats is
a documented residual for the consuming domain integration; a malware-clean
verdict must not be represented as parser-level file validity.

Metrics and logs use only public session identifiers, state and stable result
codes. Raw filename, storage key, checksum, malware signature and provider
exception text are prohibited.
