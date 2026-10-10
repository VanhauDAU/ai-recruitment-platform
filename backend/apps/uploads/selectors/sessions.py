from apps.uploads.models import UploadSession


def owned_upload_session(*, owner, public_id):
    """Return one owner-scoped session or None without leaking cross-owner existence."""
    return (
        UploadSession.objects.select_related('asset')
        .filter(
            owner=owner,
            public_id=public_id,
        )
        .first()
    )
