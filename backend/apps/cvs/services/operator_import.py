"""Nhập CV dựng sẵn (CV tổng hợp cho thực nghiệm) do người vận hành chuẩn bị.

Mỗi CV thuộc một tài khoản ứng viên thử riêng (`<mã>@synthetic.procv.test`, không
có mật khẩu dùng được), giống một người tìm việc thật có một CV, và tránh giới hạn
số CV của một tài khoản. CV đi qua cùng đường tạo CV builder và lưu phiên bản như
thao tác của ứng viên. Chạy thử (`apply=False`) làm trọn rồi hoàn tác.
"""

import re
from copy import deepcopy

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction

from apps.cv_templates.models import CvLanguage, CvTemplate

from ..models import CvVersion, UserCv
from .composition import compose_cv_document
from .cvs import upload_cv
from .lifecycle import CvLifecyclePolicyError, create_v2_cv
from .pdf_renderer import print_payload, render_document_pdf
from .versions import create_version

SYNTHETIC_EMAIL_DOMAIN = 'synthetic.procv.test'
CODE_RE = re.compile(r'^CV-\d{3,}$')
LOCALES = {'vi': CvLanguage.VI, 'en': CvLanguage.EN}
SECTION_TITLES = {
    CvLanguage.VI: {
        'summary': 'Mục tiêu nghề nghiệp',
        'experience': 'Kinh nghiệm làm việc',
        'education': 'Học vấn',
        'skills': 'Kỹ năng',
        'projects': 'Dự án',
        'certifications': 'Chứng chỉ',
        'languages': 'Ngoại ngữ',
        'activities': 'Hoạt động',
        'awards': 'Giải thưởng',
        'interests': 'Sở thích',
    },
    CvLanguage.EN: {
        'summary': 'Career objective',
        'experience': 'Work experience',
        'education': 'Education',
        'skills': 'Skills',
        'projects': 'Projects',
        'certifications': 'Certifications',
        'languages': 'Languages',
        'activities': 'Activities',
        'awards': 'Awards',
        'interests': 'Interests',
    },
}


class CvRowRejected(Exception):
    pass


def _rich_text(lines):
    return {
        'format': 'rich_text_v1',
        'content': [
            {'type': 'bullet', 'text': str(line).strip()} for line in lines if str(line).strip()
        ],
    }


def cv_content_from_generated(data, locale):
    """Document CV builder (không danh tính) từ dữ liệu CV dựng sẵn."""
    education = data.get('education') or {}
    items = {
        'summary': [{'value': data.get('summary', '')}],
        'experience': [
            {
                'role': job['role'],
                'company': job['company'],
                'start_date': job.get('start_date'),
                'end_date': job.get('end_date'),
                'description': _rich_text(job.get('highlights', [])),
            }
            for job in data.get('experience', [])
        ],
        'education': [
            {
                'degree': education.get('degree', ''),
                'institution': education.get('institution', ''),
                'degree_level': education.get('degree_level', ''),
                'start_date': education.get('start_date'),
                'end_date': education.get('end_date'),
                'description': _rich_text([]),
            }
        ],
        'skills': [
            {'name': skill['name'], 'level': skill.get('level', 3)}
            for skill in data.get('skills', [])
        ],
        'projects': [
            {
                'name': project['name'],
                'role': project.get('role', ''),
                'description': _rich_text(project.get('highlights', [])),
            }
            for project in data.get('projects', [])
        ],
        'certifications': [
            {'name': name, 'issuer': '', 'description': _rich_text([])}
            for name in data.get('certifications', [])
            if str(name).strip()
        ],
        'languages': [
            {
                'name': item['language'],
                'value': ' · '.join(
                    part for part in (item.get('level', ''), item.get('certificate', '')) if part
                ),
                'description': _rich_text([]),
            }
            for item in data.get('languages', [])
            if str(item.get('language') or '').strip()
        ],
        'activities': [
            {
                'name': item['name'],
                'value': item.get('organization', ''),
                'description': _rich_text(item.get('highlights', [])),
            }
            for item in data.get('activities', [])
        ],
        'awards': [
            {'name': name, 'value': '', 'description': _rich_text([])}
            for name in data.get('awards', [])
            if str(name).strip()
        ],
        'interests': [
            {'name': name, 'value': '', 'description': _rich_text([])}
            for name in data.get('interests', [])
            if str(name).strip()
        ],
    }
    sections = []
    for key, title in SECTION_TITLES[locale].items():
        if not items[key]:
            continue
        sections.append(
            {
                'instance_id': f'{key}_1',
                'section_key': key,
                'title': title,
                'enabled': True,
                'items': [
                    {'item_id': f'{key}_item_{index}', **item}
                    for index, item in enumerate(items[key], start=1)
                ],
            }
        )
    return {
        'schema_version': 1,
        'locale': locale,
        'personal_info': {
            'full_name': '',
            'headline': data.get('headline', ''),
            'email': '',
            'phone': '',
            'address': '',
            'website': '',
            'date_of_birth': '',
            'avatar_asset_id': None,
            'links': [],
        },
        'sections': sections,
        'custom_fields': {},
    }


def _owner(code):
    users = get_user_model().objects
    email = f'{code.lower()}@{SYNTHETIC_EMAIL_DOMAIN}'
    user = users.filter(email=email, role='candidate').first()
    if user is None:
        user = users.create_user(
            email=email,
            password=None,
            role='candidate',
            full_name=f'Ứng viên {code}',
            email_verified=True,
        )
    return user


