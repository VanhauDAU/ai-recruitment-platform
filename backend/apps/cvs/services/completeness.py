"""Stable, template-agnostic CV completion scoring for candidate workflows."""

from ..models import UserCv

COMPLETION_THRESHOLD = 70


def _has_value(value):
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(_has_value(item) for item in value)
    if isinstance(value, dict):
        return any(
            _has_value(item)
            for key, item in value.items()
            if key not in {'item_id', 'instance_id', 'schema_version', 'sort_order'}
        )
    return value is not None and value is not False


def _section_has_content(content, *section_keys):
    keys = set(section_keys)
    return any(
        section.get('enabled', True)
        and section.get('section_key') in keys
        and _has_value(section.get('items', []))
        for section in content.get('sections', [])
        if isinstance(section, dict)
    )


def cv_completion_score(cv):
    """Return a 0-100 score from the latest saved immutable CV version."""
    if cv.cv_type == UserCv.CvType.UPLOADED and cv.file_name:
        return 100
    version = cv.latest_version
    content = version.content_json if version else {}
    personal = content.get('personal_info', {}) if isinstance(content, dict) else {}
    checks = [
        (15, _has_value(personal.get('full_name'))),
        (10, _has_value(personal.get('email'))),
        (10, _has_value(personal.get('phone'))),
        (5, _has_value(personal.get('headline'))),
        (5, _has_value(personal.get('address'))),
        (15, _section_has_content(content, 'summary')),
        (15, _section_has_content(content, 'experience', 'projects')),
        (10, _section_has_content(content, 'education')),
        (10, _section_has_content(content, 'skills')),
        (5, _section_has_content(content, 'certifications', 'languages', 'awards')),
    ]
    return sum(weight for weight, complete in checks if complete)


def application_readiness_issues(version):
    """What an application CV still lacks for a recruiter to evaluate it.

    Stricter than the completion score, which treats any uploaded file as
    complete: recruiters only ever read the structured snapshot, so an import
    that has not been parsed yet would reach them as a blank page.
    """
    content = version.content_json if version and isinstance(version.content_json, dict) else {}
    personal = content.get('personal_info') or {}
    issues = []
    if not _has_value(personal.get('full_name')):
        issues.append('họ tên')
    if not (_has_value(personal.get('email')) or _has_value(personal.get('phone'))):
        issues.append('email hoặc số điện thoại')
    if not _section_has_content(
        content, 'summary', 'experience', 'projects', 'education', 'skills'
    ):
        issues.append('nội dung (giới thiệu, kinh nghiệm, dự án, học vấn hoặc kỹ năng)')
    return issues
