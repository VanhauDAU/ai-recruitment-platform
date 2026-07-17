"""V2 CV lifecycle workflows built on top of the version/draft foundation."""

from copy import deepcopy

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.cv_templates.models import CvSampleContent, CvTemplate
from apps.cv_templates.services import resolve_position_content

from ..composition import CvCompositionError, compose_cv_document, layout_for_content, overlay_actor_identity
from ..models import CvDraft, CvVersion, UserCv
from ..schemas import empty_content
from .versions import create_version, document_hash


class CvLifecyclePolicyError(ValueError):
    """The requested lifecycle action violates a CV business policy."""


def _content_for_create(sample_content, position, language):
    if position is not None:
        return resolve_position_content(
            position=position,
            locale=language,
            experience_level='unspecified',
            lock=True,
        )['content_json']
    if sample_content is None:
        return empty_content(language)
    sample_content = CvSampleContent.objects.select_for_update().get(pk=sample_content.pk)
    if sample_content.status != CvSampleContent.Status.PUBLISHED:
        raise CvLifecyclePolicyError('The selected sample content is not published.')
    if sample_content.locale != language:
        raise CvLifecyclePolicyError('The selected sample content is not available in this language.')
    return sample_content.content_json


@transaction.atomic
def create_v2_cv(
    *,
    actor,
    title,
    template,
    language='vi-VN',
    sample_content=None,
    position=None,
    source_cv=None,
    theme_color=None,
):
    """Create a builder CV with an immutable baseline and a mutable draft."""
    if not actor.email_verified:
        raise CvLifecyclePolicyError('Verify your email before creating a CV.')

    template = CvTemplate.objects.select_for_update(of=('self',)).select_related(
        'current_published_version',
    ).get(pk=template.pk)
    if source_cv is not None:
        source_cv = UserCv.objects.select_for_update(of=('self',)).select_related(
            'latest_version', 'position',
        ).get(pk=source_cv.pk, user=actor, is_deleted=False)
        source_draft = CvDraft.objects.select_for_update().filter(cv=source_cv).first()
        source_document = source_draft or source_cv.latest_version
        if source_document is None:
            raise CvLifecyclePolicyError('The source CV has no reusable document.')
        content = source_document.content_json
        language = content.get('locale') or source_cv.language
        position = source_cv.position
    else:
        content = _content_for_create(sample_content, position, language)
        content = overlay_actor_identity(content, actor, clear_demo_contacts=True)
    try:
        document = compose_cv_document(
            template=template,
            content_json=content,
            theme_color=theme_color,
        )
    except CvCompositionError as error:
        raise CvLifecyclePolicyError(str(error)) from error
    template_version = template.current_published_version
    content = document['content_json']
    layout = document['layout_json']
    style = document['style_json']
    cv = UserCv.objects.create(
        user=actor,
        template=template,
        position=position,
        cv_type=UserCv.CvType.BUILDER,
        source=UserCv.Source.BUILDER,
        title=title,
        language=language,
        # Retained only for legacy dual-read while V2 is rolled out.
        cv_data=content,
        style_config=style,
    )
    create_version(
        cv=cv,
        actor=actor,
        content_json=content,
        layout_json=layout,
        style_json=style,
        version_kind=CvVersion.VersionKind.INITIAL,
        template_version=template_version,
        create_or_replace_draft=True,
    )
    CvTemplate.objects.filter(pk=template.pk).update(usage_count=F('usage_count') + 1)
    return UserCv.objects.select_related(
        'template', 'position', 'current_template_version', 'latest_version', 'published_version',
    ).get(pk=cv.pk)


def _lock_draft_for_save(cv, expected_lock_version):
    cv = UserCv.objects.select_for_update(of=('self',)).get(pk=cv.pk)
    if cv.is_deleted or cv.lifecycle_status == UserCv.LifecycleStatus.ARCHIVED:
        raise CvLifecyclePolicyError('Archived or deleted CVs cannot be changed.')
    try:
        draft = CvDraft.objects.select_for_update().get(cv=cv)
    except CvDraft.DoesNotExist as error:
        raise CvLifecyclePolicyError('This CV has no editable draft.') from error
    if draft.lock_version != expected_lock_version:
        from .versions import StaleDraftError

        raise StaleDraftError('This draft was updated in another session. Refresh and merge before saving.')
    return cv, draft


@transaction.atomic
def save_draft_as_version(*, cv, actor, expected_lock_version, publish=False):
    """Persist draft content as a new immutable save or published version."""
    cv, draft = _lock_draft_for_save(cv, expected_lock_version)
    version = create_version(
        cv=cv,
        actor=actor,
        content_json=draft.content_json,
        layout_json=draft.layout_json,
        style_json=draft.style_json,
        version_kind=(CvVersion.VersionKind.PUBLISHED if publish else CvVersion.VersionKind.MANUAL_SAVE),
        template_version=cv.current_template_version,
        parent_version=cv.latest_version,
        update_cv_pointers=True,
    )
    draft.base_version = version
    draft.save(update_fields=['base_version'])
    if publish:
        UserCv.objects.filter(pk=cv.pk).update(
            lifecycle_status=UserCv.LifecycleStatus.PUBLISHED,
            published_version=version,
            published_at=timezone.now(),
        )
    from .thumbnails import schedule_cv_thumbnail

    schedule_cv_thumbnail(version)
    return version


