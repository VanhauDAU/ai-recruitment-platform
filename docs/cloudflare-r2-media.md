# Cloudflare R2 media policy

The backend is the only R2 client. Access keys and secret keys belong in the
runtime `backend/.env` or deployment secret store; they must never be exposed
to React, a `VITE_*` variable, a commit, or `backend/.env.example`.

## Buckets and object layout

| Bucket | Data | Object-key prefixes |
| --- | --- | --- |
| `procv-public-media` | Images that can be rendered anonymously | `site/`, `blog/`, `employers/`, `jobs/`, `cv-templates/`, `cvs/backgrounds/`, `migrations/external-media/` |
| `procv-private-files` | Candidate data and legal documents | `cvs/uploads/`, `cvs/imports/`, `cvs/assets/`, `cvs/exports/`, `cvs/thumbnails/`, `employers/*/documents/` |

Private object keys are database-only. The browser receives private files only
through an authorized Django download/preview endpoint; it never receives an
R2 URL or credential. This includes CV exports/thumbnails/assets and employer
verification documents. Public media resolves through `R2_PUBLIC_BASE_URL`.

## Runtime configuration

Set these values only in the backend environment: `R2_ENDPOINT_URL`,
`R2_PUBLIC_ACCESS_KEY_ID`, `R2_PUBLIC_SECRET_ACCESS_KEY`,
`R2_PRIVATE_ACCESS_KEY_ID`, `R2_PRIVATE_SECRET_ACCESS_KEY`,
`R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, and `R2_PUBLIC_BASE_URL`. Keep
`R2_REGION_NAME=auto`. The public and private bucket tokens are deliberately
separate. Production refuses to start if this R2 configuration is incomplete.

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

If this deployment has an existing `backend/media` directory, copy it before
switching traffic so old storage keys stay resolvable. This does not delete the
local source files:

```bash
cd backend
venv/bin/python manage.py migrate_local_media_to_r2
venv/bin/python manage.py migrate_local_media_to_r2 --apply
```
