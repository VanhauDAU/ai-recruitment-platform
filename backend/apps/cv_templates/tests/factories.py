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
    renderer_key='single_column_v1',
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


def fill_cv_for_application(cv, actor, *, full_name='Ứng Viên Test', email='candidate@example.com'):
    """Save a version that passes ``application_readiness_issues``.

    A freshly created CV is a blank document, which candidates may no longer
    submit; tests that apply with a CV call this first.
    """
    from apps.cvs.services import save_draft_as_version, update_draft

    draft = cv.draft
    content = draft.content_json
    content['personal_info'].update(full_name=full_name, email=email)
    content['sections'] = [
        {
            'instance_id': 'sec_experience_1',
            'section_key': 'experience',
            'title': 'Experience',
            'enabled': True,
            'items': [{'item_id': 'experience_1', 'company': 'Acme', 'start_date': '2025-01'}],
        }
    ]
    layout = draft.layout_json
    layout['regions'][0]['section_instance_ids'] = ['sec_experience_1']
    update_draft(
        cv=cv,
        actor=actor,
        content_json=content,
        layout_json=layout,
        style_json=draft.style_json,
        expected_lock_version=draft.lock_version,
    )
    cv.draft.refresh_from_db()
    version = save_draft_as_version(cv=cv, actor=actor, expected_lock_version=cv.draft.lock_version)
    cv.refresh_from_db()
    return version
