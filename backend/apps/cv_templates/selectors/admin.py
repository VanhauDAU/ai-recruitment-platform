"""Truy vấn của cổng admin mẫu CV (CVT-4): danh mục template, thư viện, nội dung mẫu, vị trí."""

from django.db.models import Count

from ..models import (
    CvCategory,
    CvColor,
    CvPositionField,
    CvPositionProfile,
    CvSampleContent,
    CvSampleGeneration,
    CvTemplate,
    CvTemplateVersion,
)

SAMPLE_CONTENT_FILTERS = {
    'position': 'position_profile__job_category__public_id',
    'locale': 'locale',
    'band': 'experience_band',
    'status': 'status',
}
# Trang trạng thái chỉ cần các lượt gần đây của một lô.
SAMPLE_GENERATION_LIMIT = 200


def admin_templates_queryset():
    return CvTemplate.objects.prefetch_related(
        'categories',
        'color_links__color',
        'versions__published_by',
        'versions__sections__section_definition',
    ).order_by('sort_order', 'name')


def admin_template_version(pk):
    return CvTemplateVersion.objects.prefetch_related('sections__section_definition').get(pk=pk)


def template_version(template, pk):
    """Phiên bản `pk` của `template`, hoặc None khi không thuộc template này."""
    return template.versions.filter(pk=pk).first()


def admin_categories_queryset():
    # Số mẫu đang dùng; mục đang dùng không xóa được.
    return CvCategory.objects.annotate(template_count=Count('template_links')).order_by(
        'category_type', 'sort_order', 'name'
    )


def admin_colors_queryset():
    return CvColor.objects.annotate(template_count=Count('template_links')).order_by(
        'sort_order', 'name'
    )


def admin_sample_contents_queryset(params):
    return (
        CvSampleContent.objects.select_related('position_profile__job_category')
        .order_by('-updated_at')
        .filter(
            **{
                lookup: params[name]
                for name, lookup in SAMPLE_CONTENT_FILTERS.items()
                if params.get(name)
            }
        )
    )


def admin_sample_generations_queryset(*, batch=None):
    queryset = CvSampleGeneration.objects.select_related('position_profile__job_category', 'sample')
    if batch:
        queryset = queryset.filter(batch_id=batch)
    return queryset[:SAMPLE_GENERATION_LIMIT]


def admin_position_profiles_queryset(*, positions=None):
    """`positions`: mã `JobCategory` cách nhau bằng dấu phẩy."""
    queryset = CvPositionProfile.objects.select_related('job_category__parent').annotate(
        field_count=Count('fields')
    )
    if positions:
        queryset = queryset.filter(job_category__public_id__in=positions.split(','))
    return queryset.order_by('sort_order', 'pk')


def admin_position_fields_queryset(*, position=None):
    queryset = CvPositionField.objects.select_related('profile__job_category')
    if position:
        queryset = queryset.filter(profile__job_category__public_id=position)
    return queryset.order_by('profile_id', 'sort_order', 'pk')
