"""Thao tác danh mục template của cổng admin (CVT-4): tạo, bản nháp, nhân bản,
sắp xếp, ẩn/hiện."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from ..models import (
    CvColor,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateColorLink,
    CvTemplateSection,
    CvTemplateVersion,
)
from .template_config import (
    new_version_defaults,
    planned_sections,
    replace_sections,
    set_template_colors,
)

# Mẫu mới nhận sẵn vài màu đầu của thư viện để xem trước và xuất bản được ngay.
STARTER_COLOR_COUNT = 6

COPIED_FIELDS = (
    'description_vi',
    'description_en',
    'seo_title_vi',
    'seo_title_en',
    'seo_description_vi',
    'seo_description_en',
    'is_premium',
)
VERSION_FIELDS = (
    'renderer_key',
    'renderer_version',
    'schema_version',
    'layout_schema',
    'style_schema',
    'default_layout_json',
    'default_style_json',
    'capabilities',
    'content_contract',
)


def _unique_slug(base):
    slug, number = f'{base}-ban-sao', 2
    while CvTemplate.objects.filter(slug=slug).exists():
        slug, number = f'{base}-ban-sao-{number}', number + 1
    return slug


def _copy_sections(source, version):
    CvTemplateSection.objects.bulk_create(
        [
            CvTemplateSection(
                template_version=version,
                section_definition=section.section_definition,
                region_key=section.region_key,
                default_order=section.default_order,
                is_required=section.is_required,
                is_default_enabled=section.is_default_enabled,
                is_draggable=section.is_draggable,
                use_theme_color=section.use_theme_color,
                config_json=section.config_json,
            )
            for section in source.sections.all()
        ]
    )


@transaction.atomic
def create_draft_version(template, *, renderer_key=None, actor=None):
    """Bản nháp để sửa: chép từ bản đang xuất bản, hoặc (mẫu chưa có phiên bản)
    dựng từ layout với section đặt sẵn theo bản đồ mặc định. Đã có nháp thì trả
    lại bản nháp đó."""
    template = CvTemplate.objects.select_for_update().get(pk=template.pk)
    existing = template.versions.filter(
        version_status=CvTemplateVersion.VersionStatus.DRAFT
    ).first()
    if existing is not None:
        return existing
    source = template.current_published_version
    if source is None and not renderer_key:
        raise ValidationError({'renderer_key': 'Chọn bố cục cho phiên bản đầu tiên.'})
    fields = (
        {field: getattr(source, field) for field in VERSION_FIELDS}
        if source
        else new_version_defaults(renderer_key)
    )
    version = CvTemplateVersion.objects.create(
        template=template,
        version_number=(template.versions.aggregate(value=Max('version_number'))['value'] or 0) + 1,
        version_status=CvTemplateVersion.VersionStatus.DRAFT,
        created_by=actor,
        **fields,
    )
    if source:
        _copy_sections(source, version)
    else:
        replace_sections(
            version,
            planned_sections(renderer_key),
            [region['id'] for region in version.default_layout_json['regions']],
        )
    return version


@transaction.atomic
def start_template(template, *, renderer_key, actor=None):
    """Mẫu vừa tạo: bản nháp đầu tiên đủ section và bảng màu khởi đầu."""
    version = create_draft_version(template, renderer_key=renderer_key, actor=actor)
    if not template.color_links.exists():
        colors = list(CvColor.objects.filter(is_active=True)[:STARTER_COLOR_COUNT])
        if colors:
            set_template_colors(
                template, [color.public_id for color in colors], colors[0].public_id
            )
            version.default_style_json = {
                **version.default_style_json,
                'theme_color': colors[0].hex_code,
            }
            version.save(update_fields=['default_style_json'])
    return version


@transaction.atomic
def duplicate_template(template, *, actor=None):
    """Bản sao ở trạng thái nháp: cùng danh mục, màu và một phiên bản nháp cùng cấu hình."""
    source = (
        template.current_published_version or template.versions.order_by('-version_number').first()
    )
    copy = CvTemplate.objects.create(
        name=f'{template.name} (bản sao)',
        slug=_unique_slug(template.slug),
        display_name_vi=f'{template.display_name_vi} (bản sao)' if template.display_name_vi else '',
        display_name_en=f'{template.display_name_en} (copy)' if template.display_name_en else '',
        sort_order=(CvTemplate.objects.aggregate(value=Max('sort_order'))['value'] or 0) + 1,
        lifecycle_status=CvTemplate.LifecycleStatus.DRAFT,
        **{field: getattr(template, field) for field in COPIED_FIELDS},
    )
    CvTemplateCategoryLink.objects.bulk_create(
        [
            CvTemplateCategoryLink(template=copy, category=link.category)
            for link in template.category_links.all()
        ]
    )
    CvTemplateColorLink.objects.bulk_create(
        [
            CvTemplateColorLink(
                template=copy,
                color=link.color,
                is_default=link.is_default,
                sort_order=link.sort_order,
            )
            for link in template.color_links.all()
        ]
    )
    if source is not None:
        version = CvTemplateVersion.objects.create(
            template=copy,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.DRAFT,
            created_by=actor,
            **{field: getattr(source, field) for field in VERSION_FIELDS},
        )
        _copy_sections(source, version)
    return copy


@transaction.atomic
def reorder_templates(*, public_ids):
    templates = {
        template.public_id: template
        for template in CvTemplate.objects.select_for_update().filter(public_id__in=public_ids)
    }
    if len(templates) != len(set(public_ids)):
        raise ValidationError({'public_ids': 'Có mã template không tồn tại hoặc bị lặp.'})
    for order, public_id in enumerate(public_ids):
        templates[public_id].sort_order = order
    CvTemplate.objects.bulk_update(templates.values(), ['sort_order'])


@transaction.atomic
def set_template_visibility(*, template, visible):
    """Hiện lại (cần phiên bản xuất bản) hoặc ẩn template khỏi kho mẫu công khai."""
    template = CvTemplate.objects.select_for_update().get(pk=template.pk)
    if visible:
        if template.current_published_version_id is None:
            raise ValidationError({'status': 'Template chưa có phiên bản xuất bản.'})
        template.lifecycle_status = CvTemplate.LifecycleStatus.PUBLISHED
        template.archived_at = None
    else:
        template.lifecycle_status = CvTemplate.LifecycleStatus.ARCHIVED
        template.archived_at = timezone.now()
    template.save(update_fields=['lifecycle_status', 'archived_at', 'updated_at'])
    return template
