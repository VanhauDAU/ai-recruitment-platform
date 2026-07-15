from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import CvContentBlueprint, CvSampleContent, CvTemplate, CvTemplateVersion


@transaction.atomic
def publish_template_version(*, template, version):
    template = CvTemplate.objects.select_for_update().get(pk=template.pk)
    version = CvTemplateVersion.objects.select_for_update().get(pk=version.pk, template=template)
    if version.version_status != CvTemplateVersion.VersionStatus.DRAFT:
        raise ValidationError({'version': 'Only a draft template version can be published.'})
    version.full_clean()
    now = timezone.now()
    version.version_status = CvTemplateVersion.VersionStatus.PUBLISHED
    version.published_at = now
    version.save(update_fields=['version_status', 'published_at'])
    template.current_published_version = version
    template.lifecycle_status = CvTemplate.LifecycleStatus.PUBLISHED
    template.status = CvTemplate.Status.ACTIVE
    template.save(update_fields=['current_published_version', 'lifecycle_status', 'status'])
    return version


@transaction.atomic
def retire_template_version(*, template, version):
    template = CvTemplate.objects.select_for_update().get(pk=template.pk)
    version = CvTemplateVersion.objects.select_for_update().get(pk=version.pk, template=template)
    if template.current_published_version_id == version.pk:
        raise ValidationError({'version': 'Publish another version before retiring the current one.'})
    if version.version_status != CvTemplateVersion.VersionStatus.PUBLISHED:
        raise ValidationError({'version': 'Only a published version can be retired.'})
    version.version_status = CvTemplateVersion.VersionStatus.RETIRED
    version.retired_at = timezone.now()
    version.save(update_fields=['version_status', 'retired_at'])
    return version


@transaction.atomic
def publish_sample(sample):
    sample = CvSampleContent.objects.select_for_update().get(pk=sample.pk)
    if sample.status != CvSampleContent.Status.DRAFT:
        raise ValidationError({'status': 'Only draft sample content can be published.'})
    sample.full_clean()
    sample.status = CvSampleContent.Status.PUBLISHED
    sample.published_at = timezone.now()
    sample.save(update_fields=['status', 'published_at', 'updated_at'])
    return sample


@transaction.atomic
def archive_sample(sample):
    sample = CvSampleContent.objects.select_for_update().get(pk=sample.pk)
    sample.status = CvSampleContent.Status.ARCHIVED
    sample.save(update_fields=['status', 'updated_at'])
    return sample


@transaction.atomic
def activate_blueprint(blueprint):
    blueprint = CvContentBlueprint.objects.select_for_update().get(pk=blueprint.pk)
    blueprint.full_clean()
    blueprint.is_active = True
    blueprint.save(update_fields=['is_active', 'updated_at'])
    return blueprint
