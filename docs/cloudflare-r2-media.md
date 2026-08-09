# Cloudflare R2 media policy

The backend is the only R2 client. Access keys and secret keys belong in the
runtime `backend/.env` or deployment secret store; they must never be exposed
to React, a `VITE_*` variable, a commit, or `backend/.env.example`.

## Buckets and object layout

| Bucket | Data | Object-key prefixes |
| --- | --- | --- |
| `procv-public-media` | Images that can be rendered anonymously | `site/`, `blog/`, `employers/`, `jobs/`, `cv-templates/`, `cvs/backgrounds/`, `migrations/external-media/` |
| `procv-private-files` | Candidate data and legal documents | `cvs/uploads/`, `cvs/imports/`, `cvs/assets/`, `cvs/exports/`, `cvs/thumbnails/`, `employers/*/documents/` |
| `procv-upload-quarantine` | Untrusted bytes before a scanner decision | random upload-session keys only; never business/storage keys |

Private object keys are database-only. The browser receives private files only
through an authorized Django download/preview endpoint; it never receives an
R2 URL or credential. Both local and R2 private/quarantine backends raise if
application code calls `.url()`. This includes CV exports/thumbnails/assets and
employer verification documents. Public media resolves through
`R2_PUBLIC_BASE_URL`.

## Runtime configuration

Set these values only in the backend environment: `R2_ENDPOINT_URL`,
`R2_PUBLIC_ACCESS_KEY_ID`, `R2_PUBLIC_SECRET_ACCESS_KEY`,
`R2_PRIVATE_ACCESS_KEY_ID`, `R2_PRIVATE_SECRET_ACCESS_KEY`,
`R2_QUARANTINE_ACCESS_KEY_ID`, `R2_QUARANTINE_SECRET_ACCESS_KEY`,
`R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_QUARANTINE_BUCKET`, and
`R2_PUBLIC_BASE_URL`. Keep `R2_REGION_NAME=auto`. All three bucket tokens and
bucket names are deliberately separate. Production refuses to start if the
public/private R2 configuration or quarantine configuration is incomplete; it
must never silently fall back to local storage.

## Moving existing public URLs

First inspect what will be changed:

```bash
cd backend
venv/bin/python manage.py migrate_external_media_to_r2
```

Then apply the migration:

```bash
venv/bin/python manage.py migrate_external_media_to_r2 --apply
```

The command only migrates structured public raster-image fields and is
idempotent. It deliberately excludes legal documents, CVs, exports and
candidate avatar assets: those objects are private and must keep their
authorization boundary.

The legacy frontend illustration set is migrated separately, because those
assets are compile-time source constants rather than database records:

```bash
cd backend
venv/bin/python manage.py migrate_frontend_assets_to_r2 --apply
```

If this deployment has an existing shared `backend/media` directory, first
audit and copy it into the isolated destinations. The command is dry-run by
default, resumable with `--cursor`, bounded by `--batch-size`, verifies content
hashes, and always retains the unserved legacy source:

```bash
cd backend
python manage.py migrate_media_storage_layout --json --batch-size 500
python manage.py migrate_media_storage_layout --apply --json --batch-size 500
```

Repeat with the returned `next_cursor` until `has_more=false`, then reconcile
counts before traffic. For a direct legacy-to-R2 copy, the older command remains
available:

```bash
cd backend
venv/bin/python manage.py migrate_local_media_to_r2
venv/bin/python manage.py migrate_local_media_to_r2 --apply
```

`LEGACY_MEDIA_ROOT` must not be exposed by Django, Vite or nginx. Only
`PUBLIC_MEDIA_ROOT` may be served at `/media/`; private and quarantine buckets
must return 403/404 on direct object requests.
