"""Version and draft write workflows for the CV aggregate."""

import json
from hashlib import sha256

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from ..models import CvDraft, CvVersion, UserCv
from ..schemas import (
    empty_content,
    empty_layout,
    empty_style,
    validate_cv_document,
    validate_template_layout_capabilities,
)
from .assets import validate_document_assets
from .matching_profile import sync_matching_profile


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
            description = item.get('description')
            if isinstance(description, dict):
                values.extend(
                    block.get('text', '')
                    for block in description.get('content', [])
                    if isinstance(block, dict) and isinstance(block.get('text'), str)
                )
    return '\n'.join(value for value in values if value)


def create_initial_document(
    cv, actor, version_kind=CvVersion.VersionKind.INITIAL, content_json=None
):
    """Create an immutable baseline plus the one mutable draft for a CV."""
    content = content_json if content_json is not None else empty_content(cv.language)
    layout, style = empty_layout(), empty_style()
    layout['regions'][0]['section_instance_ids'] = [
        section['instance_id'] for section in content.get('sections', [])
    ]
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
    # Bản CV do caller truyền vào không bị bỏ quên: bên dưới nạp lại một instance khoá hàng để ghi,
    # nên phải đồng bộ con trỏ ngược lại instance gốc, nếu không caller (và serializer dùng nó)
    # vẫn thấy latest_version = None dù DB đã có version.
    caller_cv = cv
    cv = (
        UserCv.objects.select_for_update(of=('self',))
        .select_related(
            'template__current_published_version',
        )
        .get(pk=cv.pk)
    )
    resolved_template_version = template_version or cv.current_template_version
    validate_cv_document(
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        schema_version=1,
    )
    validate_document_assets(
        owner=cv.user,
        content_json=content_json,
        style_json=style_json,
    )
    if resolved_template_version is not None:
        validate_template_layout_capabilities(
            layout_json=layout_json,
            capabilities=resolved_template_version.capabilities,
        )
    parent_version = parent_version if parent_version is not None else cv.latest_version
    version_number = (
        CvVersion.objects.filter(cv=cv).aggregate(max_number=Max('version_number'))['max_number']
        or 0
    ) + 1
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
        cv.save(update_fields=['latest_version', 'current_template_version', 'updated_at'])
        if caller_cv is not cv:
            caller_cv.latest_version = version
            caller_cv.current_template_version = resolved_template_version
    sync_matching_profile(cv, content_json)
    caller_cv.experience_years = cv.experience_years
    if create_or_replace_draft:
        CvDraft.objects.update_or_create(
            cv=cv,
            defaults={
                'base_version': version,
                'content_json': content_json,
                'layout_json': layout_json,
                'style_json': style_json,
                'schema_version': 1,
                'document_hash': version.content_hash,
                'lock_version': 0,
                'updated_by': actor,
            },
        )
    return version


@transaction.atomic
def update_draft(
    *, cv, actor, content_json, layout_json, style_json, expected_lock_version, client_session_id=''
):
    """Autosave with compare-and-swap semantics; raises on stale client state."""
    if cv.is_deleted or cv.lifecycle_status == UserCv.LifecycleStatus.ARCHIVED:
        from .lifecycle import CvLifecyclePolicyError

        raise CvLifecyclePolicyError('Archived or deleted CVs cannot be changed.')
    validate_cv_document(
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        schema_version=1,
    )
    validate_document_assets(
        owner=cv.user,
        content_json=content_json,
        style_json=style_json,
    )
    if cv.current_template_version_id:
        validate_template_layout_capabilities(
            layout_json=layout_json,
            capabilities=cv.current_template_version.capabilities,
        )
    next_document_hash = document_hash(content_json, layout_json, style_json)
    updated = CvDraft.objects.filter(cv=cv, lock_version=expected_lock_version).update(
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        schema_version=1,
        document_hash=next_document_hash,
        lock_version=expected_lock_version + 1,
        client_session_id=client_session_id,
        updated_by=actor,
        updated_at=timezone.now(),
    )
    if updated != 1:
        raise StaleDraftError(
            'This draft was updated in another session. Refresh and merge before saving.'
        )
    UserCv.objects.filter(pk=cv.pk).update(updated_at=timezone.now())
    return CvDraft.objects.get(cv=cv)


def create_application_snapshot(cv, actor, source_version=None):
    """Copy one selected immutable document for an application-owned snapshot."""
    cv = (
        UserCv.objects.select_for_update(of=('self',))
        .select_related('latest_version')
        .get(pk=cv.pk)
    )
    if source_version is None:
        base_version = cv.latest_version or create_initial_document(cv, actor)
    else:
        base_version = (
            CvVersion.objects.filter(
                pk=source_version.pk,
                cv=cv,
            )
            .exclude(
                version_kind=CvVersion.VersionKind.APPLICATION_SNAPSHOT,
            )
            .select_related('template_version')
            .first()
        )
        if base_version is None:
            raise ValueError('Select an immutable CV version owned by this CV.')
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