@transaction.atomic
def switch_draft_template(
    *,
    cv,
    actor,
    template_public_id,
    expected_lock_version,
    client_session_id='',
    theme_color=None,
):
    """Switch a mutable draft to a published template without touching content.

    A template version owns its default presentation contract.  The candidate's
    canonical content remains in the same draft; only its layout, style and
    current template pointer change under the same optimistic-lock transaction.
    """
    cv, draft = _lock_draft_for_save(cv, expected_lock_version)
    try:
        template = CvTemplate.objects.select_for_update(of=('self',)).select_related(
            'current_published_version',
        ).get(public_id=template_public_id)
    except CvTemplate.DoesNotExist as error:
        raise CvLifecyclePolicyError('The selected template does not exist.') from error
    if theme_color and not template.color_links.filter(
        color__hex_code__iexact=theme_color,
        color__is_active=True,
    ).exists():
        raise CvLifecyclePolicyError('Color is not available for this template.')
    try:
        document = compose_cv_document(
            template=template,
            content_json=draft.content_json,
            theme_color=theme_color.upper() if theme_color else None,
        )
    except CvCompositionError as error:
        raise CvLifecyclePolicyError(str(error)) from error
    template_version = template.current_published_version
    content = document['content_json']
    layout = document['layout_json']
    style = document['style_json']

    draft.content_json = content
    draft.layout_json = layout
    draft.style_json = style
    draft.schema_version = template_version.schema_version
    draft.document_hash = document_hash(content, layout, style)
    draft.lock_version += 1
    draft.client_session_id = client_session_id
    draft.updated_by = actor
    draft.save(update_fields=[
        'content_json', 'layout_json', 'style_json', 'schema_version', 'document_hash', 'lock_version',
        'client_session_id', 'updated_by', 'updated_at',
    ])
    previous_template_id = cv.template_id
    cv.template = template
    cv.current_template_version = template_version
    # Preserve legacy dual-read projections while the V1 API remains available.
    cv.cv_data = content
    cv.style_config = style
    cv.save(update_fields=[
        'template', 'current_template_version', 'cv_data', 'style_config', 'updated_at',
    ])
    if previous_template_id != template.pk:
        CvTemplate.objects.filter(pk=template.pk).update(usage_count=F('usage_count') + 1)
    return cv, draft


@transaction.atomic
def apply_sample_to_draft(
    *, cv, actor, sample_public_id, expected_lock_version, client_session_id='',
):
    """Replace editable sections with one published sample under the current template."""
    cv, draft = _lock_draft_for_save(cv, expected_lock_version)
    try:
        sample = CvSampleContent.objects.select_for_update().get(
            public_id=sample_public_id,
            status=CvSampleContent.Status.PUBLISHED,
        )
    except CvSampleContent.DoesNotExist as error:
        raise CvLifecyclePolicyError('The selected sample content is unavailable.') from error
    current_locale = draft.content_json.get('locale')
    if sample.locale != current_locale:
        raise CvLifecyclePolicyError('The selected sample content uses another language.')
    current_content = deepcopy(draft.content_json)
    sample_content = deepcopy(sample.content_json)
    marker_keys = {'nameplate', 'contact', 'avatar'}
    markers = [
        section for section in current_content.get('sections', [])
        if isinstance(section, dict) and section.get('section_key') in marker_keys
    ]
    sample_sections = [
        section for section in sample_content.get('sections', [])
        if isinstance(section, dict) and section.get('section_key') not in marker_keys
    ]
    merged = sample_content
    merged['locale'] = current_locale
    merged['personal_info'] = deepcopy(current_content.get('personal_info', {}))
    merged['sections'] = [*markers, *sample_sections]
    layout = layout_for_content(cv.current_template_version, merged)
    style = deepcopy(draft.style_json)
    from ..schemas import validate_cv_document, validate_template_layout_capabilities
    from .assets import validate_document_assets

    validate_cv_document(
        content_json=merged, layout_json=layout, style_json=style, schema_version=1,
    )
    validate_template_layout_capabilities(
        layout_json=layout,
        capabilities=cv.current_template_version.capabilities,
    )
    validate_document_assets(owner=cv.user, content_json=merged, style_json=style)
    draft.content_json = merged
    draft.layout_json = layout
    draft.style_json = style
    draft.document_hash = document_hash(merged, layout, style)
    draft.lock_version += 1
    draft.client_session_id = client_session_id
    draft.updated_by = actor
    draft.save(update_fields=[
        'content_json', 'layout_json', 'style_json', 'document_hash', 'lock_version',
        'client_session_id', 'updated_by', 'updated_at',
    ])
    UserCv.objects.filter(pk=cv.pk).update(
        cv_data=merged,
        style_config=style,
        updated_at=timezone.now(),
    )
    return draft
