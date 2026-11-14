from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import CvSampleContent, CvTemplate, CvTemplateVersion


@transaction.atomic
def publish_template_version(*, template, version, actor=None):
    """Xuất bản bản nháp và chuyển bản đang xuất bản sang `retired`.

    CV đã tạo vẫn ghim phiên bản cũ (bất biến), nên retire chỉ đổi phiên bản
    dùng cho CV mới.
    """
    template = CvTemplate.objects.select_for_update().get(pk=template.pk)
    version = CvTemplateVersion.objects.select_for_update().get(pk=version.pk, template=template)
    if version.version_status != CvTemplateVersion.VersionStatus.DRAFT:
        raise ValidationError({'version': 'Only a draft template version can be published.'})
    version.full_clean()
    now = timezone.now()
    template.versions.filter(version_status=CvTemplateVersion.VersionStatus.PUBLISHED).exclude(
        pk=version.pk
    ).update(version_status=CvTemplateVersion.VersionStatus.RETIRED, retired_at=now)
    version.version_status = CvTemplateVersion.VersionStatus.PUBLISHED
    version.published_at = now
    version.published_by = actor
    version.save(update_fields=['version_status', 'published_at', 'published_by'])
    template.current_published_version = version
    template.lifecycle_status = CvTemplate.LifecycleStatus.PUBLISHED
    template.save(update_fields=['current_published_version', 'lifecycle_status'])
    return version


@transaction.atomic
def retire_template_version(*, template, version):
    template = CvTemplate.objects.select_for_update().get(pk=template.pk)
    version = CvTemplateVersion.objects.select_for_update().get(pk=version.pk, template=template)
    if template.current_published_version_id == version.pk:
        raise ValidationError(
            {'version': 'Publish another version before retiring the current one.'}
        )
    if version.version_status != CvTemplateVersion.VersionStatus.PUBLISHED:
        raise ValidationError({'version': 'Only a published version can be retired.'})
    version.version_status = CvTemplateVersion.VersionStatus.RETIRED
    version.retired_at = timezone.now()
    version.save(update_fields=['version_status', 'retired_at'])
    return version


@transaction.atomic
def publish_sample(sample, *, actor=None):
    """Xuất bản bản nháp hoặc bản AI chờ duyệt; bản đang xuất bản cùng tổ hợp được lưu trữ.

    Mỗi (vị trí, ngôn ngữ, nhóm kinh nghiệm) chỉ có một nội dung xuất bản (ràng
    buộc DB). Người xuất bản được ghi là người duyệt.
    """
    sample = CvSampleContent.objects.select_for_update().get(pk=sample.pk)
    if sample.status not in {CvSampleContent.Status.DRAFT, CvSampleContent.Status.IN_REVIEW}:
        raise ValidationError(
            {'status': 'Only draft or in-review sample content can be published.'}
        )
    sample.full_clean()
    CvSampleContent.objects.select_for_update().filter(
        position_profile=sample.position_profile,
        locale=sample.locale,
        experience_band=sample.experience_band,
        status=CvSampleContent.Status.PUBLISHED,
    ).update(status=CvSampleContent.Status.ARCHIVED, updated_at=timezone.now())
    now = timezone.now()
    sample.status = CvSampleContent.Status.PUBLISHED
    sample.published_at = now
    sample.reviewed_by = actor
    sample.reviewed_at = now
    sample.save(
        update_fields=['status', 'published_at', 'reviewed_by', 'reviewed_at', 'updated_at']
    )
    return sample


@transaction.atomic
def archive_sample(sample):
    sample = CvSampleContent.objects.select_for_update().get(pk=sample.pk)
    sample.status = CvSampleContent.Status.ARCHIVED
    sample.save(update_fields=['status', 'updated_at'])
    return sample
