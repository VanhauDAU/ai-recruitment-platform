"""Helper dựng dữ liệu test cho miền CV template.

Khối "template PUBLISHED + version PUBLISHED + gắn current_published_version"
lặp lại ở 4 app (cv_templates, cvs, applications) — mọi test cần một CV thật đều
phải dựng nó trước. Gom về đây để đổi contract template chỉ phải sửa một chỗ.
"""

from apps.cvs.schemas import empty_layout, empty_style

from ..models import CvTemplate, CvTemplateVersion


def make_published_template(
    name='Test template',
    *,
    renderer_key='classic_single_column_v1',
    capabilities=None,
    **template_overrides,
):
    """Trả về (template, version) đã publish và liên kết hai chiều."""
    template = CvTemplate.objects.create(
        name=name,
        lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
        **template_overrides,
    )
    version = CvTemplateVersion.objects.create(
        template=template,
        version_number=1,
        version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
        renderer_key=renderer_key,
        renderer_version='1',
        default_layout_json=empty_layout(),
        default_style_json=empty_style(),
        capabilities=capabilities or {},
    )
    template.current_published_version = version
    template.save(update_fields=['current_published_version'])
    return template, version
