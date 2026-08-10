# ER-3 storage-boundary rollout runbook

This runbook activates the P0 public/private/quarantine boundary and the
employer upload-session consumer. Raw DOC/DOCX pre-submit preview remains
disabled with `UPLOAD_SCAN_REQUIRED`; Office bytes are never parsed before a
clean verdict. Candidate CV integration and real-scanner staging are separate
remaining gates, so ER-3 is not complete merely because employer strict mode is
enabled.

## Invariants

- `/media/` maps only to `PUBLIC_MEDIA_ROOT` or the public R2 bucket.
- `LEGACY_MEDIA_ROOT`, `PRIVATE_MEDIA_ROOT`, and `UPLOAD_QUARANTINE_ROOT` are
  never mounted into nginx and are never handled by Django's DEBUG static URL.
- Private/quarantine `.url()` raises. Binary delivery uses an authorized Django
  endpoint and an unchanged storage key.
- Unknown legacy keys classify as private. `gallery/` and historical
  `gallerys/` classify as public.
- A schema migration never reads, copies, moves, or deletes object bytes.

## Preflight and non-destructive copy

1. Back up the legacy volume and database; record object/file counts.
2. Configure four distinct, non-nested roots. For R2 configure three distinct
   buckets and three least-privilege credential pairs.
3. Stop write traffic or place uploads in maintenance mode.
4. Với Docker Compose, chỉ khởi tạo các destination volume; chưa khởi động
   `backend`, `worker` hoặc `nginx` nhận traffic:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml \
     up media-init
   ```

5. Run a dry-run batch and archive its JSON. Container one-off có legacy
   volume read-only và ba destination volume, nhưng không publish port:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm \
     backend python manage.py migrate_media_storage_layout --json --batch-size 500
   ```

6. Review every private/public classification. Add a public prefix only after a
   security review; never change unknown-key behavior.
7. Run the same batch with `--apply`, then resume using the returned cursor:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm \
     backend python manage.py migrate_media_storage_layout \
     --apply --json --batch-size 500
   docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm \
     backend python manage.py migrate_media_storage_layout \
     --apply --json --batch-size 500 --cursor '<next_cursor>'
   ```

8. Chỉ sau report cuối `has_more=false`, `conflicts=0`, checksum và direct-access
   probes đạt mới khởi động application/worker/nginx nhận traffic.

The command copies and SHA-256 verifies the destination. It is idempotent and
does not delete the legacy source. A destination mismatch stops the batch and
retains both objects for manual reconciliation.

## Cutover gates

- `python manage.py check --deploy` and migration drift pass.
- Apply report has zero conflicts and the final batch has `has_more=false`.
- Authorized employer document and CV endpoints can still stream migrated keys.
- Direct `/media/employers/.../documents/...` and
  `/media/cvs/imports/...` return 404.
- Direct private/quarantine R2 requests return 403/404 and API responses contain
  no key, signed URL, scanner detail, credential, or filesystem path.
- `nginx -t` and `docker compose config` show only the public media volume on
  nginx; backend and worker have separate public/private/quarantine mounts.
- Compose config mounts the retained `backend_media` volume only at
  `/app/legacy-media:ro`; no service maps it to `/media/` or an nginx path.
- Clean, EICAR, scanner timeout and scanner-down tests are mandatory before the
  later quarantine feature flag is enabled.
- Verify `UPLOAD_OWNER_MAX_ACTIVE_SESSIONS` and
  `UPLOAD_OWNER_MAX_ACTIVE_BYTES` against expected traffic. Session creation
  locks the owner before checking both quotas; do not replace this with a
  cache-only counter. The active-byte limit must be at least `UPLOAD_MAX_BYTES`.
  Expired/rejected rows with a persisted quarantine key, and expired clean rows
  with an unclaimed private key, continue consuming quota until cleanup succeeds.
- DOCX receives bounded container checks before scan. At the employer business
  boundary, clean PDF is parsed strict with pypdf and clean image is verified
  with Pillow against declared format before claim is committed. Candidate CV
  paths need their own parser gate; a scanner verdict alone is never structural
  validity.
- Render production Compose and assert the worker consumes `upload-scan`; both
  the direct scan task and Beat reconciliation/expiry tasks are routed there:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml config
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec worker celery -A config inspect active_queues
  ```

  The rendered worker command and `active_queues` output must contain
  `upload-scan`. A deploy with an orphaned scan queue is a hard stop.
- With `UPLOAD_QUARANTINE_ENABLED=true`, run
  `python manage.py check` and
  `python manage.py check_upload_scanner_readiness --json`; production startup
  must fail for a fake backend, empty purpose allowlist or missing ClamAV host.

## Employer domain activation sequence

1. Deploy migrations and backend while
   `UPLOAD_QUARANTINE_ENABLED=false` and
   `EMPLOYER_UPLOAD_SESSION_REQUIRED=false`. This is additive; existing clients
   may still send multipart raw files.
2. Deploy the frontend session consumer. It attempts the secure path first and
   only falls back to raw when create-session returns exact
   `UPLOAD_PIPELINE_DISABLED`. Rejection, timeout, scanner outage and malformed
   file must remain fail closed.
3. Configure real ClamAV, start a worker consuming `upload-scan`, then enable
   `UPLOAD_QUARANTINE_ENABLED=true`. Run readiness, clean, EICAR, timeout,
   outage, retry, expiry and cleanup probes. Confirm employer document/media
   attaches include an `UploadAsset` audit link.
4. After telemetry shows no supported client needs raw upload, set
   `EMPLOYER_UPLOAD_SESSION_REQUIRED=true`. Production startup intentionally
   fails if strict is true while quarantine is false. Probe raw document and
   media requests for `409 UPLOAD_SESSION_REQUIRED`.
5. Do not mark ER-3 verified until candidate imports/assets use the shared core
   and the staging evidence has been approved.

Strict-mode rollback may set `EMPLOYER_UPLOAD_SESSION_REQUIRED=false` while the
pipeline remains enabled. Do not disable quarantine as a response to scanner
errors and do not expose private/direct URLs. A frontend fallback is permitted
only when the entire pipeline is deliberately disabled during the additive
compatibility window.

## Rollback

Stop new uploads, roll application traffic back, and remount the retained
legacy volume only behind the previous controlled deployment. Never expose the
legacy root alongside the new `/media/` route, never mark an unscanned upload
clean, and never fall back from R2 private/quarantine to public/local storage.
Keep migration reports and mismatch evidence for reconciliation.
