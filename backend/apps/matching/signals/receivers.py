"""Tính sẵn vector khi CV có phiên bản mới hoặc tin tuyển dụng đang mở được lưu.

Nhờ vậy lúc ứng viên bấm "Xem độ phù hợp" thường chỉ còn bước chấm điểm. Việc
gửi task đợi tới khi transaction commit và mới đọc cờ tính năng lúc đó, nên lưu
CV/tin không phát sinh thêm truy vấn nào.
"""

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.cvs.models import CvVersion
from apps.jobs.models import Job
from apps.matching.services import matching_enabled

# Trường của tin ảnh hưởng tới hồ sơ đối sánh; lưu các trường khác thì bỏ qua.
JOB_PROFILE_FIELDS = {
    'title',
    'description',
    'requirements',
    'status',
    'experience_years',
    'education_level',
    'position_level',
}


def _dispatch(task, object_id):
    if settings.MATCHING_PRECOMPUTE_ENABLED and matching_enabled():
        task.delay(object_id)


@receiver(post_save, sender=CvVersion, dispatch_uid='matching_embed_cv_version')
def embed_new_cv_version(sender, instance, created, **kwargs):
    if created and settings.MATCHING_PRECOMPUTE_ENABLED:
        from apps.matching.tasks import embed_cv_version

        transaction.on_commit(lambda: _dispatch(embed_cv_version, instance.pk))


@receiver(post_save, sender=Job, dispatch_uid='matching_embed_job')
def embed_active_job(sender, instance, update_fields=None, **kwargs):
    if not settings.MATCHING_PRECOMPUTE_ENABLED or instance.status != Job.Status.ACTIVE:
        return
    if update_fields is not None and not JOB_PROFILE_FIELDS & set(update_fields):
        return
    from apps.matching.tasks import embed_job

    transaction.on_commit(lambda: _dispatch(embed_job, instance.pk))
