"""Số liệu trang Tổng quan Mẫu CV (CVT-4), chỉ từ dữ liệu đang có.

Tỉ lệ "xem mẫu → tạo CV" cần ghi lượt xem trang mẫu, chưa có (CVT-7).
"""

from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.ai_core.models import AiInvocation
from apps.cvs.models import CvImportJob, UserCv

from ..models import (
    CvPositionProfile,
    CvSampleContent,
    CvSampleGeneration,
    CvTemplate,
    CvTemplateColorLink,
    CvTemplateVersion,
)

STALE_DRAFT_DAYS = 7
TOP_TEMPLATES = 5


def cv_admin_overview(now=None):
    now = now or timezone.now()
    since_7, since_30 = now - timedelta(days=7), now - timedelta(days=30)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    created = UserCv.objects.filter(is_deleted=False).aggregate(
        last_7=Count('pk', filter=Q(created_at__gte=since_7)),
        last_30=Count('pk', filter=Q(created_at__gte=since_30)),
        uploaded_30=Count('pk', filter=Q(created_at__gte=since_30, cv_type=UserCv.CvType.UPLOADED)),
    )
    imports = CvImportJob.objects.filter(queued_at__gte=since_30).aggregate(
        finished=Count(
            'pk', filter=Q(status__in=[CvImportJob.Status.COMPLETED, CvImportJob.Status.FAILED])
        ),
        completed=Count('pk', filter=Q(status=CvImportJob.Status.COMPLETED)),
    )
    ai_cost = AiInvocation.objects.filter(
        use_case='cv_sample_content', created_at__gte=month_start
    ).aggregate(total=Sum('cost_usd'))['total']
    top = (
        CvTemplate.objects.filter(lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED)
        .annotate(cvs_30=Count('cvs', filter=Q(cvs__created_at__gte=since_30)))
        .order_by('-usage_count', '-cvs_30', 'name')[:TOP_TEMPLATES]
    )
    return {
        'templates_published': CvTemplate.objects.filter(
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED
        ).count(),
        'cvs_created_7d': created['last_7'],
        'cvs_created_30d': created['last_30'],
        'cvs_uploaded_30d': created['uploaded_30'],
        'import_success_rate_30d': (
            round(imports['completed'] * 100 / imports['finished'], 1)
            if imports['finished']
            else None
        ),
        'ai_cost_month_usd': float(ai_cost or 0),
        'top_templates': [
            {
                'public_id': template.public_id,
                'name': template.name,
                'usage_count': template.usage_count,
                'cvs_30d': template.cvs_30,
            }
            for template in top
        ],
        'todos': {
            'samples_in_review': CvSampleContent.objects.filter(
                status=CvSampleContent.Status.IN_REVIEW
            ).count(),
            'positions_without_content': CvPositionProfile.objects.filter(is_active=True)
            .exclude(sample_contents__status=CvSampleContent.Status.PUBLISHED)
            .count(),
            'stale_template_drafts': CvTemplateVersion.objects.filter(
                version_status=CvTemplateVersion.VersionStatus.DRAFT,
                created_at__lt=now - timedelta(days=STALE_DRAFT_DAYS),
            ).count(),
            'missing_thumbnails': CvTemplateColorLink.objects.filter(
                template__lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
                color__is_active=True,
                thumbnail_url='',
            ).count(),
            'failed_generations_7d': CvSampleGeneration.objects.filter(
                status=CvSampleGeneration.Status.FAILED, created_at__gte=since_7
            ).count(),
        },
    }
