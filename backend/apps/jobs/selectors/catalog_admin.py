"""Đọc danh mục của tin tuyển dụng cho trang quản trị, kèm số tin đang dùng."""

from django.db.models import Count, Prefetch

from common.db.aggregates import related_count

from ..models import (
    Benefit,
    JobBenefit,
    JobCategory,
    JobCategoryAssignment,
    JobCategoryLocalization,
    JobLanguageRequirement,
    Language,
)


def admin_job_categories_queryset():
    """Cả cây ngành nghề (khoảng một trăm mục) để trang quản trị dựng bảng cây, không phân trang."""
    english = JobCategoryLocalization.objects.filter(locale=JobCategoryLocalization.Locale.EN)
    return (
        JobCategory.objects.annotate(
            job_count=related_count(JobCategoryAssignment, 'category'),
            child_count=Count('children'),
        )
        .prefetch_related(Prefetch('localizations', queryset=english, to_attr='english'))
        .order_by('name')
    )


def admin_benefits_queryset():
    """Phúc lợi theo thứ tự hiển thị, kèm số tin và số công ty đang chọn."""
    company_benefit = Benefit._meta.get_field('company_assignments').related_model
    return Benefit.objects.annotate(
        job_count=related_count(JobBenefit, 'benefit'),
        company_count=related_count(company_benefit, 'benefit'),
    ).order_by('sort_order', 'name')


def admin_languages_queryset():
    return Language.objects.annotate(
        job_count=related_count(JobLanguageRequirement, 'language')
    ).order_by('name')
