# ER-3 storage-boundary rollout runbook

This runbook activates the P0 public/private/quarantine boundary. It does not
claim malware scanning is complete; raw DOC/DOCX pre-submit preview remains
disabled with `UPLOAD_SCAN_REQUIRED` until a clean upload-session path exists.

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

## Rollback

Stop new uploads, roll application traffic back, and remount the retained
legacy volume only behind the previous controlled deployment. Never expose the
legacy root alongside the new `/media/` route, never mark an unscanned upload
clean, and never fall back from R2 private/quarantine to public/local storage.
Keep migration reports and mismatch evidence for reconciliation.