def _import_one(item, template):
    code = str(item.get('code') or '').strip().upper()
    if not CODE_RE.match(code):
        raise CvRowRejected(f'Mã CV không hợp lệ: {code or "(trống)"}.')
    locale = LOCALES.get(item.get('language'))
    if locale is None:
        raise CvRowRejected(f'Ngôn ngữ phải là vi hoặc en: {item.get("language")}.')
    data = item.get('data') or {}
    owner = _owner(code)
    existing = UserCv.objects.filter(user=owner, is_deleted=False).first()
    if existing is not None:
        return 'skipped', owner, existing
    headline = str(data.get('headline') or '').strip()
    cv = create_v2_cv(
        actor=owner,
        title=f'{code} {headline}'.strip()[:255],
        template=template,
        language=locale,
    )
    document = compose_cv_document(
        template=template, content_json=cv_content_from_generated(data, locale)
    )
    create_version(
        cv=cv,
        actor=owner,
        content_json=document['content_json'],
        layout_json=document['layout_json'],
        style_json=document['style_json'],
        version_kind=CvVersion.VersionKind.MANUAL_SAVE,
        create_or_replace_draft=True,
    )
    return 'imported', owner, cv


def import_cv_documents(items, *, apply=False):
    """Nhập danh sách CV dựng sẵn; trả báo cáo từng dòng."""
    template = (
        CvTemplate.objects.filter(
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            current_published_version__isnull=False,
        )
        .order_by('pk')
        .first()
    )
    if template is None:
        raise CvRowRejected('Chưa có mẫu CV nào được xuất bản.')
    rows = []
    with transaction.atomic():
        for item in items:
            row = {'code': str(item.get('code') or ''), 'status': 'error', 'error': ''}
            rows.append(row)
            try:
                with transaction.atomic():
                    status, owner, cv = _import_one(item, template)
                row.update(status=status, email=owner.email, cv_public_id=cv.public_id)
            except (CvRowRejected, CvLifecyclePolicyError) as error:
                row['error'] = str(error)
            except Exception as error:  # noqa: BLE001 - báo lỗi từng dòng, không dừng cả lượt
                row['error'] = f'{type(error).__name__}: {error}'
        if not apply:
            transaction.set_rollback(True)
    counts = {
        status: sum(row['status'] == status for row in rows)
        for status in ('imported', 'skipped', 'error')
    }
    return {'applied': apply, 'template': template.name, 'rows': rows, 'summary': counts}


def _match_language(twin, builder):
    # CV tải lên mặc định tiếng Việt; bản PDF phải mang ngôn ngữ của CV gốc.
    if twin.language != builder.language:
        UserCv.objects.filter(pk=twin.pk).update(language=builder.language)


def create_pdf_twins(codes, *, apply=False):
    """Xuất PDF từ CV builder dựng sẵn rồi tải lên lại thành CV tải lên của cùng tài khoản.

    Cặp "cùng nội dung, hai dạng" dùng để đo độ lệch giữa trích xuất từ CV tải lên
    và từ CV builder. Trả `(báo cáo, {mã: bytes PDF})`; chạy thử vẫn render PDF
    nhưng hoàn tác bản ghi.
    """
    rows, pdfs = [], {}
    with transaction.atomic():
        for code in codes:
            row = {'code': code, 'status': 'error', 'error': ''}
            rows.append(row)
            owner = (
                get_user_model()
                .objects.filter(email=f'{code.lower()}@{SYNTHETIC_EMAIL_DOMAIN}')
                .first()
            )
            cvs = (
                UserCv.objects.filter(user=owner, is_deleted=False)
                if owner
                else UserCv.objects.none()
            )
            builder = (
                cvs.filter(cv_type=UserCv.CvType.BUILDER).select_related('latest_version').first()
            )
            if builder is None or builder.latest_version is None:
                row['error'] = 'Chưa có CV builder của mã này.'
                continue
            twin = cvs.filter(cv_type=UserCv.CvType.UPLOADED).first()
            if twin is not None:
                _match_language(twin, builder)
                row.update(status='skipped', cv_public_id=twin.public_id)
                continue
            try:
                # CV tải lên phải có email hoặc số điện thoại (bộ kiểm tra CV tải lên);
                # bản PDF in kèm email thử của tài khoản, không dùng số điện thoại để
                # khỏi trùng số của người thật.
                payload = deepcopy(print_payload(builder.latest_version))
                personal_info = payload['document']['content_json']['personal_info']
                personal_info.update(full_name=owner.full_name, email=owner.email)
                pdf = render_document_pdf(payload)
                with transaction.atomic():
                    twin = upload_cv(
                        owner,
                        SimpleUploadedFile(f'{code}.pdf', pdf, content_type='application/pdf'),
                        title=f'{code} PDF',
                    )
            except Exception as error:  # noqa: BLE001 - báo lỗi từng mã, không dừng cả lượt
                row['error'] = f'{type(error).__name__}: {error}'
                continue
            _match_language(twin, builder)
            pdfs[code] = pdf
            row.update(status='imported', cv_public_id=twin.public_id, bytes=len(pdf))
        if not apply:
            transaction.set_rollback(True)
    counts = {
        status: sum(row['status'] == status for row in rows)
        for status in ('imported', 'skipped', 'error')
    }
    return {'applied': apply, 'rows': rows, 'summary': counts}, pdfs
