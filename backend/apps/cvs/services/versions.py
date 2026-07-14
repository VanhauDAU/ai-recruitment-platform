"""Version and draft write workflows for the CV aggregate."""

from hashlib import sha256
import json

from django.db import transaction
from django.db.models import Max

from ..models import CvDraft, CvVersion, UserCv
from ..schemas import canonicalize_legacy_cv_data, validate_cv_document


class StaleDraftError(ValueError):
    """The client attempted an autosave using an obsolete optimistic lock."""


def document_hash(content_json, layout_json, style_json):
    payload = json.dumps(
        {'content': content_json, 'layout': layout_json, 'style': style_json},
        ensure_ascii=False,
        sort_keys=True,
        separators=(',', ':'),
    )
    return sha256(payload.encode('utf-8')).hexdigest()


def plain_text_from_content(content_json):
    """Small deterministic projection; search extraction can replace it later."""
    values = []
    personal_info = content_json.get('personal_info', {})
    if isinstance(personal_info, dict):
        values.extend(value for value in personal_info.values() if isinstance(value, str))
    for section in content_json.get('sections', []):
        if not isinstance(section, dict):
            continue
        values.append(section.get('title', ''))
        for item in section.get('items', []):
            if not isinstance(item, dict):
                continue
            values.extend(value for value in item.values() if isinstance(value, str))
    return '\n'.join(value for value in values if value)


def create_initial_document(cv, actor, version_kind=CvVersion.VersionKind.INITIAL):
    """Create an immutable V1 baseline plus the one mutable draft for a CV."""
    content, layout, style = canonicalize_legacy_cv_data(cv.cv_data, cv.style_config, cv.language)
    template_version = cv.template.current_published_version if cv.template_id else None
    return create_version(
        cv=cv,
        actor=actor,
        content_json=content,
        layout_json=layout,
        style_json=style,
        version_kind=version_kind,
        template_version=template_version,
        update_cv_pointers=True,
        create_or_replace_draft=True,
    )


@transaction.atomic
def create_version(
    *,
    cv,
    actor,
    content_json,
    layout_json,
    style_json,
    version_kind=CvVersion.VersionKind.MANUAL_SAVE,
    template_version=None,
    parent_version=None,
    update_cv_pointers=True,
    create_or_replace_draft=False,
):
    """Persist a validated immutable snapshot under a CV row lock."""
    cv = UserCv.objects.select_for_update(of=('self',)).select_related(
        'template__current_published_version',
    ).get(pk=cv.pk)
    validate_cv_document(
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        schema_version=1,
    )
    resolved_template_version = template_version or cv.current_template_version
    parent_version = parent_version if parent_version is not None else cv.latest_version
    version_number = (CvVersion.objects.filter(cv=cv).aggregate(max_number=Max('version_number'))['max_number'] or 0) + 1
    version = CvVersion(
        cv=cv,
        version_number=version_number,
        version_kind=version_kind,
        template_version=resolved_template_version,
        parent_version=parent_version,
        schema_version=1,
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        plain_text=plain_text_from_content(content_json),
        content_hash=document_hash(content_json, layout_json, style_json),
        created_by=actor,
    )
    version.full_clean()
    version.save(force_insert=True)

    if update_cv_pointers:
        cv.latest_version = version
        cv.current_template_version = resolved_template_version
        cv.current_version = version.version_number  # legacy dual-write projection
        cv.save(update_fields=['latest_version', 'current_template_version', 'current_version', 'updated_at'])
    if create_or_replace_draft:
        CvDraft.objects.update_or_create(
            cv=cv,
            defaults={
                'base_version': version,
                'content_json': content_json,
                'layout_json': layout_json,
                'style_json': style_json,
                'schema_version': 1,
                'lock_version': 0,
                'updated_by': actor,
            },
        )
    return version


@transaction.atomic
def update_draft(*, cv, actor, content_json, layout_json, style_json, expected_lock_version, client_session_id=''):
    """Autosave with compare-and-swap semantics; raises on stale client state."""
    validate_cv_document(
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        schema_version=1,
    )
    updated = CvDraft.objects.filter(cv=cv, lock_version=expected_lock_version).update(
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        schema_version=1,
        lock_version=expected_lock_version + 1,
        client_session_id=client_session_id,
        updated_by=actor,
    )
    if updated != 1:
        raise StaleDraftError('This draft was updated in another session. Refresh and merge before saving.')
    return CvDraft.objects.get(cv=cv)


def sync_legacy_builder_draft(cv, actor):
    """Dual-write adapter for the existing V1 update endpoint."""
    if cv.cv_type != UserCv.CvType.BUILDER:
        return None
    content, layout, style = canonicalize_legacy_cv_data(cv.cv_data, cv.style_config, cv.language)
    validate_cv_document(
        content_json=content,
        layout_json=layout,
        style_json=style,
        schema_version=1,
    )
    draft, _ = CvDraft.objects.get_or_create(
        cv=cv,
        defaults={
            'base_version': cv.latest_version,
            'content_json': content,
            'layout_json': layout,
            'style_json': style,
            'updated_by': actor,
        },
    )
    if draft.pk:
        draft.content_json = content
        draft.layout_json = layout
        draft.style_json = style
        draft.updated_by = actor
        draft.lock_version += 1
        draft.full_clean()
        draft.save()
    return draft


def create_application_snapshot(cv, actor):
    """Copy the latest immutable document for an application-owned snapshot."""
    cv = UserCv.objects.select_for_update(of=('self',)).select_related('latest_version').get(pk=cv.pk)
    base_version = cv.latest_version or create_initial_document(cv, actor)
    return create_version(
        cv=cv,
        actor=actor,
        content_json=base_version.content_json,
        layout_json=base_version.layout_json,
        style_json=base_version.style_json,
        version_kind=CvVersion.VersionKind.APPLICATION_SNAPSHOT,
        template_version=base_version.template_version,
        parent_version=base_version,
        update_cv_pointers=False,
    )
