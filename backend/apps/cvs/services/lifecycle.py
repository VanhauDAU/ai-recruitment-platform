"""V2 CV lifecycle workflows built on top of the version/draft foundation."""

from copy import deepcopy

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.cv_templates.models import CvSampleContent, CvTemplate, CvTemplateVersion

from ..models import CvDraft, CvVersion, UserCv
from ..schemas import empty_content, empty_layout, empty_style, validate_cv_document
from .versions import create_version


class CvLifecyclePolicyError(ValueError):
    """The requested lifecycle action violates a CV business policy."""


def _published_template_version(template):
    version = template.current_published_version
    if (
        template.status != CvTemplate.Status.ACTIVE
        or template.lifecycle_status != CvTemplate.LifecycleStatus.PUBLISHED
        or version is None
        or version.template_id != template.pk
        or version.version_status != CvTemplateVersion.VersionStatus.PUBLISHED
    ):
        raise CvLifecyclePolicyError('The selected template does not have a published version.')
    return version


@transaction.atomic
def _layout_for_content(template_version, content_json):
    """Place canonical section instances into declared template regions."""
    layout = deepcopy(template_version.default_layout_json or empty_layout())
    regions = layout.get('regions', [])
    if not regions:
        return layout
    regions_by_id = {region.get('id'): region for region in regions if isinstance(region, dict)}
    region_for_section = {
        section.section_definition.section_key: section.region_key
        for section in template_version.sections.select_related('section_definition')
    }
    fallback_region = regions[0]
    for section in content_json.get('sections', []):
        if not isinstance(section, dict) or not section.get('instance_id'):
            continue
        region = regions_by_id.get(region_for_section.get(section.get('section_key')), fallback_region)
        section_ids = region.setdefault('section_instance_ids', [])
        if section['instance_id'] not in section_ids:
            section_ids.append(section['instance_id'])
    return layout


def _content_for_create(sample_content, language):
    if sample_content is None:
        return empty_content(language)
    sample_content = CvSampleContent.objects.select_for_update().get(pk=sample_content.pk)
    if sample_content.status != CvSampleContent.Status.PUBLISHED:
        raise CvLifecyclePolicyError('The selected sample content is not published.')
    if sample_content.locale != language:
        raise CvLifecyclePolicyError('The selected sample content is not available in this language.')
    return deepcopy(sample_content.content_json)


def create_v2_cv(*, actor, title, template, language='vi-VN', sample_content=None):
    """Create a builder CV with an immutable baseline and a mutable draft."""
    if not actor.email_verified:
        raise CvLifecyclePolicyError('Verify your email before creating a CV.')

    template = CvTemplate.objects.select_for_update(of=('self',)).select_related(
        'current_published_version',
    ).get(pk=template.pk)
    template_version = _published_template_version(template)
    content = _content_for_create(sample_content, language)
    layout = _layout_for_content(template_version, content)
    style = deepcopy(template_version.default_style_json or empty_style())
    validate_cv_document(
        content_json=content,
        layout_json=layout,
        style_json=style,
        schema_version=template_version.schema_version,
    )
    cv = UserCv.objects.create(
        user=actor,
        template=template,
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
        'template', 'current_template_version', 'latest_version', 'published_version',
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
    return version
