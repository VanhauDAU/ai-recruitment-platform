"""Write workflows for the CV domain."""

from .cvs import UnsupportedCvUpload, archive_cv, create_builder_cv, update_builder_cv, upload_cv
from .versions import StaleDraftError, create_application_snapshot, create_initial_document, create_version, update_draft

__all__ = [
    'StaleDraftError',
    'UnsupportedCvUpload',
    'archive_cv',
    'create_application_snapshot',
    'create_builder_cv',
    'create_initial_document',
    'create_version',
    'update_builder_cv',
    'update_draft',
    'upload_cv',
]

from .cvs import (
    UnsupportedCvUpload,
    archive_cv,
    create_builder_cv,
    upload_cv,
)

__all__ = ['UnsupportedCvUpload', 'archive_cv', 'create_builder_cv', 'upload_cv']
